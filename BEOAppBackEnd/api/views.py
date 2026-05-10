import io
import re
import fitz  # PyMuPDF
import pdfplumber
import pytesseract
from PIL import Image
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.shortcuts import render
from .models import BEOWeek, BEOWeekFile


def home(request):
    return render(request, 'home.html')


# ---------------------------------------------------------------------------
# Week management endpoints
# ---------------------------------------------------------------------------

@csrf_exempt
def weeks(request):
    """
    GET  /api/weeks/  → list all stored weeks with file counts
    POST /api/weeks/  → upload PDFs for a week; auto-detects the week from
                        the optional `week_start` field (YYYY-MM-DD) or defaults
                        to the Monday of the current week.
    DELETE /api/weeks/<id>/  → handled in week_detail (not here)
    """
    if request.method == 'GET':
        return _weeks_list(request)
    if request.method == 'POST':
        return _weeks_upload(request)
    return JsonResponse({'error': 'Method not allowed'}, status=405)


def _weeks_list(request):
    qs = BEOWeek.objects.prefetch_related('files').order_by('week_start')
    result = []
    for w in qs:
        result.append({
            'id':         w.pk,
            'label':      w.label,
            'week_start': w.week_start.isoformat(),
            'file_count': w.files.count(),
            'files':      [{'id': f.pk, 'name': f.file_name} for f in w.files.all()],
        })
    return JsonResponse({'weeks': result})


def _weeks_upload(request):
    import datetime
    # Determine which week these files belong to
    week_start_str = request.POST.get('week_start', '')
    if week_start_str:
        try:
            week_start = datetime.date.fromisoformat(week_start_str)
            # Snap to Monday of that week
            week_start = week_start - datetime.timedelta(days=week_start.weekday())
        except ValueError:
            return JsonResponse({'error': 'Invalid week_start date'}, status=400)
    else:
        week_start = BEOWeek.current_week_start()

    # Collect uploaded files
    pdf_files = []
    if 'file' in request.FILES:
        pdf_files += list(request.FILES.getlist('file'))
    idx = 0
    while f'file{idx}' in request.FILES:
        pdf_files.append(request.FILES[f'file{idx}'])
        idx += 1

    if not pdf_files:
        return JsonResponse({'error': 'No files uploaded.'}, status=400)

    week = BEOWeek.get_or_create_for_week(week_start)

    saved = []
    for f in pdf_files:
        data = f.read()
        # Replace if same filename already exists for this week
        BEOWeekFile.objects.filter(week=week, file_name=f.name).delete()
        wf = BEOWeekFile.objects.create(week=week, file_name=f.name, file_data=data)
        saved.append({'id': wf.pk, 'name': wf.file_name})

    # Prune weeks outside prev/current/next window
    BEOWeek.prune_old_weeks()

    return JsonResponse({
        'week': {
            'id':         week.pk,
            'label':      week.label,
            'week_start': week.week_start.isoformat(),
        },
        'saved': saved,
    })


@csrf_exempt
def week_detail(request, week_id):
    """DELETE /api/weeks/<id>/ — remove a single week and all its files."""
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    try:
        w = BEOWeek.objects.get(pk=week_id)
        w.delete()
        return JsonResponse({'deleted': week_id})
    except BEOWeek.DoesNotExist:
        return JsonResponse({'error': 'Week not found'}, status=404)


@csrf_exempt
def week_file_delete(request, week_id, file_id):
    """DELETE /api/weeks/<wid>/files/<fid>/ — remove one file from a week."""
    if request.method != 'DELETE':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    try:
        f = BEOWeekFile.objects.get(pk=file_id, week_id=week_id)
        f.delete()
        return JsonResponse({'deleted': file_id})
    except BEOWeekFile.DoesNotExist:
        return JsonResponse({'error': 'File not found'}, status=404)


def _get_pdf_bytes_for_request(request):
    """
    Shared helper: collect PDF bytes from either:
      - Uploaded files (file / file0, file1, ...)   — direct upload
      - week_id POST field                           — pull from DB
    Returns list of (bytes, filename) tuples.
    """
    pdf_list = []

    # 1. DB-backed: week_id supplied
    week_id = request.POST.get('week_id') or request.GET.get('week_id')
    if week_id:
        try:
            week = BEOWeek.objects.get(pk=week_id)
            for wf in week.files.all():
                pdf_list.append((bytes(wf.file_data), wf.file_name))
        except BEOWeek.DoesNotExist:
            pass

    # 2. Direct upload
    if 'file' in request.FILES:
        for f in request.FILES.getlist('file'):
            pdf_list.append((f.read(), f.name))
    idx = 0
    while f'file{idx}' in request.FILES:
        f = request.FILES[f'file{idx}']
        pdf_list.append((f.read(), f.name))
        idx += 1

    return pdf_list


