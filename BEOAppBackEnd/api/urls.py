from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),

    # ── PDF / week endpoints (legacy) ───────────────────────────────────
    path('parse-pdf/',    views.parse_pdf,    name='parse_pdf'),
    path('bin-list/',     views.bin_list,     name='bin_list'),
    path('coffee-list/',  views.coffee_list,  name='coffee_list'),
    path('run-of-show/',  views.run_of_show,  name='run_of_show'),
    path('weeks/',        views.weeks,        name='weeks'),
    path('weeks/<int:week_id>/', views.week_detail, name='week_detail'),
    path('weeks/<int:week_id>/files/<int:file_id>/', views.week_file_delete, name='week_file_delete'),

    # ── Auth ────────────────────────────────────────────────────────────
    path('auth/register/', views.auth_register, name='auth_register'),
    path('auth/login/',    views.auth_login,    name='auth_login'),
    path('auth/logout/',   views.auth_logout,   name='auth_logout'),
    path('auth/me/',       views.auth_me,       name='auth_me'),
    path('auth/oauth/<str:provider>/start/', views.auth_oauth_start, name='auth_oauth_start'),

    # ── Organizations ───────────────────────────────────────────────────
    path('orgs/<slug:slug>/',                 views.organization_public,      name='organization_public'),
    path('orgs/<slug:slug>/event-requests/',  views.event_request_org_submit, name='event_request_org_submit'),
    path('organization/', views.organization_current, name='organization_current'),

    # ── Event Requests (intake) ─────────────────────────────────────────
    path('event-requests/',                                  views.event_requests,         name='event_requests'),
    path('event-requests/<int:request_id>/',                 views.event_request_detail,   name='event_request_detail'),
    path('event-requests/<int:request_id>/assignments/',     views.event_assignments,      name='event_assignments'),
    path('event-requests/<int:request_id>/workflow-runs/',   views.event_workflow_runs,    name='event_workflow_runs'),
    path('assignments/<int:assignment_id>/',                 views.assignment_detail,      name='assignment_detail'),

    # ── Events (confirmed bookings — Calendar) ──────────────────────────
    path('events/',                  views.event_list,   name='event_list'),
    path('events/<int:event_id>/',   views.event_detail, name='event_detail'),

    # ── Venues: Sites + SiteVenues ──────────────────────────────────────
    path('sites/',                            views.site_list,        name='site_list'),
    path('sites/<int:site_id>/',              views.site_detail,      name='site_detail'),
    path('sites/<int:site_id>/venues/',       views.site_venues,      name='site_venues'),
    path('venues/',                           views.venue_list_all,   name='venue_list_all'),
    path('venues/<int:venue_id>/',            views.site_venue_detail, name='site_venue_detail'),

    # ── Contacts: Companies + Individuals ───────────────────────────────
    path('companies/',                       views.company_list,      name='company_list'),
    path('companies/<int:company_id>/',      views.company_detail,    name='company_detail'),
    path('contacts/',                        views.contact_list,      name='contact_list'),
    path('contacts/<int:contact_id>/',       views.contact_detail,    name='contact_detail'),
    path('contacts/<int:contact_id>/companies/', views.contact_companies, name='contact_companies'),

    # ── Inventory: Perishables + Hardware ───────────────────────────────
    path('perishables/',                 views.perishable_list,   name='perishable_list'),
    path('perishables/<int:item_id>/',   views.perishable_detail, name='perishable_detail'),
    path('hardware/',                    views.hardware_list,     name='hardware_list'),
    path('hardware/<int:item_id>/',      views.hardware_detail,   name='hardware_detail'),

    # ── Teammates: Staff + Temps (filtered via ?employment_type=) ───────
    path('team/',                    views.team_list,   name='team_list'),
    path('team/<int:member_id>/',    views.team_detail, name='team_detail'),

    # ── Templates ───────────────────────────────────────────────────────
    path('templates/',                          views.template_list,    name='template_list'),
    path('templates/tokens/',                   views.template_tokens,  name='template_tokens'),
    path('templates/<int:template_id>/',        views.template_detail,  name='template_detail'),
    path('templates/<int:template_id>/preview/', views.template_preview, name='template_preview'),

    # ── Workflows ───────────────────────────────────────────────────────
    path('workflows/',                                   views.workflow_list,           name='workflow_list'),
    path('workflows/<int:workflow_id>/',                 views.workflow_detail,         name='workflow_detail'),
    path('workflows/<int:workflow_id>/actions/',         views.workflow_actions,        name='workflow_actions'),
    path('workflow-actions/<int:action_id>/',            views.workflow_action_detail,  name='workflow_action_detail'),
]
