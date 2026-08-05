"""Badge / chip filters for /browse_games (aligned with badgeSignals.js)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import and_, exists, false, or_, select

from gametheca.models import Game, GameUpdate, PlayerPerspective
from gametheca.utils.item_kind import parse_item_kinds_param
from gametheca.utils.library_health import (
    PATH_STATUS_EMPTY,
    PATH_STATUS_MISSING,
    PATH_STATUS_OK,
)
from gametheca.utils.lifecycle import FRESHNESS_BEHIND_STATUSES
from gametheca.utils.rom_language import needs_translation_sql_filter
from gametheca.utils.secondary_scrapers import VR_PERSPECTIVE_NAME

_PATH_STATUS_ALLOWED = frozenset({
    PATH_STATUS_OK,
    PATH_STATUS_MISSING,
    PATH_STATUS_EMPTY,
})

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


def _item_kind_raw_from_args(args) -> str | None:
    """Collect ``item_kind`` / ``content_kind`` (single, comma list, or repeated)."""
    parts: list[str] = []
    getlist = getattr(args, 'getlist', None)
    if callable(getlist):
        for key in ('item_kind', 'content_kind'):
            for value in getlist(key) or []:
                if value is not None and str(value).strip():
                    parts.append(str(value).strip())
    else:
        for key in ('item_kind', 'content_kind'):
            value = args.get(key) if hasattr(args, 'get') else None
            if value is not None and str(value).strip():
                parts.append(str(value).strip())
    if not parts:
        return None
    return ','.join(parts)


def apply_name_filter(query, args):
    """Filter by title substring ``name=`` (alias ``q=``).

    Case-insensitive ``ILIKE %name%``. Blank / whitespace → no filter.
    When both are present, ``name`` wins.
    """
    raw_name = args.get('name') if hasattr(args, 'get') else None
    raw_q = args.get('q') if hasattr(args, 'get') else None
    name = (raw_name or raw_q or '').strip()
    if not name:
        return query
    return query.filter(Game.name.ilike(f'%{name}%'))


def apply_item_kind_filter(query, args):
    """Filter by ``item_kind=`` / ``content_kind=`` (game|experience|emulator|tool).

    Omit / blank → no filter (all kinds). Comma list or repeated params OK.
    Unknown tokens ignored; only-unknown → empty result set.
    """
    kinds = parse_item_kinds_param(_item_kind_raw_from_args(args))
    if kinds is None:
        return query
    if not kinds:
        return query.filter(false())
    return query.filter(Game.item_kind.in_(tuple(sorted(kinds))))


def apply_path_status_filter(query, args):
    """Filter by ``path_status=ok|missing|empty`` (comma list OK).

    Cheap SQL on persisted scan signal — for admin/librarian missing-path tools.
    Unknown tokens ignored; only-unknown → empty result set. Omit / blank → no filter.
    """
    raw = None
    getlist = getattr(args, 'getlist', None)
    if callable(getlist):
        parts = [str(v).strip() for v in (getlist('path_status') or []) if v is not None]
        if parts:
            raw = ','.join(parts)
    if raw is None:
        value = args.get('path_status') if hasattr(args, 'get') else None
        if value is not None and str(value).strip():
            raw = str(value).strip()
    if not raw:
        return query
    values = []
    for token in raw.split(','):
        token = token.strip().lower()
        if token in _PATH_STATUS_ALLOWED and token not in values:
            values.append(token)
    if not values:
        return query.filter(false())
    return query.filter(Game.path_status.in_(tuple(values)))


def apply_badge_filters(query, args, *, user=None, now: datetime | None = None):
    """Apply optional badge chip query params to a Game select/query.

    Params (any of):
      is_vr=1
      freshness_behind=1  — OUT / ~ (behind | heuristic_behind)
      has_updates=1       — freshness behind OR local GameUpdate rows
      new_import=1        — date_identified/date_created within 14 days
      recent_release=1    — first_release_date within 30 days
      needs_translation=1 — ROM lang known and mismatches preferred_game_locale
      item_kind=…         — game|experience|emulator|tool (comma list / repeated)
      content_kind=…      — alias of item_kind
      path_missing=1      — MISSING badge chip (files gone from disk)
      path_status=…       — ok|missing|empty (comma list; admin/librarian tools)
      name=… / q=…        — case-insensitive title substring (Library type-to-search)
    """
    clock = now or datetime.now(timezone.utc)
    if clock.tzinfo is None:
        clock = clock.replace(tzinfo=timezone.utc)

    query = apply_name_filter(query, args)

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

    if _flag(args, 'path_missing'):
        query = query.filter(Game.path_status == PATH_STATUS_MISSING)

    query = apply_item_kind_filter(query, args)
    query = apply_path_status_filter(query, args)
    return query