@csrf_exempt
@require_http_methods(['POST'])
def parse_pdf(request):
    """
    POST /api/parse-pdf/
    Body: multipart/form-data, field name 'file', PDF content.

    Returns a list of structured BEO objects (one per content page):
    {
      "beos": [
        {
          "page": 1,
          "beo_type": "loadlist" | "catering" | "floorplan" | "unknown",
          "header": {
            "beo_date": "...", "time": "...", "event_name": "...",
            "requestor": "...", "send_invoice_to": "...", "location": "...",
            "fund_number": "...", "beo_id": "...", "beo_number": "...",
            "headcount": "...", "vendor": "..."
          },
          "notes": ["..."],           // ops notes / free-text notes section
          "content": ["..."],         // type-specific body lines (menu items, room config, item lists)
          "assigned_to": "...",
          "coordinator": "...",
          "created": "...",
          "printed": "..."
        }
      ],
      "total_beos": N
    }
    """
    if 'file' not in request.FILES:
        return JsonResponse({'error': 'No file uploaded. Use field name "file".'}, status=400)

    pdf_file = request.FILES['file']

    if not pdf_file.name.lower().endswith('.pdf'):
        return JsonResponse({'error': 'Uploaded file must be a PDF.'}, status=400)

    pdf_bytes = pdf_file.read()
    received_size = len(pdf_bytes)

    if received_size == 0:
        return JsonResponse({'error': 'File received was empty (0 bytes).'}, status=400)

    try:
        pages_data = _extract_with_pymupdf(pdf_bytes)

        total_lines = sum(len(p['lines']) for p in pages_data)
        method = 'pymupdf'
        if total_lines == 0:
            pages_data = _extract_with_pdfplumber(pdf_bytes)
            method = 'pdfplumber'

        total_lines = sum(len(p['lines']) for p in pages_data)
        if total_lines == 0:
            pages_data = _extract_with_ocr(pdf_bytes)
            method = 'ocr-tesseract'

        beos = []
        for page_data in pages_data:
            structured = _parse_beo_structure(page_data['page'], page_data['lines'])
            if structured is not None:
                beos.append(structured)

        return JsonResponse({
            'beos': beos,
            'total_beos': len(beos),
            'debug': {
                'received_bytes': received_size,
                'method': method,
                'total_pages': len(pages_data),
            }
        })

    except Exception as exc:
        import traceback
        return JsonResponse({'error': f'Failed to parse PDF: {str(exc)}', 'trace': traceback.format_exc()}, status=500)


@csrf_exempt
@require_http_methods(['POST'])
def bin_list(request):
    """
    POST /api/bin-list/
    Accepts PDFs via file/file0..fileN uploads OR week_id POST field (DB-backed).
    Optional POST field `day` filters to a single date label e.g. "Wed 04/15/2026".
    """
    pdf_list = _get_pdf_bytes_for_request(request)
    if not pdf_list:
        return JsonResponse({'error': 'No files uploaded.'}, status=400)

    day_filter = (request.POST.get('day') or '').strip() or None

    try:
        all_beos = []
        for pdf_bytes, _ in pdf_list:
            if not pdf_bytes:
                continue
            pages_data = _extract_with_pymupdf(pdf_bytes)
            if sum(len(p['lines']) for p in pages_data) == 0:
                pages_data = _extract_with_pdfplumber(pdf_bytes)
            if sum(len(p['lines']) for p in pages_data) == 0:
                pages_data = _extract_with_ocr(pdf_bytes)
            beos = [s for p in pages_data
                    if (s := _parse_beo_structure(p['page'], p['lines'])) is not None]
            all_beos.extend(beos)

        result = _build_bin_list(all_beos, day_filter=day_filter)
        return JsonResponse(result)

    except Exception as exc:
        import traceback
        return JsonResponse({'error': str(exc), 'trace': traceback.format_exc()}, status=500)


# ---------------------------------------------------------------------------
# Bin list builder
# ---------------------------------------------------------------------------

# Maps keywords found in NON-RECHARGABLES lines → canonical category name
# Serviceware, Decor & Linens, and Sanitation are excluded (not supply bins)
_BIN_CATEGORIES = [
    ('soda|coke|pepsi|sprite|diet|lemon.?lime|sparkling water|la croix|topo chico', 'Sodas & Sparkling'),
    ('water bottle|mini water|still water|flat water',                              'Water Bottles'),
    ('juice|orange juice|apple juice|lemonade',                                     'Juices'),
    ('chip|popcorn|pretzel|snack mix',                                              'Chips & Snacks'),
    ('cookie|brownie|dessert|sweet|candy|chocolate',                                'Cookies & Sweets'),
    ('coffee|tea|hot chocolate|cocoa|decaf',                                        'Hot Beverages'),
]

# Item patterns to skip entirely (serviceware, decor, sanitation, etc.)
_SKIP_PATTERNS = re.compile(
    r'\bcup\b|glass|plate|napkin|fork|knife|spoon|utensil|straw|tong|liner|'
    r'lift|riser|display|\bsign\b|decor|centerpiece|floral|linen|tablecloth|skirt|'
    r'towel|glove|sanitizer|trash|\bbar mop\b|driftwood|succulent|potted|'
    r'bio plate|bio fork|bio knife',
    re.I
)


def _categorize_item(item_text: str) -> str:
    """Return the canonical bin category for a NON-RECHARGABLES line."""
    lower = item_text.lower()
    for pattern, category in _BIN_CATEGORIES:
        if re.search(pattern, lower):
            return category
    return 'Other Supplies'


def _clean_item(raw: str) -> str:
    """Strip OCR bullet chars, normalize whitespace, and drop anything after a colon."""
    # Remove leading bullet / OCR artefact characters
    cleaned = re.sub(r'^[¢©*®\-•e]\s+', '', raw).strip()
    # Drop description after colon, e.g. "Assorted sodas: Assorted sodas, cups" → "Assorted sodas"
    if ':' in cleaned:
        cleaned = cleaned.split(':')[0].strip()
    return cleaned


