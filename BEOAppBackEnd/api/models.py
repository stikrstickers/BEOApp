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
#
# Two kinds of users:
#   1. Clients (no organization) — submit EventRequests via a public form.
#      They can optionally create an account to track their submissions.
#   2. Planners (belong to an Organization) — manage venues, inventory,
#      vendors, events, calendars, branding, and billing.
#
# Every "operational" model (Inventory, TeamMember, Workflow, EventRequest as
# received, EventAssignment) belongs to an Organization. Querysets must be
# scoped by `organization=request.user.profile.organization` to prevent IDOR.
# ===========================================================================


class Organization(models.Model):
    """A planner's workspace. Holds inventory, team, workflows, branding."""
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
        ('client',  'Client'),       # Individual submitting event requests
        ('planner', 'Event Planner'), # Belongs to an Organization
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
# Legacy BEO PDF storage — predates auth, kept for the original PDF tooling.
# ===========================================================================

class BEOWeek(models.Model):
    """One work week of BEO PDFs (legacy PDF tool). Org-scoped."""
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
        return today - datetime.timedelta(days=today.weekday())  # Monday

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
        """Keep only 3 weeks: previous, current, next. Delete everything else."""
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
    """A single PDF file stored for a week."""
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
    """An event request submitted by a client via the public Client form."""

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
    # Forward transitions only. Unknown source means "from new". Planners can
    # always re-open by going back to in_review, but can never resurrect a
    # declined or completed request without an explicit re-submit.
    STATUS_TRANSITIONS = {
        'new':       {'in_review', 'confirmed', 'declined'},
        'in_review': {'confirmed', 'declined', 'new'},
        'confirmed': {'completed', 'declined', 'in_review'},
        'declined':  set(),  # terminal
        'completed': set(),  # terminal
    }

    # Tenancy — which planner org received this request
    organization = models.ForeignKey(
        Organization, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='event_requests',
        help_text='Planner org receiving the request. Null = legacy/unrouted.',
    )
    client_user  = models.ForeignKey(
        User, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='submitted_requests',
        help_text='Set if a logged-in client submitted; null for anonymous.',
    )

    # Client contact (always captured even for logged-in clients)
    client_name   = models.CharField(max_length=120)
    client_email  = models.EmailField()
    client_phone  = models.CharField(max_length=40, blank=True)
    client_org    = models.CharField(max_length=120, blank=True,
                                     help_text="Client's company name (free text)")

    # Event basics
    event_name     = models.CharField(max_length=200)
    event_type     = models.CharField(max_length=20, choices=EVENT_TYPE_CHOICES, default='corporate')
    preferred_date = models.DateField()
    alternate_date = models.DateField(null=True, blank=True)
    start_time     = models.TimeField()
    end_time       = models.TimeField()
    headcount      = models.PositiveIntegerField()

    # Selections
    venue_preference = models.CharField(max_length=200, blank=True)
    food_service     = models.CharField(max_length=20, choices=FOOD_SERVICE_CHOICES, default='none')
    dietary_notes    = models.TextField(blank=True)
    tech_needs       = models.CharField(max_length=20, choices=TECH_NEEDS_CHOICES, default='none')
    rsvp_required    = models.BooleanField(default=False)

    notes = models.TextField(blank=True)

    # Organizer-managed
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
# Inventory + Pricing — unified org-scoped item ledger
# ===========================================================================

class InventoryItem(models.Model):
    CATEGORY_CHOICES = [
        ('table',       'Tables'),
        ('chair',       'Chairs'),
        ('food',        'Food'),
        ('beverage',    'Beverages'),
        ('av',          'A/V Equipment'),
        ('linen',       'Linens'),
        ('serviceware', 'Serviceware'),
        ('other',       'Other'),
    ]
    organization        = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='inventory_items',
    )
    name                = models.CharField(max_length=120)
    category            = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='other')
    unit                = models.CharField(max_length=40, blank=True, help_text='each, lb, gallon, etc.')
    quantity_on_hand    = models.PositiveIntegerField(default=0)
    unit_price          = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    low_stock_threshold = models.PositiveIntegerField(default=0)
    notes               = models.TextField(blank=True)
    created_at          = models.DateTimeField(auto_now_add=True)
    updated_at          = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['category', 'name']
        indexes = [models.Index(fields=['organization', 'category'])]

    def __str__(self):
        return f"{self.name} ({self.get_category_display()})"

    @property
    def is_low_stock(self) -> bool:
        return self.quantity_on_hand <= self.low_stock_threshold


