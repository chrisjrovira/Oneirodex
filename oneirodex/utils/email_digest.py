"""Batched email digest of unread notifications (Wave 15c)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from flask import current_app, has_request_context, render_template, request
from markupsafe import escape
from sqlalchemy import select

from oneirodex import db
from oneirodex.models import User, UserNotification, UserPreference
from oneirodex.utils.notifications import _pref_allows
from oneirodex.utils.smtp import send_email_quiet

_DIGEST_KINDS = frozenset({'mention', 'dm', 'free_game'})
_KIND_PREF = {
    'mention': 'notify_mentions',
    'dm': 'notify_chat',
    'free_game': 'notify_free_games',
}


def _interval_hours() -> float:
    try:
        hours = float(current_app.config.get('EMAIL_DIGEST_INTERVAL_HOURS') or 24)
    except (TypeError, ValueError):
        hours = 24.0
    return max(1.0, min(hours, 168.0))


def _absolute_link(path: str | None) -> str:
    if not path:
        return ''
    if path.startswith('http://') or path.startswith('https://'):
        return path
    if has_request_context():
        root = (request.url_root or '').rstrip('/')
        if root:
            return f'{root}{path if path.startswith("/") else "/" + path}'
    return path


def _eligible_rows(user_id: int, since: datetime | None) -> list[UserNotification]:
    q = (
        select(UserNotification)
        .where(
            UserNotification.user_id == user_id,
            UserNotification.read_at.is_(None),
            UserNotification.kind.in_(tuple(_DIGEST_KINDS)),
        )
        .order_by(UserNotification.created_at.asc())
        .limit(40)
    )
    if since is not None:
        q = q.where(UserNotification.created_at > since)
    rows = db.session.execute(q).scalars().all()
    out: list[UserNotification] = []
    for row in rows:
        pref = _KIND_PREF.get(row.kind)
        if pref and not _pref_allows(user_id, pref, default=True):
            continue
        out.append(row)
    return out


def send_digest_for_user(user: User, prefs: UserPreference, *, now: datetime | None = None) -> bool:
    """Send one digest email if due. Returns True when an email was sent."""
    now = now or datetime.now(timezone.utc)
    if not bool(getattr(prefs, 'email_digest_daily', False)):
        return False
    email = (user.email or '').strip()
    if not email:
        return False
    if hasattr(user, 'is_email_verified') and not bool(user.is_email_verified):
        return False
    if not bool(getattr(user, 'state', True)):
        return False

    last = getattr(prefs, 'email_digest_last_sent_at', None)
    if last is not None:
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        if now - last < timedelta(hours=_interval_hours()):
            return False

    rows = _eligible_rows(user.id, last)
    if not rows:
        return False

    items: list[dict[str, Any]] = []
    for row in rows:
        items.append({
            'kind': row.kind,
            'title': row.title,
            'body': row.body or '',
            'link': _absolute_link(row.link or '/notifications'),
        })

    try:
        html = render_template(
            'email/daily_digest.html',
            items=items,
            count=len(items),
            inbox_link=_absolute_link('/notifications'),
        )
    except Exception:
        # Titles/bodies carry user-authored chat text — escape like the Jinja path does.
        lines = []
        for item in items:
            snippet = escape((item['body'] or '')[:120])
            link = item.get('link') or ''
            open_bit = f' — <a href="{escape(link)}">Open</a>' if link else ''
            lines.append(f'<li><strong>{escape(item["title"])}</strong> — {snippet}{open_bit}</li>')
        html = (
            f'<p>You have {len(items)} unread notification'
            f'{"s" if len(items) != 1 else ""}.</p>'
            f'<ul>{"".join(lines)}</ul>'
            f'<p><a href="{_absolute_link("/notifications")}">Open notifications</a></p>'
        )

    subject = f'Oneirodex — {len(items)} unread notification{"s" if len(items) != 1 else ""}'
    if not send_email_quiet(email, subject, html):
        return False

    prefs.email_digest_last_sent_at = now
    db.session.commit()
    return True


def run_email_digest_batch(*, now: datetime | None = None) -> dict[str, int]:
    """Send digests for all opted-in users. Safe to call from scheduler or tests."""
    now = now or datetime.now(timezone.utc)
    prefs_rows = db.session.execute(
        select(UserPreference).where(UserPreference.email_digest_daily.is_(True)),
    ).scalars().all()

    considered = 0
    sent = 0
    skipped = 0
    for prefs in prefs_rows:
        considered += 1
        user = db.session.get(User, prefs.user_id)
        if user is None:
            skipped += 1
            continue
        try:
            if send_digest_for_user(user, prefs, now=now):
                sent += 1
            else:
                skipped += 1
        except Exception:
            skipped += 1
    return {'considered': considered, 'sent': sent, 'skipped': skipped}
