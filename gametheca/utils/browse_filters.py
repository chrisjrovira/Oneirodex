"""Badge / chip filters for /browse_games (aligned with badgeSignals.js)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import and_, exists, or_, select

from gametheca.models import Game, GameUpdate, PlayerPerspective
from gametheca.utils.lifecycle import FRESHNESS_BEHIND_STATUSES
from gametheca.utils.rom_language import needs_translation_sql_filter
from gametheca.utils.secondary_scrapers import VR_PERSPECTIVE_NAME

# Keep in sync with frontend/member-app/src/utils/badgeSignals.js
NEW_IMPORT_WINDOW_DAYS = 14
RELEASE_WINDOW_DAYS = 30

_TRUTHY = frozenset({'1', 'true', 'yes', 'on'})


def _flag(args, name: str) -> bool:
    raw = args.get(name, '')
    if raw is None:
        return False
    return str(raw).strip().lower() in _TRUTHY


def _preferred_locale_from_user(user: Any | None) -> str:
    if user is None:
        return 'en-US'
    prefs = getattr(user, 'preferences', None)
    if prefs is None:
        return 'en-US'
    return getattr(prefs, 'preferred_game_locale', None) or 'en-US'


def apply_badge_filters(query, args, *, user=None, now: datetime | None = None):
    """Apply optional badge chip query params to a Game select/query.

    Params (any of):
      is_vr=1
      freshness_behind=1  — OUT / ~ (behind | heuristic_behind)
      has_updates=1       — freshness behind OR local GameUpdate rows
      new_import=1        — date_identified/date_created within 14 days
      recent_release=1    — first_release_date within 30 days
      needs_translation=1 — ROM lang known and mismatches preferred_game_locale
    """
    clock = now or datetime.now(timezone.utc)
    if clock.tzinfo is None:
        clock = clock.replace(tzinfo=timezone.utc)

    if _flag(args, 'is_vr'):
        query = query.filter(
            Game.player_perspectives.any(PlayerPerspective.name == VR_PERSPECTIVE_NAME)
        )

    if _flag(args, 'freshness_behind'):
        query = query.filter(Game.freshness_status.in_(tuple(FRESHNESS_BEHIND_STATUSES)))

    if _flag(args, 'has_updates'):
        update_exists = exists(
            select(GameUpdate.id).where(GameUpdate.game_uuid == Game.uuid)
        )
        query = query.filter(
            or_(
                Game.freshness_status.in_(tuple(FRESHNESS_BEHIND_STATUSES)),
                update_exists,
            )
        )

    if _flag(args, 'new_import'):
        cutoff = clock - timedelta(days=NEW_IMPORT_WINDOW_DAYS)
        query = query.filter(
            or_(
                Game.date_identified >= cutoff,
                and_(Game.date_identified.is_(None), Game.date_created >= cutoff),
            )
        )

    if _flag(args, 'recent_release'):
        cutoff = clock - timedelta(days=RELEASE_WINDOW_DAYS)
        query = query.filter(Game.first_release_date >= cutoff)

    if _flag(args, 'needs_translation'):
        preferred = _preferred_locale_from_user(user)
        query = query.filter(needs_translation_sql_filter(preferred))

    return query
