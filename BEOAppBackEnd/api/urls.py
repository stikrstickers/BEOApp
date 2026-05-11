from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),

    # PDF / week endpoints (existing)
    path('parse-pdf/',    views.parse_pdf,    name='parse_pdf'),
    path('bin-list/',     views.bin_list,     name='bin_list'),
    path('coffee-list/',  views.coffee_list,  name='coffee_list'),
    path('run-of-show/',  views.run_of_show,  name='run_of_show'),
    path('weeks/',        views.weeks,        name='weeks'),
    path('weeks/<int:week_id>/', views.week_detail, name='week_detail'),
    path('weeks/<int:week_id>/files/<int:file_id>/', views.week_file_delete, name='week_file_delete'),

    # Event requests
    path('event-requests/', views.event_requests, name='event_requests'),
    path('event-requests/<int:request_id>/', views.event_request_detail, name='event_request_detail'),
    path('event-requests/<int:request_id>/assignments/', views.event_assignments, name='event_assignments'),
    path('event-requests/<int:request_id>/workflow-runs/', views.event_workflow_runs, name='event_workflow_runs'),
    path('assignments/<int:assignment_id>/', views.assignment_detail, name='assignment_detail'),

    # Auth
    path('auth/register/', views.auth_register, name='auth_register'),
    path('auth/login/',    views.auth_login,    name='auth_login'),
    path('auth/logout/',   views.auth_logout,   name='auth_logout'),
    path('auth/me/',       views.auth_me,       name='auth_me'),
    path('auth/oauth/<str:provider>/start/', views.auth_oauth_start, name='auth_oauth_start'),

    # Inventory
    path('inventory/', views.inventory_list, name='inventory_list'),
    path('inventory/<int:item_id>/', views.inventory_detail, name='inventory_detail'),

    # Team
    path('team/', views.team_list, name='team_list'),
    path('team/<int:member_id>/', views.team_detail, name='team_detail'),

    # Workflows
    path('workflows/', views.workflow_list, name='workflow_list'),
    path('workflows/<int:workflow_id>/', views.workflow_detail, name='workflow_detail'),
    path('workflows/<int:workflow_id>/actions/', views.workflow_actions, name='workflow_actions'),
    path('workflow-actions/<int:action_id>/', views.workflow_action_detail, name='workflow_action_detail'),
]
