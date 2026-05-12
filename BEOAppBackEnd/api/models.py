import datetime
import secrets

from django.conf import settings
from django.contrib.auth.models import User
from django.db import models
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.utils.text import slugify


# ===========================================================================
# Tenancy — Organizations + Memberships
# ===========================================================================

class Organization(models.Model):
    """A planner's workspace. Holds venues, inventory, team, workflows, branding."""
    name        = models.CharField(max_length=120)
    slug        = models.SlugField(max_length=140, unique=True)
    brand_color = models.CharField(max_length=9, default='#6366F1', help_text='Hex incl. leading #')
    logo_url    = models.URLField(blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name) or 'org'
            slug = base
            n = 2
            while Organization.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f'{base}-{n}'
                n += 1
            self.slug = slug
        super().save(*args, **kwargs)


class UserProfile(models.Model):
    """Extends User with role + optional Organization membership."""
    ROLE_CHOICES = [
        ('client',  'Client'),
        ('planner', 'Event Planner'),
    ]
    user         = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role         = models.CharField(max_length=20, choices=ROLE_CHOICES, default='client')
    organization = models.ForeignKey(
        Organization, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='members',
    )
    full_name    = models.CharField(max_length=120, blank=True)
    phone        = models.CharField(max_length=40, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} ({self.role})"


# ===========================================================================
# Authentication — opaque tokens with optional expiry
# ===========================================================================

class AuthToken(models.Model):
    """Opaque token used as the Authorization: Token <key> bearer credential."""
    key        = models.CharField(max_length=64, unique=True, db_index=True)
    user       = models.ForeignKey(User, on_delete=models.CASCADE, related_name='auth_tokens')
    created_at = models.DateTimeField(auto_now_add=True)
    last_used  = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.key:
            self.key = secrets.token_urlsafe(48)
        super().save(*args, **kwargs)

    def is_expired(self) -> bool:
        if self.expires_at is None:
            return False
        return self.expires_at <= datetime.datetime.now(tz=datetime.timezone.utc)

    def __str__(self):
        return f"{self.user.username} / {self.key[:8]}…"


# ===========================================================================
# Venues — Sites (physical buildings/locations) + SiteVenues (rooms within)
# ===========================================================================

class Site(models.Model):
    """A physical location — building, hotel, venue complex. Has many SiteVenues."""
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='sites',
    )
    name            = models.CharField(max_length=160)
    address_line1   = models.CharField(max_length=200, blank=True)
    address_line2   = models.CharField(max_length=200, blank=True)
    city            = models.CharField(max_length=80, blank=True)
    state_region    = models.CharField(max_length=80, blank=True)
    postal_code     = models.CharField(max_length=20, blank=True)
    country         = models.CharField(max_length=80, blank=True)

    # Operator/owner metadata
    owner_name      = models.CharField(max_length=160, blank=True)
    operator_name   = models.CharField(max_length=160, blank=True,
                                       help_text='Who runs the day-to-day (often = owner)')
    contact_name    = models.CharField(max_length=160, blank=True)
    contact_email   = models.EmailField(blank=True)
    contact_phone   = models.CharField(max_length=40, blank=True)

    website         = models.URLField(blank=True)
    notes           = models.TextField(blank=True)

    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        indexes = [models.Index(fields=['organization', 'name'])]

    def __str__(self):
        return self.name