def _build_bin_list(beos: list, day_filter: str | None = None) -> dict:
    """
    Given a list of parsed BEO dicts (from one or many PDFs),
    build the consolidated bin checklist sorted by calendar date then time.
    Only catering BEOs contribute to bins.
    If day_filter is set (e.g. "Wed 04/15/2026"), only that day's events appear.
    """
    from collections import OrderedDict

    # Sort catering BEOs chronologically: first by calendar date, then by time-of-day
    catering = [b for b in beos if b['beo_type'] == 'catering']
    if day_filter:
        catering = [b for b in catering if b['header'].get('beo_date', '') == day_filter]

    def _date_sort_key(b):
        raw = b['header'].get('beo_date', '')
        # Expected formats: "Wed 04/15/2026" or "04/15/2026"
        m = re.search(r'(\d{1,2})/(\d{1,2})/(\d{4})', raw)
        if m:
            mo, dy, yr = int(m.group(1)), int(m.group(2)), int(m.group(3))
            return yr * 10000 + mo * 100 + dy
        return 99999999

    def _time_sort_key(b):
        t = b['header'].get('time', '')
        m = re.search(r'(\d{1,2}):(\d{2})\s*(AM|PM)', t, re.I)
        if not m:
            return 9999
        h, mn, ap = int(m.group(1)), int(m.group(2)), m.group(3).upper()
        if ap == 'PM' and h != 12:
            h += 12
        if ap == 'AM' and h == 12:
            h = 0
        return h * 60 + mn

    catering.sort(key=lambda b: (_date_sort_key(b), _time_sort_key(b)))

    # Build event summary list (include date per event)
    events = []
    for b in catering:
        h = b['header']
        events.append({
            'date':        h.get('beo_date', ''),
            'event_name':  h.get('event_name', ''),
            'time':        h.get('time', ''),
            'location':    h.get('location', ''),
            'beo_id':      h.get('beo_id', ''),
            'headcount':   h.get('headcount', ''),
            'coordinator': b.get('coordinator', ''),
            'vendor':      h.get('vendor', ''),
        })

    # Build bins: category → list of {date, event_name, time, headcount, items, checked}
    bins_map: dict[str, list] = OrderedDict()

    for b in catering:
        h = b['header']
        event_label = h.get('event_name', 'Event')
        event_time  = h.get('time', '')
        event_date  = h.get('beo_date', '')

        # Pull all non-rechargables items
        non_rech_items = []
        for sec in b.get('content', []):
            if 'NON-RECH' in sec.get('section', '').upper():
                non_rech_items = sec.get('items', [])
                break

        # Also pull ops-notes bullet lines
        ops_supply_items = [
            line for line in b.get('notes', [])
            if re.match(r'^[¢©*®•\-]', line) or re.match(r'^\d+\)', line)
        ]

        all_items = non_rech_items + ops_supply_items

        for raw in all_items:
            cleaned = _clean_item(raw)
            if not cleaned:
                continue
            if _SKIP_PATTERNS.search(cleaned):
                continue
            category = _categorize_item(cleaned)
            if category not in bins_map:
                bins_map[category] = []
            # Each event gets its own entry (keyed by date + event_name)
            event_key = f'{event_date}|{event_label}'
            event_entry = next((e for e in bins_map[category] if e['_key'] == event_key), None)
            if event_entry is None:
                event_entry = {
                    '_key':      event_key,
                    'date':      event_date,
                    'event_name': event_label,
                    'time':      event_time,
                    'headcount': h.get('headcount', ''),
                    'items':     [],
                    'checked':   [],
                }
                bins_map[category].append(event_entry)
            event_entry['items'].append(cleaned)
            event_entry['checked'].append(False)

    # Strip internal _key before returning
    bins = []
    for cat, evts in bins_map.items():
        clean_evts = [{k: v for k, v in e.items() if k != '_key'} for e in evts]
        bins.append({'category': cat, 'events': clean_evts})

    # Collect unique sorted dates for the header
    dates = list(dict.fromkeys(
        b['header'].get('beo_date', '') for b in catering if b['header'].get('beo_date')
    ))

    return {
        'dates':  dates,
        'events': events,
        'bins':   bins,
    }


# ---------------------------------------------------------------------------
# Coffee list
# ---------------------------------------------------------------------------

# Patterns that indicate a coffee / hot-beverage line
_COFFEE_PATTERN = re.compile(
    r'coffee|espresso|cappuccino|latte|americano|hot chocolate|cocoa|chai|decaf|'
    r'urn|french press|pour.?over|cold brew|drip|hot beverage',
    re.I
)

# Size keywords to auto-detect from item text
_SIZE_KEYWORDS = ['small', 'medium', 'large', 'xl', 'extra large', 'urn', '12 oz', '16 oz', '20 oz']


@csrf_exempt
@require_http_methods(['POST'])
def coffee_list(request):
    """
    POST /api/coffee-list/
    Accepts PDFs via upload or week_id. Optional `day` field filters by date.
    """
    pdf_list = _get_pdf_bytes_for_request(request)
    if not pdf_list:
        return JsonResponse({'error': 'No files uploaded.'}, status=400)

    day_filter = (request.POST.get('day') or '').strip() or None

    try:
        all_beos = []
        for pdf_bytes, _ in pdf_list:
            if not pdf_bytes:
                continue
            pages_data = _extract_with_pymupdf(pdf_bytes)
            if sum(len(p['lines']) for p in pages_data) == 0:
                pages_data = _extract_with_pdfplumber(pdf_bytes)
            if sum(len(p['lines']) for p in pages_data) == 0:
                pages_data = _extract_with_ocr(pdf_bytes)
            beos = [s for p in pages_data
                    if (s := _parse_beo_structure(p['page'], p['lines'])) is not None]
            all_beos.extend(beos)

        orders = _build_coffee_list(all_beos, day_filter=day_filter)
        return JsonResponse(orders)

    except Exception as exc:
        import traceback
        return JsonResponse({'error': str(exc), 'trace': traceback.format_exc()}, status=500)


