"""In-app notifications (Wave 14c) + admin alerts + optional social email."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from flask import has_request_context, render_template, request
from sqlalchemy import func, select

from gametheca import db
from gametheca.models import GlobalSettings, User, UserNotification, UserPreference
from gametheca.utils.rbac import normalize_role
from gametheca.utils.smtp import send_email_quiet

_SOCIAL_EMAIL_KINDS = frozenset({'mention', 'dm'})


def _pref_allows(user_id: int, flag: str, *, default: bool = True) -> bool:
    prefs = db.session.execute(
        select(UserPreference).filter_by(user_id=user_id),
    ).scalars().first()
    if prefs is None:
        return default
    return bool(getattr(prefs, flag, default))


def _absolute_member_link(path: str | None) -> str:
    if not path:
        return ''
    if path.startswith('http://') or path.startswith('https://'):
        return path
    if has_request_context():
        root = (request.url_root or '').rstrip('/')
        if root:
            return f'{root}{path if path.startswith("/") else "/" + path}'
    return path


def maybe_email_social_notify(
    user_id: int,
    *,
    kind: str,
    title: str,
    body: str | None = None,
    link: str | None = None,
) -> bool:
    """Opt-in email for @mentions / DMs when admin SMTP is configured."""
    if kind not in _SOCIAL_EMAIL_KINDS:
        return False
    if not _pref_allows(user_id, 'email_notify_social', default=True):
        return False

    user = db.session.get(User, user_id)
    if user is None or not (user.email or '').strip():
        return False
    if hasattr(user, 'is_email_verified') and not bool(user.is_email_verified):
        return False

    href = _absolute_member_link(link or '/chat')
    try:
        html = render_template(
            'email/social_notification.html',
            title=title,
            body=body or '',
            link=href,
            kind=kind,
        )
    except Exception:
        snippet = (body or '')[:200]
        html = (
            f'<p><strong>{title}</strong></p>'
            f'<p>{snippet}</p>'
            f'<p><a href="{href}">Open in GameTheca</a></p>'
        )

    subject = title[:180] or 'GameTheca notification'
    return bool(send_email_quiet(user.email.strip(), subject, html))


def notify_user(
    user_id: int,
    *,
    kind: str,
    title: str,
    body: str | None = None,
    link: str | None = None,
    actor_user_id: int | None = None,
    payload: dict[str, Any] | None = None,
    pref_flag: str | None = None,
) -> UserNotification | None:
    if pref_flag and not _pref_allows(user_id, pref_flag):
        return None
    row = UserNotification(
        user_id=user_id,
        kind=(kind or 'info')[:32],
        title=(title or 'Notice')[:200],
        body=(body or '')[:500] or None,
        link=(link or '')[:512] or None,
        actor_user_id=actor_user_id,
        payload=payload or {},
    )
    db.session.add(row)
    db.session.commit()
    if row.kind in _SOCIAL_EMAIL_KINDS:
        try:
            maybe_email_social_notify(
                user_id,
                kind=row.kind,
                title=row.title,
                body=row.body,
                link=row.link,
            )
        except Exception:
            # Email must never break in-app notification delivery.
            pass
    return row


def list_notifications(user_id: int, *, limit: int = 40, unread_only: bool = False) -> list[dict]:
    q = select(UserNotification).where(UserNotification.user_id == user_id)
    if unread_only:
        q = q.where(UserNotification.read_at.is_(None))
    rows = (
        db.session.execute(
            q.order_by(UserNotification.created_at.desc()).limit(max(1, min(limit, 100)))
        )
        .scalars()
        .all()
    )
    return [r.to_dict() for r in rows]


def unread_count(user_id: int) -> int:
    return int(
        db.session.execute(
            select(func.count())
            .select_from(UserNotification)
            .where(
                UserNotification.user_id == user_id,
                UserNotification.read_at.is_(None),
            )
        ).scalar()
        or 0
    )


def mark_read(user_id: int, ids: list[int] | None = None, *, all_read: bool = False) -> int:
    now = datetime.now(timezone.utc)
    q = select(UserNotification).where(
        UserNotification.user_id == user_id,
        UserNotification.read_at.is_(None),
    )
    if not all_read:
        if not ids:
            return 0
        q = q.where(UserNotification.id.in_(ids))
    rows = db.session.execute(q).scalars().all()
    for row in rows:
        row.read_at = now
    db.session.commit()
    return len(rows)


def notify_friend_request(target: User, actor: User) -> None:
    notify_user(
        target.id,
        kind='friend_request',
        title=f'{actor.name} sent a friend request',
        body='Open Activity to accept or decline.',
        link='/activity',
        actor_user_id=actor.id,
        pref_flag='notify_friend_requests',
    )


def notify_friend_accepted(target: User, actor: User) -> None:
    notify_user(
        target.id,
        kind='friend_accept',
        title=f'{actor.name} accepted your friend request',
        link=f'/members/{actor.id}',
        actor_user_id=actor.id,
        pref_flag='notify_friend_requests',
    )


def notify_admins(
    *,
    kind: str,
    title: str,
    body: str | None = None,
    link: str | None = None,
    actor_user_id: int | None = None,
    payload: dict[str, Any] | None = None,
    pref_flag: str = 'notify_support',
) -> int:
    """Fan-out in-app alerts to all active admin users."""
    admins = db.session.execute(select(User).where(User.state.is_(True))).scalars().all()
    count = 0
    for admin in admins:
        if normalize_role(getattr(admin, 'role', None)) != 'admin':
            continue
        row = notify_user(
            admin.id,
            kind=kind,
            title=title,
            body=body,
            link=link,
            actor_user_id=actor_user_id,
            payload=payload,
            pref_flag=pref_flag,
        )
        if row:
            count += 1
    return count


def admin_alerts_enabled(flag: str) -> bool:
    settings = db.session.execute(select(GlobalSettings)).scalars().first()
    if settings is None:
        return True
    return bool(getattr(settings, flag, True))


def notify_admins_new_game(game_uuid: str, game_name: str | None = None) -> None:
    if not admin_alerts_enabled('admin_notify_new_games'):
        return
    name = game_name or game_uuid
    notify_admins(
        kind='library',
        title=f'New game: {name}',
        body='Identified during scan or import.',
        link=f'/game_details/{game_uuid}',
        payload={'game_uuid': game_uuid},
        pref_flag='notify_support',
    )