class SiteVenue(models.Model):
    """A bookable space inside a Site — ballroom, terrace, conference room, etc."""
    LAYOUT_CHOICES = [
        ('theater',   'Theater'),
        ('classroom', 'Classroom'),
        ('banquet',   'Banquet (rounds)'),
        ('reception', 'Reception (standing)'),
        ('cocktail',  'Cocktail'),
        ('boardroom', 'Boardroom'),
        ('ushape',    'U-shape'),
        ('hollow',    'Hollow square'),
        ('custom',    'Custom'),
    ]
    site                = models.ForeignKey(Site, on_delete=models.CASCADE, related_name='venues')
    name                = models.CharField(max_length=160)
    capacity_min        = models.PositiveIntegerField(default=0)
    capacity_max        = models.PositiveIntegerField(default=0)
    square_footage      = models.PositiveIntegerField(default=0, help_text='0 = unknown')
    supported_layouts   = models.JSONField(default=list, blank=True,
                                            help_text='Subset of LAYOUT_CHOICES values')
    # Amenity flags — most planners think in checklists, so we keep this as
    # discrete booleans rather than a free-text JSON blob.
    has_av              = models.BooleanField(default=False)
    has_stage           = models.BooleanField(default=False)
    has_dance_floor     = models.BooleanField(default=False)
    has_kitchen_access  = models.BooleanField(default=False)
    has_outdoor_access  = models.BooleanField(default=False)
    is_accessible       = models.BooleanField(default=True, help_text='ADA / wheelchair accessible')
    has_natural_light   = models.BooleanField(default=False)

    # Photos: a list of URLs (we'll do hosted-image upload later).
    photo_urls          = models.JSONField(default=list, blank=True)

    base_hourly_rate    = models.DecimalField(max_digits=10, decimal_places=2, default=0,
                                              help_text='Org-internal cost baseline; 0 = unset')
    notes               = models.TextField(blank=True)
    is_active           = models.BooleanField(default=True)

    created_at          = models.DateTimeField(auto_now_add=True)
    updated_at          = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['site__name', 'name']
        indexes = [models.Index(fields=['site', 'is_active'])]

    def __str__(self):
        return f"{self.site.name} — {self.name}"


# ===========================================================================
# Contacts — Companies (M2M) Contacts (people).
# Both can be clients, vendors, or both. A Contact can host events for many
# Companies (e.g. an exec who books on behalf of multiple subsidiaries).
# ===========================================================================

class Company(models.Model):
    KIND_CHOICES = [
        ('client', 'Client'),
        ('vendor', 'Vendor'),
        ('both',   'Client + Vendor'),
    ]
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='companies',
    )
    name          = models.CharField(max_length=160)
    kind          = models.CharField(max_length=10, choices=KIND_CHOICES, default='client')
    industry      = models.CharField(max_length=120, blank=True)
    website       = models.URLField(blank=True)
    address       = models.CharField(max_length=300, blank=True)
    billing_email = models.EmailField(blank=True)
    phone         = models.CharField(max_length=40, blank=True)
    # Vendor-only: what they offer. Free-text tags.
    services      = models.JSONField(default=list, blank=True,
                                     help_text='Vendor-only: e.g. ["catering", "florals"]')
    notes         = models.TextField(blank=True)

    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        indexes = [models.Index(fields=['organization', 'kind'])]

    def __str__(self):
        return f"{self.name} ({self.get_kind_display()})"

    @property
    def is_vendor(self) -> bool:
        return self.kind in ('vendor', 'both')

    @property
    def is_client(self) -> bool:
        return self.kind in ('client', 'both')


class Contact(models.Model):
    """An individual person — can be linked to one or more Companies, or standalone."""
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='contacts',
    )
    first_name = models.CharField(max_length=80)
    last_name  = models.CharField(max_length=80, blank=True)
    email      = models.EmailField(blank=True)
    phone      = models.CharField(max_length=40, blank=True)
    title      = models.CharField(max_length=120, blank=True,
                                  help_text='Default title; can be overridden per-company')

    # Tags help group contacts (VIP, dietary, repeat client, etc.).
    tags       = models.JSONField(default=list, blank=True)

    companies  = models.ManyToManyField(Company, through='ContactCompanyRole',
                                         related_name='contacts', blank=True)

    notes      = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['last_name', 'first_name']
        indexes = [
            models.Index(fields=['organization', 'last_name', 'first_name']),
            models.Index(fields=['organization', 'email']),
        ]

    def __str__(self):
        return self.full_name

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip() or self.email or '<unnamed>'