def _build_coffee_list(beos: list, day_filter: str | None = None) -> dict:
    """Extract coffee/hot-beverage orders from catering BEOs, sorted chronologically."""
    from collections import OrderedDict

    catering = [b for b in beos if b['beo_type'] == 'catering']
    if day_filter:
        catering = [b for b in catering if b['header'].get('beo_date', '') == day_filter]

    def _date_key(b):
        raw = b['header'].get('beo_date', '')
        m = re.search(r'(\d{1,2})/(\d{1,2})/(\d{4})', raw)
        if m:
            return int(m.group(3)) * 10000 + int(m.group(1)) * 100 + int(m.group(2))
        return 99999999

    def _time_key(b):
        t = b['header'].get('time', '')
        m = re.search(r'(\d{1,2}):(\d{2})\s*(AM|PM)', t, re.I)
        if not m:
            return 9999
        h, mn, ap = int(m.group(1)), int(m.group(2)), m.group(3).upper()
        if ap == 'PM' and h != 12:
            h += 12
        if ap == 'AM' and h == 12:
            h = 0
        return h * 60 + mn

    catering.sort(key=lambda b: (_date_key(b), _time_key(b)))

    orders = []
    dates_seen = []

    for b in catering:
        h = b['header']
        event_date = h.get('beo_date', '')

        # Gather all supply/content lines for this BEO
        all_lines = list(b.get('notes', []))
        for sec in b.get('content', []):
            all_lines += sec.get('items', [])

        # Find lines that match coffee patterns
        coffee_items = []
        detected_sizes = set()

        for raw in all_lines:
            cleaned = _clean_item(raw)
            if not cleaned:
                continue
            if _COFFEE_PATTERN.search(cleaned):
                coffee_items.append(cleaned)
                # Auto-detect sizes mentioned in this line
                lower = cleaned.lower()
                for sz in _SIZE_KEYWORDS:
                    if sz in lower:
                        detected_sizes.add(sz.title())

        if not coffee_items:
            continue

        if event_date and event_date not in dates_seen:
            dates_seen.append(event_date)

        # Calculate a suggested "brew by" time — 30 min before event start
        brew_by = _subtract_minutes(h.get('time', ''), 30)

        orders.append({
            'date':       event_date,
            'event_name': h.get('event_name', ''),
            'time':       h.get('time', ''),
            'brew_by':    brew_by,
            'location':   h.get('location', ''),
            'headcount':  h.get('headcount', ''),
            'items':      coffee_items,
            'sizes':      sorted(detected_sizes),
            'brewed':     False,
        })

    return {'dates': dates_seen, 'orders': orders}


def _subtract_minutes(time_str: str, minutes: int) -> str:
    """Return a time string with `minutes` subtracted, e.g. '1:00 PM' - 30 → '12:30 PM'."""
    m = re.search(r'(\d{1,2}):(\d{2})\s*(AM|PM)', time_str, re.I)
    if not m:
        return ''
    h, mn, ap = int(m.group(1)), int(m.group(2)), m.group(3).upper()
    if ap == 'PM' and h != 12:
        h += 12
    if ap == 'AM' and h == 12:
        h = 0
    total = h * 60 + mn - minutes
    if total < 0:
        total += 24 * 60
    nh, nm = divmod(total, 60)
    nap = 'AM' if nh < 12 else 'PM'
    nh12 = nh % 12 or 12
    return f'{nh12}:{nm:02d} {nap}'


# ---------------------------------------------------------------------------
# Run of Show
# ---------------------------------------------------------------------------

@csrf_exempt
@require_http_methods(['POST'])
def run_of_show(request):
    """
    POST /api/run-of-show/
    Accepts file0, file1, ... (same multi-file convention as bin-list).

    Returns all catering + floorplan BEOs sorted chronologically.
    Each BEO includes the full structured content so the UI can render
    a faithful replica of the paper sheet, plus fields for assignment
    and three completion checkboxes (preset, complete, cleaned_up).

    Response shape:
    {
      "dates": ["Wed 04/15/2026", ...],
      "beos": [
        {
          "id":           "13919",
          "beo_type":     "catering" | "floorplan" | "loadlist",
          "date":         "Wed 04/15/2026",
          "event_name":   "Cancer Center Speaker Lunch",
          "time":         "1:00 PM - 2:00 PM",
          "event_date":   "04/15/2026 @ 12:00 PM - 1:00 PM",
          "location":     "Chihuly Conf Room",
          "headcount":    "11",
          "requestor":    "Shira Yomtoubian",
          "fund_number":  "701618",
          "beo_number":   "BEO 1 of 1",
          "vendor":       "",
          "coordinator":  "...",
          "assigned_to":  "",      // filled by user in app
          "sections": [            // ordered content sections
            { "title": "MENU / INSTRUCTIONS", "items": ["..."] },
            { "title": "NON-RECHARGABLES",    "items": ["..."] },
          ],
          "notes": ["..."],
          "preset":      false,
          "complete":    false,
          "cleaned_up":  false
        }, ...
      ]
    }
    """
    pdf_list = _get_pdf_bytes_for_request(request)
    if not pdf_list:
        return JsonResponse({'error': 'No files uploaded.'}, status=400)

    day_filter = (request.POST.get('day') or '').strip() or None

    try:
        all_beos = []
        for pdf_bytes, _ in pdf_list:
            if not pdf_bytes:
                continue
            pages_data = _extract_with_pymupdf(pdf_bytes)
            if sum(len(p['lines']) for p in pages_data) == 0:
                pages_data = _extract_with_pdfplumber(pdf_bytes)
            if sum(len(p['lines']) for p in pages_data) == 0:
                pages_data = _extract_with_ocr(pdf_bytes)
            beos = [s for p in pages_data
                    if (s := _parse_beo_structure(p['page'], p['lines'])) is not None]
            all_beos.extend(beos)

        result = _build_run_of_show(all_beos, day_filter=day_filter)
        return JsonResponse(result)

    except Exception as exc:
        import traceback
        return JsonResponse({'error': str(exc), 'trace': traceback.format_exc()}, status=500)


def _strip_bullet(text: str) -> str:
    """
    Remove leading bullet-like artifacts from a line.
    PDFs often encode bullet glyphs as letters (o, l, ·, ■, etc.) that appear
    as a single character before the actual item text.
    Strips:
      - Unicode bullet/arrow/dingbat chars
      - A single letter (a-z A-Z) or digit followed by ) or . (list markers like "1." "a)")
      - A lone single letter followed by a space that looks like a misread bullet
    """
    s = text.strip()
    # Remove known bullet unicode chars at the start
    s = re.sub(r'^[\u2022\u2023\u25E6\u2043\u2219\u25AA\u25AB\u25CF\u25CB\u2012\u2013\u2014\u2015\u2212\u00B7\u00B0•\-\*·–—▪▸►]+\s*', '', s)
    # Remove single-character "bullet" letter followed by a space (e.g. "o Item" or "l Item")
    # Only strip if it's a lone lowercase letter that isn't the start of a real word
    s = re.sub(r'^([a-z])\s+(?=[A-Z0-9(])', '', s)
    # Remove numbered/lettered list prefixes: "1." "2)" "a." "b)"
    s = re.sub(r'^[a-zA-Z0-9]{1,2}[.)]\s+', '', s)
    return s.strip()


