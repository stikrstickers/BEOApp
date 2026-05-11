"""
Workflow execution engine.

Workflows are organizer-defined automations that fire on EventRequest
lifecycle events (submit + status transitions). Each Workflow has an
ordered list of WorkflowActions; each action runs against the triggering
EventRequest and the outcome is logged to a WorkflowRun.

Email actions are stubbed — they log to WorkflowRun.log rather than calling
out to SMTP, since the project has no mail backend configured yet. Swap
`_send_email` for `django.core.mail.send_mail` once SMTP settings exist.
"""
from __future__ import annotations

import logging
from typing import Any

from .models import EventRequest, Workflow, WorkflowAction, WorkflowRun

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Action handlers
# ---------------------------------------------------------------------------

def _resolve_email_recipient(event: EventRequest, to: str) -> str:
    if to == 'client':
        return event.client_email
    if to == 'organizer':
        # No multi-organizer concept yet — placeholder until we add a venue/team config.
        return 'organizer@example.com'
    return to or ''


def _interpolate(template: str, event: EventRequest) -> str:
    """Tiny {{field}} template — replaces placeholders with EventRequest fields."""
    if not template:
        return ''
    out = template
    fields = [
        'client_name', 'client_email', 'organization', 'event_name',
        'event_type', 'preferred_date', 'alternate_date',
        'start_time', 'end_time', 'headcount', 'venue_preference',
        'food_service', 'tech_needs', 'status',
    ]
    for field in fields:
        val = getattr(event, field, '')
        if val is None:
            val = ''
        out = out.replace('{{' + field + '}}', str(val))
    return out


def _send_email(event: EventRequest, config: dict) -> str:
    """Stubbed email send. Returns a human-readable log line."""
    to = _resolve_email_recipient(event, config.get('to', 'client'))
    subject = _interpolate(config.get('subject', ''), event)
    body    = _interpolate(config.get('body', ''), event)
    if not to:
        raise ValueError('No recipient resolved for send_email action')
    # TODO: replace with django.core.mail.send_mail once SMTP is configured.
    logger.info('Workflow stub email: to=%s subject=%s', to, subject)
    return f'[stub] email to={to} subject={subject!r} body={body[:80]!r}'


def _add_organizer_note(event: EventRequest, config: dict) -> str:
    text = _interpolate(config.get('text', ''), event)
    if not text:
        raise ValueError('add_organizer_note requires text')
    sep = '\n\n' if event.organizer_note else ''
    event.organizer_note = (event.organizer_note + sep + text).strip()
    # Save without triggering recursion through the workflow signal — direct UPDATE.
    EventRequest.objects.filter(pk=event.pk).update(organizer_note=event.organizer_note)
    return f'appended note ({len(text)} chars)'


def _set_status(event: EventRequest, config: dict) -> str:
    new_status = config.get('status')
    valid = {c[0] for c in EventRequest.STATUS_CHOICES}
    if new_status not in valid:
        raise ValueError(f'invalid status: {new_status!r}')
    if event.status == new_status:
        return f'status already {new_status}'
    # Direct UPDATE so we don't re-enter the post_save → run-workflows loop.
    EventRequest.objects.filter(pk=event.pk).update(status=new_status)
    event.status = new_status
    return f'status → {new_status}'


_HANDLERS = {
    'send_email':         _send_email,
    'add_organizer_note': _add_organizer_note,
    'set_status':         _set_status,
}


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

def run_workflows_for_event(event: EventRequest, trigger: str) -> None:
    """Execute every active Workflow matching `trigger` against `event`."""
    workflows = Workflow.objects.filter(trigger=trigger, is_active=True).prefetch_related('actions')
    for wf in workflows:
        lines: list[str] = []
        success = True
        for action in wf.actions.all().order_by('order'):
            handler = _HANDLERS.get(action.action_type)
            if handler is None:
                lines.append(f'#{action.order} {action.action_type}: no handler')
                success = False
                continue
            try:
                result = handler(event, action.config or {})
                lines.append(f'#{action.order} {action.action_type}: {result}')
            except Exception as exc:  # noqa: BLE001 — log + continue subsequent actions
                lines.append(f'#{action.order} {action.action_type}: ERROR {exc}')
                success = False
        WorkflowRun.objects.create(
            workflow=wf,
            event_request=event,
            success=success,
            log='\n'.join(lines),
        )