class ContactCompanyRole(models.Model):
    """M2M through-model: a Contact's role at a particular Company."""
    contact     = models.ForeignKey(Contact, on_delete=models.CASCADE)
    company     = models.ForeignKey(Company, on_delete=models.CASCADE)
    role_title  = models.CharField(max_length=120, blank=True,
                                   help_text='e.g. "Events Lead", "Owner"')
    is_primary  = models.BooleanField(default=False,
                                       help_text='Primary contact at this company')
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('contact', 'company')]
        ordering = ['-is_primary', 'company__name']

    def __str__(self):
        return f"{self.contact.full_name} @ {self.company.name}"


# ===========================================================================
# Legacy BEO PDF storage — predates auth, kept for the original PDF tooling.
# ===========================================================================

class BEOWeek(models.Model):
    organization = models.ForeignKey(
        Organization, null=True, blank=True,
        on_delete=models.CASCADE, related_name='beo_weeks',
    )
    label      = models.CharField(max_length=64)
    week_start = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['week_start']
        unique_together = [('organization', 'week_start')]

    def __str__(self):
        return self.label

    @staticmethod
    def current_week_start():
        today = datetime.date.today()
        return today - datetime.timedelta(days=today.weekday())

    @staticmethod
    def make_label(week_start: datetime.date) -> str:
        week_end = week_start + datetime.timedelta(days=6)
        if week_start.month == week_end.month:
            return f"{week_start.strftime('%b')} {week_start.day}–{week_end.day} {week_start.year}"
        return (
            f"{week_start.strftime('%b')} {week_start.day} – "
            f"{week_end.strftime('%b')} {week_end.day} {week_end.year}"
        )

    @classmethod
    def get_or_create_for_week(cls, week_start: datetime.date, organization=None):
        label = cls.make_label(week_start)
        obj, _ = cls.objects.get_or_create(
            week_start=week_start,
            organization=organization,
            defaults={'label': label},
        )
        return obj

    @classmethod
    def prune_old_weeks(cls, organization=None):
        today = datetime.date.today()
        mon   = today - datetime.timedelta(days=today.weekday())
        keep_starts = [
            mon - datetime.timedelta(weeks=1),
            mon,
            mon + datetime.timedelta(weeks=1),
        ]
        qs = cls.objects.exclude(week_start__in=keep_starts)
        if organization is not None:
            qs = qs.filter(organization=organization)
        qs.delete()


class BEOWeekFile(models.Model):
    week        = models.ForeignKey(BEOWeek, on_delete=models.CASCADE, related_name='files')
    file_name   = models.CharField(max_length=255)
    file_data   = models.BinaryField()
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['file_name']

    def __str__(self):
        return f"{self.week.label} / {self.file_name}"


# ===========================================================================
# Event Requests — submitted publicly by clients to a planner org
# ===========================================================================

