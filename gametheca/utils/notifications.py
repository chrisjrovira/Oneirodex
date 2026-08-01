"""In-app notifications (Wave 14c) + admin alerts + optional social email."""

from __future__ import annotations

import os
import threading
from datetime import datetime, timezone
from typing import Any

from flask import has_request_context, render_template, request
from sqlalchemy import func, select

from gametheca import db
from gametheca.models import Game, GlobalSettings, Library, User, UserNotification, UserPreference
from gametheca.utils.rbac import role_at_least
from gametheca.utils.smtp import send_email_quiet

_SOCIAL_EMAIL_KINDS = frozenset({'mention', 'dm'})

# Debounced library-add digests (one notification per library per window).
_LIBRARY_ADD_DIGEST_SEC = 5.0
_library_add_lock = threading.Lock()
_library_add_pending: dict[str, dict[str, Any]] = {}
_library_add_timers: dict[str, Any] = {}


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
    return notify_staff(
        kind=kind,
        title=title,
        body=body,
        link=link,
        actor_user_id=actor_user_id,
        payload=payload,
        pref_flag=pref_flag,
        min_role='admin',
    )


def notify_staff(
    *,
    kind: str,
    title: str,
    body: str | None = None,
    link: str | None = None,
    actor_user_id: int | None = None,
    payload: dict[str, Any] | None = None,
    pref_flag: str = 'notify_support',
    min_role: str = 'librarian',
) -> int:
    """Fan-out in-app alerts to active users at or above ``min_role``."""
    users = db.session.execute(select(User).where(User.state.is_(True))).scalars().all()
    count = 0
    for user in users:
        if not role_at_least(getattr(user, 'role', None), min_role):
            continue
        row = notify_user(
            user.id,
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


def library_add_digest_seconds() -> float:
    raw = os.environ.get('GT_LIBRARY_ADD_NOTIFY_DEBOUNCE_SEC')
    if raw is None or str(raw).strip() == '':
        return _LIBRARY_ADD_DIGEST_SEC
    try:
        value = float(str(raw).strip())
    except (TypeError, ValueError):
        return _LIBRARY_ADD_DIGEST_SEC
    return max(2.0, min(30.0, value))


def _flush_library_add_digest(library_uuid: str, app=None) -> None:
    """Emit one staff notification + SystemEvent for coalesced adds."""
    with _library_add_lock:
        batch = _library_add_pending.pop(library_uuid, None)
        _library_add_timers.pop(library_uuid, None)
    if not batch or not batch.get('count'):
        return

    def _emit():
        if not admin_alerts_enabled('admin_notify_new_games'):
            return
        library_name = batch.get('library_name') or 'Library'
        count = int(batch['count'])
        game_uuids = list(batch.get('game_uuids') or [])[:50]
        sample = batch.get('sample_names') or []
        if count == 1 and sample:
            body = f'Added "{sample[0]}".'
        elif sample:
            extra = count - len(sample)
            listed = ', '.join(sample[:3])
            body = f'Added {listed}' + (f' (+{extra} more).' if extra > 0 else '.')
        else:
            body = f'{count} title(s) identified.'
        link = f'/library?library_uuid={library_uuid}'
        notify_staff(
            kind='library_added',
            title=f'{library_name}: {count} game{"s" if count != 1 else ""} added',
            body=body,
            link=link,
            payload={
                'library_uuid': library_uuid,
                'library_name': library_name,
                'count': count,
                'game_uuids': game_uuids,
            },
            pref_flag='notify_support',
            min_role='librarian',
        )
        try:
            from gametheca.utils.event_logging import log_system_event

            log_system_event(
                f'{library_name}: {count} game(s) added',
                event_type='library',
                event_level='information',
            )
        except Exception:
            pass

    if app is not None:
        with app.app_context():
            _emit()
    else:
        _emit()


def schedule_library_add_digest(
    *,
    library_uuid: str,
    library_name: str | None,
    game_uuid: str,
    game_name: str | None = None,
    debounce_seconds: float | None = None,
    app=None,
) -> None:
    """Coalesce new-game alerts into one digest per library per debounce window."""
    if not library_uuid:
        notify_admins_new_game_immediate(game_uuid, game_name)
        return
    delay = (
        debounce_seconds
        if debounce_seconds is not None
        else library_add_digest_seconds()
    )
    with _library_add_lock:
        batch = _library_add_pending.get(library_uuid)
        if batch is None:
            batch = {
                'library_name': library_name or 'Library',
                'count': 0,
                'game_uuids': [],
                'sample_names': [],
            }
            _library_add_pending[library_uuid] = batch
        if library_name:
            batch['library_name'] = library_name
        batch['count'] += 1
        if game_uuid and game_uuid not in batch['game_uuids']:
            batch['game_uuids'].append(game_uuid)
        if game_name and len(batch['sample_names']) < 5:
            batch['sample_names'].append(game_name)
        old = _library_add_timers.pop(library_uuid, None)
        if old is not None:
            try:
                old.cancel()
            except Exception:
                pass
        flask_app = app
        if flask_app is None:
            try:
                from flask import current_app

                flask_app = current_app._get_current_object()
            except Exception:
                flask_app = None

        timer = threading.Timer(
            delay,
            _flush_library_add_digest,
            args=(library_uuid, flask_app),
        )
        timer.daemon = True
        _library_add_timers[library_uuid] = timer
        timer.start()


def _reset_library_add_digests_for_tests() -> None:
    """Test helper — cancel pending digest timers."""
    with _library_add_lock:
        for timer in _library_add_timers.values():
            try:
                timer.cancel()
            except Exception:
                pass
        _library_add_timers.clear()
        _library_add_pending.clear()


def notify_admins_new_game_immediate(game_uuid: str, game_name: str | None = None) -> None:
    """Legacy single-title alert (no library context)."""
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


def notify_admins_new_game(game_uuid: str, game_name: str | None = None) -> None:
    """Schedule a per-library digest when a title is identified (scan / watch / import).

    Notification kind: ``library_added``. Payload includes library_uuid, count,
    game_uuids. Fans out to admin + librarian. Falls back to immediate single
    alert when the game has no library_uuid.
    """
    if not admin_alerts_enabled('admin_notify_new_games'):
        return
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    library_uuid = getattr(game, 'library_uuid', None) if game else None
    library_name = None
    if library_uuid:
        lib = db.session.get(Library, library_uuid)
        library_name = getattr(lib, 'name', None) if lib else None
    name = game_name or (getattr(game, 'name', None) if game else None) or game_uuid
    if not library_uuid:
        notify_admins_new_game_immediate(game_uuid, name)
        return
    schedule_library_add_digest(
        library_uuid=library_uuid,
        library_name=library_name,
        game_uuid=game_uuid,
        game_name=name,
    )
