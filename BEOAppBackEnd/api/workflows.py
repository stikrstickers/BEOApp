"""
Workflow execution engine.

Workflows are organizer-defined automations that fire on EventRequest
lifecycle events (submit + status transitions). Each Workflow has an
ordered list of WorkflowActions; each action runs against the triggering
EventRequest and the outcome is logged to a WorkflowRun.

Email actions are stubbed — they log to WorkflowRun.log rather than calling
out to SMTP, since the project has no mail backend configured yet. Swap
`_send_email` for `django.core.mail.send_mail` once SMTP settings exist.

Runs are wrapped in `transaction.atomic` with `select_for_update` on the
EventRequest so concurrent triggers can't interleave mutations and so the
WorkflowRun audit row always lands alongside the state changes it describes.
A `_workflow_depth` guard on the threadlocal prevents `set_status` from
re-entering the same workflow chain infinitely.
"""
from __future__ import annotations

import logging
import threading

from django.db import transaction

from .models import EventRequest, Workflow, WorkflowRun

logger = logging.getLogger(__name__)

# Recursion guard — `set_status` causes EventRequest.save() which fires the
# post_save signal which calls back into run_workflows_for_event. Cap depth.
_MAX_DEPTH = 4
_state = threading.local()


def _get_depth() -> int:
    return getattr(_state, 'depth', 0)


# ---------------------------------------------------------------------------
# Action handlers
# ---------------------------------------------------------------------------

def _resolve_email_recipient(event: EventRequest, to: str) -> str:
    if to == 'client':
        return event.client_email
    if to == 'organizer':
        # Resolve to the org's first member with an email, falling back to the
        # client's email so we never silently drop a send.
        if event.organization_id:
            member = (
                event.organization.members
                .exclude(user__email='')
                .select_related('user')
                .first()
            )
            if member and member.user.email:
                return member.user.email
        return event.client_email
    return to or ''


def _interpolate(template: str, event: EventRequest) -> str:
    """Tiny {{field}} template — replaces placeholders with EventRequest fields."""
    if not template:
        return ''
    out = template
    fields = [
        'client_name', 'client_email', 'client_org', 'event_name',
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
    # Direct UPDATE so we don't re-enter post_save.
    EventRequest.objects.filter(pk=event.pk).update(organizer_note=event.organizer_note)
    return f'appended note ({len(text)} chars)'


def _set_status(event: EventRequest, config: dict) -> str:
    new_status = config.get('status')
    valid = {c[0] for c in EventRequest.STATUS_CHOICES}
    if new_status not in valid:
        raise ValueError(f'invalid status: {new_status!r}')
    if not EventRequest.can_transition(event.status, new_status):
        raise ValueError(f'illegal transition: {event.status} → {new_status}')
    if event.status == new_status:
        return f'status already {new_status}'
    # Direct UPDATE bypasses post_save; we'll fire dependent workflows manually below.
    previous = event.status
    EventRequest.objects.filter(pk=event.pk).update(status=new_status)
    event.status = new_status
    # Manually trigger downstream workflows for the new status, respecting the
    # depth guard so set_status → on_status_X → set_status can't recurse forever.
    if _get_depth() < _MAX_DEPTH:
        run_workflows_for_event(event, trigger=f'on_status_{new_status}')
    return f'status {previous} → {new_status}'


_HANDLERS = {
    'send_email':         _send_email,
    'add_organizer_note': _add_organizer_note,
    'set_status':         _set_status,
}


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

def run_workflows_for_event(event: EventRequest, trigger: str) -> None:
    """Execute every active Workflow matching `trigger` against `event`.

    Scoping: workflows are filtered to the event's organization. A run with
    no organization (legacy / unrouted requests) executes no workflows.
    """
    if not event.organization_id:
        return  # Nothing to dispatch to.

    _state.depth = _get_depth() + 1
    try:
        if _state.depth > _MAX_DEPTH:
            logger.warning('Workflow depth %d exceeded; aborting %s', _state.depth, trigger)
            return

        workflows = (
            Workflow.objects
            .filter(
                organization_id=event.organization_id,
                trigger=trigger,
                is_active=True,
            )
            .prefetch_related('actions')
        )
        for wf in workflows:
            _run_one_workflow(wf, event)
    finally:
        _state.depth = _get_depth() - 1


def _run_one_workflow(wf: Workflow, event: EventRequest) -> None:
    """Run a single workflow atomically. Audit row + state changes co-commit."""
    with transaction.atomic():
        # Lock the EventRequest row for the duration so concurrent status
        # updates from API calls don't interleave with our action sequence.
        locked = EventRequest.objects.select_for_update().get(pk=event.pk)
        # Sync any in-memory mutations from earlier actions in this trigger chain.
        locked.status = event.status
        locked.organizer_note = event.organizer_note

        lines: list[str] = []
        success = True
        for action in wf.actions.all().order_by('order'):
            handler = _HANDLERS.get(action.action_type)
            if handler is None:
                lines.append(f'#{action.order} {action.action_type}: no handler')
                success = False
                continue
            try:
                result = handler(locked, action.config or {})
                lines.append(f'#{action.order} {action.action_type}: {result}')
            except Exception as exc:  # noqa: BLE001
                lines.append(f'#{action.order} {action.action_type}: ERROR {exc}')
                success = False

        # Mirror any state mutations back to the caller's instance.
        event.status = locked.status
        event.organizer_note = locked.organizer_note

        WorkflowRun.objects.create(
            workflow=wf,
            workflow_name=wf.name,
            event_request=event,
            organization_id=event.organization_id,
            success=success,
            log='\n'.join(lines),
        )