class EventRequest(models.Model):
    """The intake form record. Lives forever; never deleted on promotion."""

    EVENT_TYPE_CHOICES = [
        ('corporate',  'Corporate'),
        ('wedding',    'Wedding'),
        ('conference', 'Conference'),
        ('social',     'Social / Private'),
        ('nonprofit',  'Nonprofit / Fundraiser'),
        ('other',      'Other'),
    ]
    FOOD_SERVICE_CHOICES = [
        ('none',     'No food service'),
        ('light',    'Light bites / snacks'),
        ('plated',   'Plated meal'),
        ('buffet',   'Buffet'),
        ('cocktail', 'Cocktail-style passed apps'),
    ]
    TECH_NEEDS_CHOICES = [
        ('none',       'None'),
        ('basic_av',   'Basic A/V (mic + speakers)'),
        ('full_av',    'Full A/V (projector, screen, mixer)'),
        ('livestream', 'Livestream / hybrid'),
    ]
    STATUS_CHOICES = [
        ('new',       'New'),
        ('in_review', 'In Review'),
        ('confirmed', 'Confirmed'),
        ('declined',  'Declined'),
        ('completed', 'Completed'),
    ]
    STATUS_TRANSITIONS = {
        'new':       {'in_review', 'confirmed', 'declined'},
        'in_review': {'confirmed', 'declined', 'new'},
        'confirmed': {'completed', 'declined', 'in_review'},
        'declined':  set(),
        'completed': set(),
    }

    organization = models.ForeignKey(
        Organization, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='event_requests',
    )
    # Either a known Contact (after planner ties it back) or just the
    # client-submitted name/email fields below for fresh intake.
    contact      = models.ForeignKey(
        Contact, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='event_requests',
    )
    client_user  = models.ForeignKey(
        User, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='submitted_requests',
    )

    # Free-text intake fields (always captured by the public form).
    client_name   = models.CharField(max_length=120)
    client_email  = models.EmailField()
    client_phone  = models.CharField(max_length=40, blank=True)
    client_org    = models.CharField(max_length=120, blank=True)

    event_name     = models.CharField(max_length=200)
    event_type     = models.CharField(max_length=20, choices=EVENT_TYPE_CHOICES, default='corporate')
    preferred_date = models.DateField()
    alternate_date = models.DateField(null=True, blank=True)
    start_time     = models.TimeField()
    end_time       = models.TimeField()
    headcount      = models.PositiveIntegerField()

    venue_preference = models.CharField(max_length=200, blank=True)
    food_service     = models.CharField(max_length=20, choices=FOOD_SERVICE_CHOICES, default='none')
    dietary_notes    = models.TextField(blank=True)
    tech_needs       = models.CharField(max_length=20, choices=TECH_NEEDS_CHOICES, default='none')
    rsvp_required    = models.BooleanField(default=False)

    notes = models.TextField(blank=True)

    status         = models.CharField(max_length=20, choices=STATUS_CHOICES, default='new')
    organizer_note = models.TextField(blank=True)

    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-submitted_at']
        indexes = [
            models.Index(fields=['organization', 'status']),
            models.Index(fields=['organization', '-submitted_at']),
        ]

    def __str__(self):
        return f"{self.event_name} ({self.client_name}) — {self.preferred_date}"

    @classmethod
    def can_transition(cls, from_status: str, to_status: str) -> bool:
        if from_status == to_status:
            return True
        return to_status in cls.STATUS_TRANSITIONS.get(from_status, set())


# ===========================================================================
# Events — the confirmed booking on the calendar
# ===========================================================================

class Event(models.Model):
    """Promoted from an EventRequest at status=confirmed. Lives on the Calendar."""
    STATUS_CHOICES = [
        ('scheduled',   'Scheduled'),
        ('in_progress', 'In Progress'),
        ('completed',   'Completed'),
        ('cancelled',   'Cancelled'),
    ]

    organization  = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='events',
    )
    source_request = models.ForeignKey(
        EventRequest, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='events',
        help_text='The intake request that became this event. Null for planner-created events.',
    )
    contact       = models.ForeignKey(
        Contact, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='events',
    )
    site_venue    = models.ForeignKey(
        SiteVenue, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='events',
    )

    name        = models.CharField(max_length=200)
    event_type  = models.CharField(max_length=20, choices=EventRequest.EVENT_TYPE_CHOICES, default='corporate')
    starts_at   = models.DateTimeField()
    ends_at     = models.DateTimeField()
    headcount   = models.PositiveIntegerField(default=0)
    status      = models.CharField(max_length=20, choices=STATUS_CHOICES, default='scheduled')

    food_service = models.CharField(max_length=20, choices=EventRequest.FOOD_SERVICE_CHOICES, default='none')
    tech_needs   = models.CharField(max_length=20, choices=EventRequest.TECH_NEEDS_CHOICES, default='none')
    rsvp_required = models.BooleanField(default=False)

    description = models.TextField(blank=True)
    color       = models.CharField(max_length=9, blank=True, help_text='Optional calendar tint')

    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['starts_at']
        indexes = [
            models.Index(fields=['organization', 'starts_at']),
            models.Index(fields=['organization', 'status']),
        ]

    def __str__(self):
        return f"{self.name} ({self.starts_at:%Y-%m-%d %H:%M})"