def _build_run_of_show(beos: list, day_filter: str | None = None) -> dict:
    """
    Build the run-of-show response: all catering + floorplan BEOs,
    sorted chronologically, each with full content sections.
    """
    # Include catering and floorplan (skip pure loadlists / unknowns)
    relevant = [b for b in beos if b['beo_type'] in ('catering', 'floorplan', 'loadlist')]
    if day_filter:
        relevant = [b for b in relevant if b['header'].get('beo_date', '') == day_filter]

    def _date_key(b):
        raw = b['header'].get('beo_date', '')
        m = re.search(r'(\d{1,2})/(\d{1,2})/(\d{4})', raw)
        if m:
            return int(m.group(3)) * 10000 + int(m.group(1)) * 100 + int(m.group(2))
        return 99999999

    def _time_key(b):
        t = b['header'].get('time', '')
        m = re.search(r'(\d{1,2}):(\d{2})\s*(AM|PM)', t, re.I)
        if not m:
            return 9999
        h, mn, ap = int(m.group(1)), int(m.group(2)), m.group(3).upper()
        if ap == 'PM' and h != 12:
            h += 12
        if ap == 'AM' and h == 12:
            h = 0
        return h * 60 + mn

    relevant.sort(key=lambda b: (_date_key(b), _time_key(b)))

    dates_seen = []
    out_beos = []

    for b in relevant:
        h = b['header']
        event_date = h.get('beo_date', '')

        if event_date and event_date not in dates_seen:
            dates_seen.append(event_date)

        # Build ordered sections list — filter out empty ones
        sections = []
        for sec in b.get('content', []):
            items = [_strip_bullet(i) for i in sec.get('items', []) if i.strip()]
            items = [i for i in items if i]  # drop anything that became empty
            if items:
                sections.append({'title': sec.get('section', ''), 'items': items})

        notes = [_strip_bullet(n) for n in b.get('notes', []) if str(n).strip()]
        notes = [n for n in notes if n]

        out_beos.append({
            'id':          h.get('beo_id', ''),
            'beo_type':    b.get('beo_type', 'catering'),
            'date':        event_date,
            'event_name':  h.get('event_name', ''),
            'time':        h.get('time', ''),
            'event_date':  h.get('event_date', ''),
            'location':    h.get('location', ''),
            'headcount':   h.get('headcount', ''),
            'requestor':   h.get('requestor', ''),
            'fund_number': h.get('fund_number', ''),
            'beo_number':  h.get('beo_number', ''),
            'vendor':      h.get('vendor', ''),
            'coordinator': b.get('coordinator', ''),
            'assigned_to': '',
            'sections':    sections,
            'notes':       notes,
            'preset':      False,
            'complete':    False,
            'cleaned_up':  False,
        })

    return {'dates': dates_seen, 'beos': out_beos}


# Keywords that identify each BEO type (checked against full page text, case-insensitive)
_CATERING_KEYWORDS = ['menu/instructions', 'non-rechargables', 'non-rechargeables',
                      'vendor phone', 'leftovers to', 'lunch', 'dinner', 'breakfast',
                      'catering', 'buffet']
_FLOORPLAN_KEYWORDS = ['floor plan', 'floorplan', 'room configuration', 'room config',
                       'u-shape', 'seating for', 'boardroom']
_LOADLIST_KEYWORDS  = ['study furniture', 'load list', 'loadlist', 'nn ', '- nn',
                       'furniture needed', 'pixar light', 'foyer chair', 'linen']

# Section header labels found in BEO pages
_SECTION_NOTES            = re.compile(r'^notes?:?\s*$', re.I)
_SECTION_OPS_NOTES        = re.compile(r'event\s*ops\s*notes', re.I)
_SECTION_MENU             = re.compile(r'menu[/\s]*instructions?', re.I)
_SECTION_NON_RECH         = re.compile(r'non.recharg', re.I)
_SECTION_ROOM_CONFIG      = re.compile(r'room\s*config', re.I)
_SECTION_ASSIGNED         = re.compile(r'assigned\s*to', re.I)
_SECTION_CREATED_PRINTED  = re.compile(r'^(created|printed)\s', re.I)

# Header field patterns
_RE_BEO_DATE  = re.compile(r'\b(\w{3}\s+\d{2}/\d{2}/\d{4})\b')
_RE_TIME      = re.compile(r'(\d{1,2}:\d{2}\s*(?:AM|PM)(?:\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM))?)', re.I)
_RE_FUND      = re.compile(r'\b(\d{6})\b')          # 6-digit fund numbers
_RE_BEO_ID    = re.compile(r'\b(\d{5})\b')          # 5-digit BEO IDs
_RE_BEO_NUM   = re.compile(r'BEO\s+(\d+\s+of\s+\d+)', re.I)
_RE_HEADCOUNT = re.compile(r'\b(\d+)\b')
_RE_EVENT_DATE= re.compile(r'(\d{2}/\d{2}/\d{4}\s*@\s*\d{1,2}:\d{2}\s*(?:AM|PM).*)')