# ===========================================================================
# Team Builder — org-scoped roster + per-event assignments
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
        ('vendor',      'Vendor'),
        ('other',       'Other'),
    ]
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name='team_members',
    )
    name       = models.CharField(max_length=120)
    email      = models.EmailField(blank=True)
    phone      = models.CharField(max_length=40, blank=True)
    role       = models.CharField(max_length=20, choices=ROLE_CHOICES, default='other')
    is_vendor  = models.BooleanField(default=False)
    company    = models.CharField(max_length=120, blank=True, help_text='For third-party vendors')
    notes      = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        indexes = [models.Index(fields=['organization', 'role'])]

    def __str__(self):
        return f"{self.name} ({self.get_role_display()})"


class EventAssignment(models.Model):
    STATUS_CHOICES = [
        ('assigned',  'Assigned'),
        ('confirmed', 'Confirmed'),
        ('declined',  'Declined'),
    ]
    event_request = models.ForeignKey(EventRequest, on_delete=models.CASCADE, related_name='assignments')
    team_member   = models.ForeignKey(TeamMember,   on_delete=models.CASCADE, related_name='assignments')
    role_on_event = models.CharField(max_length=80, blank=True, help_text='e.g. "Lead Bartender"')
    status        = models.CharField(max_length=20, choices=STATUS_CHOICES, default='assigned')
    notes         = models.TextField(blank=True)
    assigned_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['assigned_at']
        unique_together = [('event_request', 'team_member', 'role_on_event')]

    def __str__(self):
        return f"{self.team_member.name} → {self.event_request.event_name}"


# ===========================================================================
# Workflows — customizable post-event automation, org-scoped
# ===========================================================================

class Workflow(models.Model):
    """An organizer-defined automation that fires on an EventRequest lifecycle event."""
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
    """A single step inside a Workflow. config is action-type specific JSON."""
    ACTION_CHOICES = [
        ('send_email',         'Send email'),
        ('add_organizer_note', 'Append organizer note'),
        ('set_status',         'Change status'),
    ]
    workflow    = models.ForeignKey(Workflow, on_delete=models.CASCADE, related_name='actions')
    order       = models.PositiveIntegerField(default=0)
    action_type = models.CharField(max_length=40, choices=ACTION_CHOICES)
    # JSON-encoded action config:
    #   send_email:         { "to": "client"|"organizer"|"<email>", "subject": "...", "body": "..." }
    #   add_organizer_note: { "text": "..." }
    #   set_status:         { "status": "in_review"|"confirmed"|... }
    config      = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['workflow', 'order']

    def __str__(self):
        return f"{self.workflow.name} #{self.order} {self.action_type}"


class WorkflowRun(models.Model):
    """Audit log of a single workflow execution against an event request."""
    workflow      = models.ForeignKey(
        Workflow, null=True,
        on_delete=models.SET_NULL, related_name='runs',
        help_text='Null if the source workflow has since been deleted.',
    )
    workflow_name = models.CharField(max_length=120, blank=True,
                                     help_text='Snapshot of workflow.name at run time.')
    event_request = models.ForeignKey(
        EventRequest, null=True,
        on_delete=models.SET_NULL, related_name='workflow_runs',
        help_text='Null if the event request has since been deleted.',
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
# EventRequest lifecycle → workflow trigger
# ===========================================================================

@receiver(pre_save, sender=EventRequest)
def _capture_previous_status(sender, instance, **kwargs):
    """Stash the previous status on the instance so post_save can detect a change."""
    if instance.pk:
        try:
            instance._previous_status = sender.objects.get(pk=instance.pk).status
        except sender.DoesNotExist:
            instance._previous_status = None
    else:
        instance._previous_status = None


@receiver(post_save, sender=EventRequest)
def _run_event_request_workflows(sender, instance, created, **kwargs):
    """Fire matching Workflows when an EventRequest is created or its status changes."""
    # Lazy import to avoid circular dependency with workflow runner.
    from .workflows import run_workflows_for_event

    if created:
        run_workflows_for_event(instance, trigger='on_submit')
    previous = getattr(instance, '_previous_status', None)
    if previous is not None and previous != instance.status:
        run_workflows_for_event(instance, trigger=f'on_status_{instance.status}')


# ===========================================================================
# Auto-create UserProfile on User creation
# ===========================================================================

@receiver(post_save, sender=User)
def _create_user_profile(sender, instance, created, **kwargs):
    if created and not hasattr(instance, 'profile'):
        UserProfile.objects.create(user=instance)