# ===========================================================================
# Inventory — separate models per kind so each can grow its own fields.
# Common pattern: shared base abstract for org-scoping + audit, concrete
# subclasses for Perishable / Hardware. Future kinds (Rental, Linens-specific,
# etc.) plug in by adding another subclass.
# ===========================================================================

class InventoryBase(models.Model):
    """Abstract base for any inventory kind. Concrete tables inherit."""
    organization        = models.ForeignKey(
        Organization, on_delete=models.CASCADE,
        related_name='+',  # set per-subclass
    )
    name                = models.CharField(max_length=160)
    unit                = models.CharField(max_length=40, blank=True, help_text='each, lb, gallon, etc.')
    quantity_on_hand    = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    unit_cost           = models.DecimalField(max_digits=10, decimal_places=2, default=0,
                                              help_text="Org's cost basis per unit")
    unit_price          = models.DecimalField(max_digits=10, decimal_places=2, default=0,
                                              help_text='Charge-to-client per unit')
    low_stock_threshold = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes               = models.TextField(blank=True)
    is_active           = models.BooleanField(default=True)

    created_at          = models.DateTimeField(auto_now_add=True)
    updated_at          = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ['name']

    @property
    def is_low_stock(self) -> bool:
        return self.quantity_on_hand <= self.low_stock_threshold


class Perishable(InventoryBase):
    """Consumable items: food, drink, garnishes, ice. Has expiry/lot tracking."""
    CATEGORY_CHOICES = [
        ('produce',    'Produce'),
        ('protein',    'Protein / Meat / Seafood'),
        ('dairy',      'Dairy'),
        ('bakery',     'Bakery'),
        ('dry_goods',  'Dry goods'),
        ('beverage',   'Beverages'),
        ('alcohol',    'Alcohol'),
        ('garnish',    'Garnish / Mixers'),
        ('other',      'Other'),
    ]
    STORAGE_CHOICES = [
        ('pantry',  'Pantry / Room temp'),
        ('cooler',  'Refrigerated'),
        ('freezer', 'Frozen'),
        ('cellar',  'Cellar / Wine room'),
    ]
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='perishables',
    )
    category        = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='other')
    storage         = models.CharField(max_length=20, choices=STORAGE_CHOICES, default='pantry')
    supplier        = models.CharField(max_length=160, blank=True)
    lot_number      = models.CharField(max_length=80, blank=True)
    expiry_date     = models.DateField(null=True, blank=True)
    last_restocked  = models.DateField(null=True, blank=True)
    allergens       = models.JSONField(default=list, blank=True,
                                       help_text='e.g. ["gluten","dairy","nuts"]')

    class Meta:
        ordering = ['category', 'name']
        indexes = [
            models.Index(fields=['organization', 'category']),
            models.Index(fields=['organization', 'expiry_date']),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_category_display()})"

    @property
    def is_expired(self) -> bool:
        return self.expiry_date is not None and self.expiry_date < datetime.date.today()

    @property
    def days_until_expiry(self) -> int | None:
        if self.expiry_date is None:
            return None
        return (self.expiry_date - datetime.date.today()).days