def _parse_beo_structure(page_num: int, lines: list) -> dict | None:
    """
    Parse a single page's lines into a structured BEO dict.
    Returns None for metadata-only pages (just CREATED/PRINTED dates).
    """
    if not lines:
        return None

    # Skip pure metadata pages (only CREATED / PRINTED lines)
    non_meta_lines = [l for l in lines if not re.match(
        r'^(CREATED|PRINTED|\d{2}/\d{2}/\d{4}|@\s*\d|salk\.?$)', l, re.I)]
    if len(non_meta_lines) <= 1:
        return None

    full_text = ' '.join(lines).lower()

    # --- Detect BEO type ---
    # Floorplan has priority; then catering (requires actual vendor name OR menu/non-rech section);
    # then loadlist (furniture/items without a menu vendor)
    has_real_vendor = bool(re.search(r'\bvendor\b', full_text) and
                           re.search(r'\b(mendocino|leucadia|pizza|catering|farm|kitchen|grill|deli)\b', full_text, re.I))
    has_menu    = bool(_SECTION_MENU.search(full_text) or _SECTION_NON_RECH.search(full_text))
    has_catering_kw = any(kw in full_text for kw in _CATERING_KEYWORDS)
    # Exclude 'linen' as a catering keyword when there's also furniture/study keywords
    is_loadlist_pg  = any(kw in full_text for kw in _LOADLIST_KEYWORDS)

    beo_type = 'unknown'
    if any(kw in full_text for kw in _FLOORPLAN_KEYWORDS):
        beo_type = 'floorplan'
    elif has_menu or has_real_vendor:
        # Strong catering signals: actual menu/non-rechargables section OR named vendor
        beo_type = 'catering'
    elif is_loadlist_pg:
        beo_type = 'loadlist'
    elif has_catering_kw:
        beo_type = 'catering'

    # --- Extract header fields ---
    header = {
        'beo_date': '', 'time': '', 'event_name': '', 'event_date': '',
        'requestor': '', 'send_invoice_to': '', 'location': '',
        'fund_number': '', 'beo_id': '', 'beo_number': '',
        'headcount': '', 'vendor': '', 'event_type': '',
    }

    # Single-pass: collect all label→value pairs by scanning for known labels
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        line_lower = line.lower()
        peek = lines[i + 1].strip() if i + 1 < len(lines) else ''
        peek_lower = peek.lower()

        # ---- Combined label row: "BEO DATE  TIME  Event Sheet  REQUESTOR  SEND INVOICE TO" ----
        if 'beo date' in line_lower and 'event sheet' in line_lower:
            val_line = peek
            m_date = _RE_BEO_DATE.search(val_line)
            if m_date:
                header['beo_date'] = m_date.group(1)
                remaining = val_line[m_date.end():]
            else:
                remaining = val_line
            m_time = _RE_TIME.search(remaining)
            if m_time:
                header['time'] = m_time.group(1)
                after = remaining[m_time.end():].strip()
            else:
                after = remaining.strip()
            # After time: requestor, send_invoice_to separated by 2+ spaces
            # OCR often merges them: "Kate Di Carlo Kate Di Carlo" — detect repetition
            parts = [p.strip() for p in re.split(r'\s{2,}', after) if p.strip()]
            if len(parts) >= 1:
                header['requestor'] = parts[0]
            if len(parts) >= 2 and parts[1] != parts[0]:
                header['send_invoice_to'] = parts[1]
            elif len(parts) == 1:
                # Check if the string is a repeated name "X X" → requestor=X, send=X
                words = parts[0].split()
                half = len(words) // 2
                if half > 0 and words[:half] == words[half:half*2]:
                    header['requestor'] = ' '.join(words[:half])
                    header['send_invoice_to'] = header['requestor']
            i += 2
            continue

        # ---- BEO DATE standalone label ----
        if re.match(r'^beo\s+date\s*$', line_lower):
            m_date = _RE_BEO_DATE.search(peek)
            if m_date:
                header['beo_date'] = m_date.group(1)
            i += 2
            continue

        # ---- TIME standalone ----
        if re.match(r'^time\s*$', line_lower):
            m_time = _RE_TIME.search(peek)
            if m_time and not header['time']:
                header['time'] = m_time.group(1)
            i += 2
            continue

        # ---- LOCATION + FUND + BEO ID combined label row ----
        if re.match(r'^location\b', line_lower) and ('fund' in line_lower or 'beo id' in line_lower):
            has_headcount = 'headcount' in line_lower
            nums = re.findall(r'\b(\d{5,6})\b', peek)
            # Non-numeric tokens = location name
            loc_tokens = [t for t in peek.split() if not re.match(r'^\d+$', t)]
            num_tokens  = [t for t in peek.split() if re.match(r'^\d+$', t)]
            # Location = first non-numeric word(s) before any 5+ digit number
            m_loc = re.match(r'^([^\d]+)', peek)
            if m_loc:
                header['location'] = m_loc.group(1).strip()
            if has_headcount:
                if num_tokens:
                    header['headcount'] = num_tokens[0]
                six_digit = [n for n in nums if len(n) == 6]
                if six_digit:
                    header['fund_number'] = six_digit[0]
                elif len(num_tokens) >= 2:
                    header['fund_number'] = num_tokens[1]
            else:
                six_digit = [n for n in nums if len(n) == 6]
                five_digit = [n for n in nums if len(n) == 5]
                if six_digit:
                    header['fund_number'] = six_digit[0]
                if five_digit:
                    header['beo_id'] = five_digit[0]
            i += 2
            continue

        # ---- LOCATION standalone ----
        if re.match(r'^location\s*$', line_lower):
            if not header['location'] and peek and not re.match(
                    r'^(fund|beo|headcount|vendor|room|time|requestor|created|printed|assigned)', peek_lower):
                header['location'] = peek
            i += 2
            continue

        # ---- FUND NUMBER standalone ----
        if re.match(r'^fund\s*number\s*$', line_lower):
            m = _RE_FUND.search(peek)
            if m and not header['fund_number']:
                header['fund_number'] = m.group(1)
            i += 2
            continue

        # ---- BEO ID standalone ----
        if re.match(r'^beo\s*id\s*$', line_lower):
            m = _RE_BEO_ID.search(peek)
            if m and not header['beo_id']:
                header['beo_id'] = m.group(1)
            i += 2
            continue

        # ---- BEO X of Y ----
        m_beo_num = _RE_BEO_NUM.search(line)
        if m_beo_num:
            header['beo_number'] = 'BEO ' + m_beo_num.group(1)
            i += 1
            continue

        # ---- Event date line: "04/16/2026 @ 6:00 PM - 9:00 PM" ----
        m_event_date = _RE_EVENT_DATE.match(line)
        if m_event_date:
            header['event_date'] = m_event_date.group(1)
            i += 1
            continue

        # ---- VENDOR standalone ----
        if re.match(r'^vendor\s*$', line_lower):
            if peek and not re.match(r'^(vendor|fund|beo|location|headcount|time|requestor)', peek_lower):
                header['vendor'] = peek
            i += 2
            continue

        # ---- HEADCOUNT standalone ----
        if re.match(r'^headcount\s*$', line_lower):
            if not header['headcount']:
                header['headcount'] = peek.strip()
            i += 2
            continue

        # ---- REQUESTOR standalone ----
        if re.match(r'^requestor\s*$', line_lower):
            if not header['requestor'] and peek:
                header['requestor'] = peek
            i += 2
            continue

        # ---- SEND INVOICE TO standalone ----
        if re.match(r'^send\s*invoice\s*to', line_lower):
            if not header['send_invoice_to'] and peek:
                header['send_invoice_to'] = peek
            i += 2
            continue

        # ---- Event name heuristic ----
        # A non-label, substantive line that appears after beo_date has been found
        # but before event_date, and looks like a title (not all-caps label, not a number)
        if (header['beo_date'] and not header['event_date']
                and not header['event_name']
                and not re.match(
                    r'^(NOTES|LOCATION|FUND|BEO|VENDOR|HEADCOUNT|ROOM|NON|SEND|ASSIGNED'
                    r'|EVENT|CREATED|PRINTED|TIME|REQUESTOR|salk|PICKUP|DISHES|LEFTOVERS)',
                    line, re.I)
                and not re.match(r'^[\d/@ :,.-]+$', line)
                and len(line) > 5
                and not _SECTION_OPS_NOTES.search(line)):
            header['event_name'] = line
            i += 1
            continue

        i += 1

    # --- Split body into labelled sections ---
    notes_lines   = []  # Ops / free-text notes (NOTES + EVENT OPS NOTES combined)
    content_lines = []  # Type-specific body: menu items, room config, item lists
    non_rechargables_lines = []
    leftovers_to  = ''
    pickup_time   = ''
    dishes        = ''
    assigned_to   = ''
    coordinator   = ''
    created       = ''
    printed       = ''

    current_section = 'header'
    skip_next = False
    j = 0
    while j < len(lines):
        if skip_next:
            skip_next = False
            j += 1
            continue

        line = lines[j].strip()
        line_lower = line.lower()
        peek2 = lines[j + 1].strip() if j + 1 < len(lines) else ''

        # ---- Section transitions ----
        if _SECTION_OPS_NOTES.search(line):
            current_section = 'ops_notes'
            j += 1
            continue
        if _SECTION_NOTES.match(line):
            current_section = 'notes'
            j += 1
            continue
        if _SECTION_MENU.search(line):
            current_section = 'menu'
            j += 1
            continue
        if _SECTION_NON_RECH.search(line):
            current_section = 'non_rech'
            j += 1
            continue
        if _SECTION_ROOM_CONFIG.search(line):
            current_section = 'room_config'
            j += 1
            continue
        if _SECTION_ASSIGNED.search(line):
            current_section = 'assigned'
            j += 1
            continue

        # ---- LEFTOVERS TO / PICKUP TIME / DISHES (catering admin — capture then skip value line) ----
        if re.match(r'^leftovers\s*to', line_lower):
            if peek2 and not re.match(r'^(pickup|dishes|assigned|beo\s*id|event\s*coord|created|printed)', peek2, re.I):
                leftovers_to = peek2
                skip_next = True
            j += 1
            continue
        if re.match(r'^pickup\s*time', line_lower):
            m_time2 = _RE_TIME.search(peek2)
            if m_time2:
                pickup_time = m_time2.group(1)
                skip_next = True
            elif peek2 and not re.match(r'^(dishes|assigned|leftovers)', peek2, re.I):
                pickup_time = peek2
                skip_next = True
            j += 1
            continue
        if re.match(r'^dishes\s*$', line_lower):
            if peek2 and not re.match(r'^(assigned|pickup|leftovers|beo\s*id)', peek2, re.I):
                dishes = peek2
                skip_next = True
            j += 1
            continue

        # ---- ASSIGNED block ----
        if current_section == 'assigned':
            if re.match(r'^(event\s*coordinator|beo\s*id|send\s*invoice|pickup\s*time|dishes)', line_lower):
                j += 1
                continue
            if re.match(r'^created', line_lower):
                m = re.search(r'\d{2}/\d{2}/\d{4}', line)
                if not m and peek2:
                    m = re.search(r'\d{2}/\d{2}/\d{4}', peek2)
                if m:
                    created = m.group(0)
                j += 1
                continue
            if re.match(r'^printed', line_lower):
                m = re.search(r'\d{2}/\d{2}/\d{4}', line)
                if not m and peek2:
                    m = re.search(r'\d{2}/\d{2}/\d{4}', peek2)
                if m:
                    printed = m.group(0)
                j += 1
                continue
            # First non-label value = coordinator name; second = assigned_to (if different)
            if line and not re.match(r'^\d', line):
                if not coordinator:
                    coordinator = line
                elif not assigned_to and line != coordinator:
                    assigned_to = line
            j += 1
            continue

        # ---- Skip structural header-area labels ----
        if current_section == 'header':
            # We're still in the header — only skip known label lines
            _header_labels = [
                'beo date', 'event sheet', 'location', 'fund number', 'beo id',
                'requestor', 'send invoice to', 'headcount', 'vendor phone', 'vendor',
                'room', 'non-rechargable', 'non-rechargeable', 'created', 'printed',
                'salk', 'time', 'send invoice', 'pickup time', 'dishes',
            ]
            if (any(line_lower.startswith(lbl) for lbl in _header_labels)
                    or re.match(r'^salk\.?\s*$', line_lower)
                    or _RE_BEO_NUM.search(line)
                    or _RE_EVENT_DATE.match(line)
                    or _RE_BEO_DATE.search(line)):
                j += 1
                continue
            j += 1
            continue

        # ---- Accumulate sections ----
        if current_section in ('notes', 'ops_notes'):
            # Reject lines that are clearly admin/label noise
            if line and not re.match(
                    r'^(ASSIGNED\s*TO|EVENT\s*COORDINATOR|BEO\s*ID|CREATED|PRINTED'
                    r'|SEND\s*INVOICE|PICKUP\s*TIME|DISHES)',
                    line, re.I):
                notes_lines.append(line)
            j += 1
            continue

        if current_section == 'menu':
            if line:
                content_lines.append(line)
            j += 1
            continue

        if current_section == 'non_rech':
            if line:
                non_rechargables_lines.append(line)
            j += 1
            continue

        if current_section == 'room_config':
            if line and not re.match(
                    r'^(ASSIGNED\s*TO|EVENT\s*COORDINATOR|BEO\s*ID|CREATED|PRINTED)',
                    line, re.I):
                content_lines.append(line)
            j += 1
            continue

        j += 1

    # ---- For floorplan: merge notes + room_config into content ----
    if beo_type == 'floorplan':
        fp_items = notes_lines[:]
        if content_lines:
            fp_items += content_lines
        # Remove short stray room-name labels (single word/short phrase that crept in from ROOM label)
        fp_items = [it for it in fp_items if len(it) > 3 and not re.match(
            r'^(room|trustees|foyer|salk\.?)$', it, re.I)]
        structured_content = [{'section': 'ROOM CONFIGURATION', 'items': fp_items}]
        notes_lines = []

    elif beo_type == 'loadlist' and not content_lines and not notes_lines:
        # Fallback: collect everything after BEO number line
        collecting = False
        raw_loadlist = []
        for line in lines:
            if _RE_BEO_NUM.search(line):
                collecting = True
                continue
            if _SECTION_ASSIGNED.search(line):
                break
            if collecting and line.strip():
                raw_loadlist.append(line.strip())
        structured_content = [{'section': 'ITEMS', 'items': raw_loadlist}]

    elif beo_type == 'loadlist' and not content_lines and notes_lines:
        # Notes were the body for this loadlist page
        structured_content = [{'section': 'ITEMS', 'items': notes_lines}]
        notes_lines = []
    elif beo_type == 'loadlist' and content_lines:
        structured_content = [{'section': 'ITEMS', 'items': content_lines}]

    else:
        # ---- Build structured_content for catering / unknown ----
        structured_content = []
        if non_rechargables_lines:
            structured_content.append({
                'section': 'NON-RECHARGABLES',
                'items': non_rechargables_lines,
            })
        if content_lines:
            section_label = 'MENU / INSTRUCTIONS' if beo_type == 'catering' else 'ITEMS'
            structured_content.append({
                'section': section_label,
                'items': content_lines,
            })

    # Add admin fields to header for catering
    if leftovers_to:
        header['leftovers_to'] = leftovers_to
    if pickup_time:
        header['pickup_time'] = pickup_time
    if dishes:
        header['dishes'] = dishes

    return {
        'page': page_num,
        'beo_type': beo_type,
        'header': header,
        'notes': notes_lines,
        'content': structured_content,
        'coordinator': coordinator,
        'assigned_to': assigned_to,
        'created': created,
        'printed': printed,
    }


