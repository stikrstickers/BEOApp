from django.contrib import admin
from .models import (
    AuthToken, EventAssignment, EventRequest, InventoryItem,
    TeamMember, Workflow, WorkflowAction, WorkflowRun,
)


@admin.register(EventRequest)
class EventRequestAdmin(admin.ModelAdmin):
    list_display   = ('event_name', 'client_name', 'preferred_date', 'headcount', 'status', 'submitted_at')
    list_filter    = ('status', 'event_type', 'food_service', 'tech_needs')
    search_fields  = ('event_name', 'client_name', 'client_email', 'organization')
    date_hierarchy = 'preferred_date'
    readonly_fields = ('submitted_at', 'updated_at')


@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display  = ('name', 'category', 'quantity_on_hand', 'unit_price', 'is_low_stock')
    list_filter   = ('category',)
    search_fields = ('name', 'notes')


@admin.register(TeamMember)
class TeamMemberAdmin(admin.ModelAdmin):
    list_display  = ('name', 'role', 'is_vendor', 'company', 'email', 'phone')
    list_filter   = ('role', 'is_vendor')
    search_fields = ('name', 'email', 'company')


@admin.register(EventAssignment)
class EventAssignmentAdmin(admin.ModelAdmin):
    list_display = ('event_request', 'team_member', 'role_on_event', 'status', 'assigned_at')
    list_filter  = ('status',)


class WorkflowActionInline(admin.TabularInline):
    model = WorkflowAction
    extra = 1


@admin.register(Workflow)
class WorkflowAdmin(admin.ModelAdmin):
    list_display = ('name', 'trigger', 'is_active', 'created_at')
    list_filter  = ('trigger', 'is_active')
    inlines      = [WorkflowActionInline]


@admin.register(WorkflowRun)
class WorkflowRunAdmin(admin.ModelAdmin):
    list_display  = ('workflow', 'event_request', 'success', 'ran_at')
    list_filter   = ('success',)
    readonly_fields = ('workflow', 'event_request', 'ran_at', 'success', 'log')


@admin.register(AuthToken)
class AuthTokenAdmin(admin.ModelAdmin):
    list_display    = ('user', 'created_at')
    readonly_fields = ('key', 'created_at')