class Hardware(InventoryBase):
    """Durable assets: tables, chairs, linens, A/V. Has condition + service history."""
    CATEGORY_CHOICES = [
        ('table',       'Tables'),
        ('chair',       'Chairs'),
        ('linen',       'Linens'),
        ('serviceware', 'Serviceware (plates, glasses, flatware)'),
        ('av',          'A/V Equipment'),
        ('lighting',    'Lighting'),
        ('staging',     'Staging / Risers'),
        ('decor',       'Decor / Props'),
        ('heating',     'Heating / Cooling'),
        ('other',       'Other'),
    ]
    CONDITION_CHOICES = [
        ('new',          'New'),
        ('excellent',    'Excellent'),
        ('good',         'Good'),
        ('fair',         'Fair'),
        ('needs_repair', 'Needs repair'),
        ('retired',      'Retired'),
    ]
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='hardware',
    )
    category         = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='other')
    condition        = models.CharField(max_length=20, choices=CONDITION_CHOICES, default='good')
    serial_number    = models.CharField(max_length=80, blank=True)
    storage_location = models.CharField(max_length=120, blank=True,
                                        help_text='Where it lives when not deployed')
    purchase_date    = models.DateField(null=True, blank=True)
    purchase_cost    = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    last_serviced    = models.DateField(null=True, blank=True)
    service_notes    = models.TextField(blank=True)

    class Meta:
        ordering = ['category', 'name']
        indexes = [
            models.Index(fields=['organization', 'category']),
            models.Index(fields=['organization', 'condition']),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_category_display()})"


# ===========================================================================
# Teammates — in-house staff and temps. Separate from Vendors (which are Companies).
# ===========================================================================

class TeamMember(models.Model):
    ROLE_CHOICES = [
        ('coordinator', 'Coordinator'),
        ('chef',        'Chef'),
        ('bartender',   'Bartender'),
        ('server',      'Server'),
        ('it',          'IT / A/V'),
        ('setup',       'Setup Crew'),
        ('security',    'Security'),
        ('other',       'Other'),
    ]
    EMPLOYMENT_CHOICES = [
        ('staff', 'Staff (W-2)'),
        ('temp',  'Temp / Contractor'),
    ]
    organization    = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='team_members',
    )
    name            = models.CharField(max_length=120)
    email           = models.EmailField(blank=True)
    phone           = models.CharField(max_length=40, blank=True)
    role            = models.CharField(max_length=20, choices=ROLE_CHOICES, default='other')
    employment_type = models.CharField(max_length=10, choices=EMPLOYMENT_CHOICES, default='staff')
    hourly_rate     = models.DecimalField(max_digits=8, decimal_places=2, default=0,
                                          help_text='Org-internal cost; 0 = unset')
    # Tag list for specialty certifications (TIPS, ServSafe, etc.).
    certifications  = models.JSONField(default=list, blank=True)
    notes           = models.TextField(blank=True)
    is_active       = models.BooleanField(default=True)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        indexes = [models.Index(fields=['organization', 'role', 'employment_type'])]

    def __str__(self):
        return f"{self.name} ({self.get_role_display()})"