# ---------------------------------------------------------------------------
# PDF text extraction helpers
# ---------------------------------------------------------------------------

def _extract_with_pymupdf(pdf_bytes: bytes) -> list:
    pages_data = []
    doc = fitz.open(stream=pdf_bytes, filetype='pdf')
    for i, page in enumerate(doc, start=1):
        text = page.get_text('text')
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        pages_data.append({'page': i, 'lines': lines})
    doc.close()
    return pages_data


def _extract_with_pdfplumber(pdf_bytes: bytes) -> list:
    pages_data = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            words = page.extract_words(x_tolerance=3, y_tolerance=3)
            if words:
                lines = _words_to_lines(words)
            else:
                raw = page.extract_text(x_tolerance=2, y_tolerance=2) or ''
                lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
            pages_data.append({'page': i, 'lines': lines})
    return pages_data


def _words_to_lines(words: list, y_tolerance: float = 3.0) -> list:
    if not words:
        return []
    words_sorted = sorted(words, key=lambda w: (round(w['top'] / y_tolerance), w['x0']))
    lines = []
    current_y = None
    current_line = []
    for word in words_sorted:
        y = round(word['top'] / y_tolerance)
        if current_y is None or y != current_y:
            if current_line:
                lines.append(' '.join(current_line))
            current_line = [word['text']]
            current_y = y
        else:
            current_line.append(word['text'])
    if current_line:
        lines.append(' '.join(current_line))
    return lines


def _extract_with_ocr(pdf_bytes: bytes, dpi: int = 200) -> list:
    pages_data = []
    doc = fitz.open(stream=pdf_bytes, filetype='pdf')
    zoom = dpi / 72
    mat = fitz.Matrix(zoom, zoom)
    # psm 4 = assume a single column of text — works better for BEO's columnar layout
    ocr_config = '--psm 4'
    for i, page in enumerate(doc, start=1):
        pix = page.get_pixmap(matrix=mat, colorspace=fitz.csRGB)
        img = Image.frombytes('RGB', [pix.width, pix.height], pix.samples)
        raw_text = pytesseract.image_to_string(img, lang='eng', config=ocr_config)
        lines = [ln.strip() for ln in raw_text.splitlines() if ln.strip()]
        pages_data.append({'page': i, 'lines': lines})
    doc.close()
    return pages_data
