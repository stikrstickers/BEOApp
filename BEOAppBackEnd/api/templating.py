"""
Tiny Mustache-style template engine.

Supports:
  {{event.name}}                    — dotted path lookup against the context dict
  {{contact.first_name | upper}}    — single filter from FILTERS
  {{date | date:"Mon Jan 2"}}       — filter with an arg

Unknown tokens are replaced with `''` (silent) so a template can render against
a partial context without exploding. Use list_template_tokens (in views.py)
to surface which tokens a given template uses.

This is deliberately *not* Jinja or Django templates — those are too heavyweight
for the in-memory render the Preview panel needs and they would parse {% %}
control flow we don't want users to write (and that'd be a security footgun).
"""
from __future__ import annotations

import datetime
import re
from typing import Any, Callable


# ---------------------------------------------------------------------------
# Token catalog — exposed to the frontend so the editor can autocomplete.
# Each entry: { path, label, example }. Keep this in sync with what the
# render context provider actually supplies at send time.
# ---------------------------------------------------------------------------

AVAILABLE_TOKENS = [
    # Org
    {'path': 'org.name',            'label': 'Organization name',  'example': 'Rivera Events Co.'},
    {'path': 'org.brand_color',     'label': 'Brand color (hex)',   'example': '#6366F1'},

    # Event
    {'path': 'event.name',          'label': 'Event name',          'example': 'Summer Gala'},
    {'path': 'event.event_type',    'label': 'Event type',          'example': 'corporate'},
    {'path': 'event.starts_at',     'label': 'Event start (ISO)',   'example': '2026-08-15T14:00:00Z'},
    {'path': 'event.ends_at',       'label': 'Event end (ISO)',     'example': '2026-08-15T18:00:00Z'},
    {'path': 'event.headcount',     'label': 'Expected guests',     'example': '120'},
    {'path': 'event.status',        'label': 'Event status',        'example': 'scheduled'},
    {'path': 'event.food_service',  'label': 'Food service',        'example': 'plated'},
    {'path': 'event.tech_needs',    'label': 'Tech needs',          'example': 'full_av'},

    # Venue
    {'path': 'venue.name',          'label': 'Venue room name',     'example': 'Grand Ballroom'},
    {'path': 'venue.site_name',     'label': 'Site name',           'example': 'The Crescent Hotel'},
    {'path': 'venue.capacity_max',  'label': 'Max capacity',        'example': '300'},

    # Contact (booker)
    {'path': 'contact.first_name',  'label': 'Contact first name',  'example': 'Casey'},
    {'path': 'contact.last_name',   'label': 'Contact last name',   'example': 'Rivera'},
    {'path': 'contact.full_name',   'label': 'Contact full name',   'example': 'Casey Rivera'},
    {'path': 'contact.email',       'label': 'Contact email',       'example': 'casey@example.com'},
    {'path': 'contact.phone',       'label': 'Contact phone',       'example': '+1 555 0100'},
    {'path': 'contact.title',       'label': 'Contact title',       'example': 'Events Lead'},

    # Company
    {'path': 'company.name',        'label': 'Client company',      'example': 'Acme Corp'},

    # Recipient (whoever this message is going to)
    {'path': 'recipient.first_name','label': 'Recipient first name','example': 'Sam'},
    {'path': 'recipient.full_name', 'label': 'Recipient full name', 'example': 'Sam Park'},
    {'path': 'recipient.email',     'label': 'Recipient email',     'example': 'sam@example.com'},
]


# ---------------------------------------------------------------------------
# Filters — applied after resolving the token value.
# ---------------------------------------------------------------------------

def _filter_upper(value: Any, _arg: str | None = None) -> str:
    return str(value).upper()


def _filter_lower(value: Any, _arg: str | None = None) -> str:
    return str(value).lower()


def _filter_title(value: Any, _arg: str | None = None) -> str:
    return str(value).title()


def _filter_date(value: Any, arg: str | None = None) -> str:
    """Format an ISO-8601 datetime string with strftime-like format. Default: %b %d, %Y."""
    if value in (None, ''):
        return ''
    fmt = arg or '%b %d, %Y'
    try:
        if isinstance(value, str):
            v = value
            if v.endswith('Z'):
                v = v[:-1] + '+00:00'
            dt = datetime.datetime.fromisoformat(v)
        elif isinstance(value, (datetime.datetime, datetime.date)):
            dt = value
        else:
            return str(value)
    except (TypeError, ValueError):
        return str(value)
    return dt.strftime(fmt)


def _filter_time(value: Any, arg: str | None = None) -> str:
    return _filter_date(value, arg or '%-I:%M %p')


FILTERS: dict[str, Callable[[Any, str | None], str]] = {
    'upper': _filter_upper,
    'lower': _filter_lower,
    'title': _filter_title,
    'date':  _filter_date,
    'time':  _filter_time,
}


# ---------------------------------------------------------------------------
# Resolver
# ---------------------------------------------------------------------------

def _resolve_path(ctx: dict, path: str) -> Any:
    cur: Any = ctx
    for segment in path.split('.'):
        if isinstance(cur, dict):
            cur = cur.get(segment, '')
        else:
            cur = getattr(cur, segment, '')
        if cur is None:
            return ''
    return cur


# Pattern: {{ path[ | filter[:"arg"] ] }}
_TOKEN_RE = re.compile(
    r'\{\{\s*'
    r'([\w.]+)'                            # 1: path
    r'(?:\s*\|\s*(\w+)'                    # 2: filter name
    r'(?:\s*:\s*"([^"]*)"\s*)?'            # 3: filter arg
    r')?'
    r'\s*\}\}'
)


def render_template(text: str, ctx: dict) -> str:
    if not text:
        return ''

    def replace(m: re.Match) -> str:
        path, filt, arg = m.group(1), m.group(2), m.group(3)
        value = _resolve_path(ctx, path)
        if filt:
            fn = FILTERS.get(filt)
            if fn is not None:
                try:
                    return str(fn(value, arg))
                except Exception:
                    return ''
        if value in (None, ''):
            return ''
        return str(value)

    return _TOKEN_RE.sub(replace, text)