class EventAssignment(models.Model):
    """Assigns either a TeamMember (in-house) or a Vendor (Company) to an event.

    Exactly one of `team_member` / `vendor_company` is set. `staff_count` is
    only meaningful for vendor assignments (where the vendor brings N people).
    """
    STATUS_CHOICES = [
        ('assigned',  'Assigned'),
        ('confirmed', 'Confirmed'),
        ('declined',  'Declined'),
    ]
    event_request   = models.ForeignKey(EventRequest, on_delete=models.CASCADE, related_name='assignments')
    team_member     = models.ForeignKey(TeamMember,   null=True, blank=True,
                                         on_delete=models.CASCADE, related_name='assignments')
    vendor_company  = models.ForeignKey(Company,      null=True, blank=True,
                                         on_delete=models.CASCADE, related_name='vendor_assignments')
    role_on_event   = models.CharField(max_length=80, blank=True, help_text='e.g. "Lead Bartender"')
    staff_count     = models.PositiveIntegerField(default=1,
                                                   help_text='For vendor assignments: # of vendor staff on-site')
    status          = models.CharField(max_length=20, choices=STATUS_CHOICES, default='assigned')
    notes           = models.TextField(blank=True)
    assigned_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['assigned_at']
        # Unique-per-event: a TeamMember can't be double-booked in the same role,
        # and a vendor Company can't be double-assigned (use staff_count instead).
        constraints = [
            models.UniqueConstraint(
                fields=['event_request', 'team_member', 'role_on_event'],
                condition=models.Q(team_member__isnull=False),
                name='uniq_team_assignment',
            ),
            models.UniqueConstraint(
                fields=['event_request', 'vendor_company'],
                condition=models.Q(vendor_company__isnull=False),
                name='uniq_vendor_assignment',
            ),
            models.CheckConstraint(
                name='exactly_one_assignee',
                check=(
                    models.Q(team_member__isnull=False, vendor_company__isnull=True) |
                    models.Q(team_member__isnull=True,  vendor_company__isnull=False)
                ),
            ),
        ]

    def __str__(self):
        target = self.team_member.name if self.team_member_id else (
            self.vendor_company.name if self.vendor_company_id else '?'
        )
        return f"{target} → {self.event_request.event_name}"


# ===========================================================================
# Templates — re-usable text bodies for BEOs, guest emails, vendor emails, etc.
# Tokens of the form {{event.name}}, {{contact.first_name}}, etc. are
# interpolated at render time (see api/templating.py).
# ===========================================================================

class MessageTemplate(models.Model):
    KIND_CHOICES = [
        ('beo',                  'BEO (Banquet Event Order)'),
        ('guest_email',          'Guest notification (email)'),
        ('guest_sms',            'Guest notification (SMS)'),
        ('vendor_email',         'Vendor notification (email)'),
        ('vendor_sms',           'Vendor notification (SMS)'),
        ('internal_email',       'Internal team email'),
        ('contract',             'Contract / Agreement'),
        ('invoice',              'Invoice'),
        ('other',                'Other'),
    ]
    CHANNEL_CHOICES = [
        ('email', 'Email'),
        ('sms',   'SMS'),
        ('pdf',   'Printable PDF'),
    ]
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='message_templates',
    )
    name        = models.CharField(max_length=160)
    kind        = models.CharField(max_length=20, choices=KIND_CHOICES, default='guest_email')
    channel     = models.CharField(max_length=10, choices=CHANNEL_CHOICES, default='email')
    # SMS templates use only `body`. Email/PDF can use both.
    subject     = models.CharField(max_length=300, blank=True)
    body        = models.TextField(blank=True,
                                   help_text='Use {{tokens}} — see docs for available tokens')
    is_active   = models.BooleanField(default=True)
    is_default  = models.BooleanField(default=False,
                                       help_text='One default per (kind, channel)')

    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['kind', 'name']
        indexes = [models.Index(fields=['organization', 'kind', 'is_active'])]

    def __str__(self):
        return f"{self.name} [{self.get_kind_display()}]"


# ===========================================================================
# Workflows — customizable post-event automation, org-scoped
# ===========================================================================

class Workflow(models.Model):
    TRIGGER_CHOICES = [
        ('on_submit',            'Event request submitted'),
        ('on_status_new',        'Status changed → New'),
        ('on_status_in_review',  'Status changed → In Review'),
        ('on_status_confirmed',  'Status changed → Confirmed'),
        ('on_status_declined',   'Status changed → Declined'),
        ('on_status_completed',  'Status changed → Completed'),
    ]
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='workflows',
    )
    name       = models.CharField(max_length=120)
    trigger    = models.CharField(max_length=40, choices=TRIGGER_CHOICES)
    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        indexes = [models.Index(fields=['organization', 'trigger', 'is_active'])]

    def __str__(self):
        return f"{self.name} [{self.get_trigger_display()}]"


