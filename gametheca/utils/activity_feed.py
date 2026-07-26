"""Activity / now-playing helpers from play sessions."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select

from gametheca import db
from gametheca.models import Game, PlaySession, User


def list_recent_activity(*, limit: int = 25, active_within_minutes: int = 15) -> list[dict[str, Any]]:
    """Return recent play sessions for an activity feed (no private paths)."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=14)
    rows = list(
        db.session.execute(
            select(PlaySession)
            .where(PlaySession.started_at >= cutoff)
            .order_by(PlaySession.started_at.desc())
            .limit(max(1, min(limit, 100))),
        ).scalars().all(),
    )
    active_cutoff = datetime.now(timezone.utc) - timedelta(minutes=active_within_minutes)
    out: list[dict[str, Any]] = []
    for session in rows:
        game = db.session.execute(
            select(Game).filter_by(uuid=session.game_uuid),
        ).scalars().first() if getattr(session, 'game_uuid', None) else None
        user = db.session.get(User, session.user_id) if getattr(session, 'user_id', None) else None
        ended = getattr(session, 'ended_at', None)
        last = getattr(session, 'last_heartbeat_at', None) or ended or session.started_at
        if last and last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        is_active = ended is None and last is not None and last >= active_cutoff
        out.append({
            'session_id': session.id,
            'game_uuid': session.game_uuid,
            'game_name': getattr(game, 'name', None) or 'Unknown game',
            'user': getattr(user, 'name', None) or 'player',
            'started_at': session.started_at.isoformat() if session.started_at else None,
            'ended_at': ended.isoformat() if ended else None,
            'client': getattr(session, 'client', None) or 'unknown',
            'is_playing': is_active,
        })
    return out


def list_now_playing(*, active_within_minutes: int = 15) -> list[dict[str, Any]]:
    return [row for row in list_recent_activity(limit=50, active_within_minutes=active_within_minutes) if row['is_playing']]
