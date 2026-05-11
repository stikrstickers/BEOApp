from django.contrib import admin
from .models import (
    AuthToken, EventAssignment, EventRequest, InventoryItem,
    Organization, TeamMember, UserProfile,
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


@admin.register(EventRequest)
class EventRequestAdmin(admin.ModelAdmin):
    list_display    = ('event_name', 'client_name', 'organization', 'preferred_date',
                       'headcount', 'status', 'submitted_at')
    list_filter     = ('status', 'event_type', 'food_service', 'tech_needs', 'organization')
    search_fields   = ('event_name', 'client_name', 'client_email', 'client_org')
    date_hierarchy  = 'preferred_date'
    readonly_fields = ('submitted_at', 'updated_at')
    autocomplete_fields = ('organization', 'client_user')


@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display    = ('name', 'organization', 'category', 'quantity_on_hand', 'unit_price', 'is_low_stock')
    list_filter     = ('category', 'organization')
    search_fields   = ('name', 'notes')
    autocomplete_fields = ('organization',)


@admin.register(TeamMember)
class TeamMemberAdmin(admin.ModelAdmin):
    list_display    = ('name', 'organization', 'role', 'is_vendor', 'company', 'email')
    list_filter     = ('role', 'is_vendor', 'organization')
    search_fields   = ('name', 'email', 'company')
    autocomplete_fields = ('organization',)


@admin.register(EventAssignment)
class EventAssignmentAdmin(admin.ModelAdmin):
    list_display = ('event_request', 'team_member', 'role_on_event', 'status', 'assigned_at')
    list_filter  = ('status',)


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
