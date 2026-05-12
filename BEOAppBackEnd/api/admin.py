from django.contrib import admin
from .models import (
    AuthToken, Company, Contact, ContactCompanyRole,
    EventAssignment, EventRequest, Event,
    Hardware, MessageTemplate, Organization, Perishable,
    Site, SiteVenue, TeamMember, UserProfile,
    Workflow, WorkflowAction, WorkflowRun,
)


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display  = ('name', 'slug', 'brand_color', 'created_at')
    search_fields = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display  = ('user', 'role', 'organization', 'created_at')
    list_filter   = ('role',)
    search_fields = ('user__email', 'user__username', 'full_name')
    autocomplete_fields = ('organization',)


@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display  = ('name', 'organization', 'city', 'state_region', 'contact_name')
    list_filter   = ('organization',)
    search_fields = ('name', 'city', 'contact_name', 'owner_name')
    autocomplete_fields = ('organization',)


@admin.register(SiteVenue)
class SiteVenueAdmin(admin.ModelAdmin):
    list_display  = ('name', 'site', 'capacity_min', 'capacity_max', 'is_active')
    list_filter   = ('is_active', 'site__organization')
    search_fields = ('name', 'site__name')
    autocomplete_fields = ('site',)


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display  = ('name', 'organization', 'kind', 'industry', 'billing_email')
    list_filter   = ('kind', 'organization')
    search_fields = ('name', 'industry', 'billing_email')
    autocomplete_fields = ('organization',)


class ContactCompanyRoleInline(admin.TabularInline):
    model = ContactCompanyRole
    extra = 1
    autocomplete_fields = ('company',)


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display  = ('full_name', 'organization', 'email', 'phone')
    list_filter   = ('organization',)
    search_fields = ('first_name', 'last_name', 'email')
    autocomplete_fields = ('organization',)
    inlines = [ContactCompanyRoleInline]


@admin.register(EventRequest)
class EventRequestAdmin(admin.ModelAdmin):
    list_display    = ('event_name', 'client_name', 'organization', 'preferred_date',
                       'headcount', 'status', 'submitted_at')
    list_filter     = ('status', 'event_type', 'organization')
    search_fields   = ('event_name', 'client_name', 'client_email', 'client_org')
    date_hierarchy  = 'preferred_date'
    readonly_fields = ('submitted_at', 'updated_at')
    autocomplete_fields = ('organization', 'client_user', 'contact')


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display    = ('name', 'organization', 'site_venue', 'starts_at', 'status', 'headcount')
    list_filter     = ('status', 'event_type', 'organization')
    search_fields   = ('name',)
    date_hierarchy  = 'starts_at'
    autocomplete_fields = ('organization', 'source_request', 'contact', 'site_venue')


@admin.register(Perishable)
class PerishableAdmin(admin.ModelAdmin):
    list_display    = ('name', 'organization', 'category', 'storage',
                       'quantity_on_hand', 'expiry_date', 'is_low_stock')
    list_filter     = ('category', 'storage', 'organization')
    search_fields   = ('name', 'supplier', 'lot_number')
    autocomplete_fields = ('organization',)


@admin.register(Hardware)
class HardwareAdmin(admin.ModelAdmin):
    list_display    = ('name', 'organization', 'category', 'condition',
                       'quantity_on_hand', 'storage_location', 'is_low_stock')
    list_filter     = ('category', 'condition', 'organization')
    search_fields   = ('name', 'serial_number', 'storage_location')
    autocomplete_fields = ('organization',)


@admin.register(TeamMember)
class TeamMemberAdmin(admin.ModelAdmin):
    list_display    = ('name', 'organization', 'role', 'employment_type', 'email', 'is_active')
    list_filter     = ('role', 'employment_type', 'is_active', 'organization')
    search_fields   = ('name', 'email')
    autocomplete_fields = ('organization',)


@admin.register(EventAssignment)
class EventAssignmentAdmin(admin.ModelAdmin):
    list_display = ('event_request', 'team_member', 'vendor_company', 'staff_count',
                    'role_on_event', 'status')
    list_filter  = ('status',)


@admin.register(MessageTemplate)
class MessageTemplateAdmin(admin.ModelAdmin):
    list_display  = ('name', 'organization', 'kind', 'channel', 'is_active', 'is_default')
    list_filter   = ('kind', 'channel', 'is_active', 'organization')
    search_fields = ('name',)
    autocomplete_fields = ('organization',)


class WorkflowActionInline(admin.TabularInline):
    model = WorkflowAction
    extra = 1


@admin.register(Workflow)
class WorkflowAdmin(admin.ModelAdmin):
    list_display = ('name', 'organization', 'trigger', 'is_active', 'created_at')
    list_filter  = ('trigger', 'is_active', 'organization')
    inlines      = [WorkflowActionInline]
    autocomplete_fields = ('organization',)


@admin.register(WorkflowRun)
class WorkflowRunAdmin(admin.ModelAdmin):
    list_display    = ('workflow_name', 'event_request', 'organization', 'success', 'ran_at')
    list_filter     = ('success', 'organization')
    readonly_fields = ('workflow', 'workflow_name', 'event_request', 'organization', 'ran_at', 'success', 'log')


@admin.register(AuthToken)
class AuthTokenAdmin(admin.ModelAdmin):
    list_display    = ('user', 'created_at', 'last_used', 'expires_at')
    readonly_fields = ('key', 'created_at', 'last_used')