class WorkflowAction(models.Model):
    ACTION_CHOICES = [
        ('send_email',         'Send email'),
        ('add_organizer_note', 'Append organizer note'),
        ('set_status',         'Change status'),
    ]
    workflow    = models.ForeignKey(Workflow, on_delete=models.CASCADE, related_name='actions')
    order       = models.PositiveIntegerField(default=0)
    action_type = models.CharField(max_length=40, choices=ACTION_CHOICES)
    config      = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['workflow', 'order']

    def __str__(self):
        return f"{self.workflow.name} #{self.order} {self.action_type}"


class WorkflowRun(models.Model):
    workflow      = models.ForeignKey(
        Workflow, null=True,
        on_delete=models.SET_NULL, related_name='runs',
    )
    workflow_name = models.CharField(max_length=120, blank=True)
    event_request = models.ForeignKey(
        EventRequest, null=True,
        on_delete=models.SET_NULL, related_name='workflow_runs',
    )
    organization  = models.ForeignKey(
        Organization, null=True,
        on_delete=models.SET_NULL, related_name='workflow_runs',
    )
    ran_at  = models.DateTimeField(auto_now_add=True)
    success = models.BooleanField(default=True)
    log     = models.TextField(blank=True)

    class Meta:
        ordering = ['-ran_at']

    def __str__(self):
        mark = '✓' if self.success else '✗'
        name = self.workflow_name or (self.workflow.name if self.workflow else '<deleted>')
        evt  = self.event_request.event_name if self.event_request else '<deleted>'
        return f"{mark} {name} on {evt}"


# ===========================================================================
# Signals: lifecycle automation
# ===========================================================================

@receiver(pre_save, sender=EventRequest)
def _capture_previous_status(sender, instance, **kwargs):
    if instance.pk:
        try:
            instance._previous_status = sender.objects.get(pk=instance.pk).status
        except sender.DoesNotExist:
            instance._previous_status = None
    else:
        instance._previous_status = None


@receiver(post_save, sender=EventRequest)
def _run_event_request_workflows(sender, instance, created, **kwargs):
    """Fire matching Workflows on submit + status change."""
    from .workflows import run_workflows_for_event

    if created:
        run_workflows_for_event(instance, trigger='on_submit')
    previous = getattr(instance, '_previous_status', None)
    if previous is not None and previous != instance.status:
        run_workflows_for_event(instance, trigger=f'on_status_{instance.status}')


@receiver(post_save, sender=EventRequest)
def _promote_to_event(sender, instance, created, **kwargs):
    """When an EventRequest is confirmed, auto-create an Event for the Calendar."""
    if created:
        return  # only on transitions
    previous = getattr(instance, '_previous_status', None)
    if previous == 'confirmed' or instance.status != 'confirmed':
        return
    if not instance.organization_id:
        return
    # Idempotent: don't spawn a second Event if one already exists for this request.
    if Event.objects.filter(source_request=instance).exists():
        return

    starts_at = datetime.datetime.combine(
        instance.preferred_date, instance.start_time,
        tzinfo=datetime.timezone.utc,
    )
    ends_at = datetime.datetime.combine(
        instance.preferred_date, instance.end_time,
        tzinfo=datetime.timezone.utc,
    )
    Event.objects.create(
        organization=instance.organization,
        source_request=instance,
        contact=instance.contact,
        name=instance.event_name,
        event_type=instance.event_type,
        starts_at=starts_at,
        ends_at=ends_at,
        headcount=instance.headcount,
        food_service=instance.food_service,
        tech_needs=instance.tech_needs,
        rsvp_required=instance.rsvp_required,
        description=instance.notes,
        status='scheduled',
    )


@receiver(post_save, sender=User)
def _create_user_profile(sender, instance, created, **kwargs):
    if created and not hasattr(instance, 'profile'):
        UserProfile.objects.create(user=instance)
