"""In-app notifications (Wave 14c)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select

from gametheca import db
from gametheca.models import User, UserNotification, UserPreference


def _pref_allows(user_id: int, flag: str) -> bool:
    prefs = db.session.execute(
        select(UserPreference).filter_by(user_id=user_id),
    ).scalars().first()
    if prefs is None:
        return True
    return bool(getattr(prefs, flag, True))


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
    from sqlalchemy import func

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
