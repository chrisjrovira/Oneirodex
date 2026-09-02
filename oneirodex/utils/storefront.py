"""Storefront Discover shelves — curated-for-you and upcoming (W25-STORE-1).

Curation is derived **only** from the member's own on-box signals (favorites,
play status, genres already in the library). No external recommender, no
telemetry leaving the box — same stance as the rest of the product.

Both builders return `[]` rather than filler when there is nothing honest to
show; the caller hides empty shelves.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, or_, select

from oneirodex import db
from oneirodex.models import Game, Genre, user_favorites
from oneirodex.utils.library_acl import apply_game_access_filters

DEFAULT_SHELF_LIMIT = 8
# A title needs a real release date ahead of now to count as upcoming.
UPCOMING_HORIZON_DAYS = 365


def _now() -> datetime:
    return datetime.now(timezone.utc)


def favorite_genre_ids(user, *, limit: int = 5) -> list[int]:
    """Genres the member actually favourites, most-favourited first."""
    rows = db.session.execute(
        select(Genre.id, func.count(Genre.id).label('hits'))
        .select_from(user_favorites)
        .join(Game, Game.uuid == user_favorites.c.game_uuid)
        .join(Game.genres)
        .where(user_favorites.c.user_id == user.id)
        .group_by(Genre.id)
        .order_by(func.count(Genre.id).desc())
        .limit(limit)
    ).all()
    return [row[0] for row in rows]


def build_curated_for_you(user, *, limit: int = DEFAULT_SHELF_LIMIT) -> list[Game]:
    """Unplayed titles in genres the member already favourites.

    Deliberately excludes anything already favourited — a "for you" shelf that
    only shows things you have already picked is noise. Returns [] when the
    member has no signal yet, so a new account sees the shelf hidden rather
    than a random sample dressed up as a recommendation.
    """
    genre_ids = favorite_genre_ids(user)
    if not genre_ids:
        return []

    already = select(user_favorites.c.game_uuid).where(user_favorites.c.user_id == user.id)
    query = (
        select(Game)
        .join(Game.genres)
        .where(Genre.id.in_(genre_ids))
        .where(Game.uuid.notin_(already))
        .group_by(Game.id)
        # Prefer well-regarded titles, then recent additions, so the shelf is
        # stable between loads rather than shuffling on every visit.
        .order_by(Game.rating.desc().nullslast(), Game.date_created.desc())
        .limit(limit)
    )
    return db.session.execute(apply_game_access_filters(query, user)).scalars().all()


def build_upcoming(user, *, limit: int = DEFAULT_SHELF_LIMIT, now: datetime | None = None) -> list[Game]:
    """Titles whose release date is still ahead — soonest first.

    Reuses the release dates the Calendar already keeps; no new scraping.
    """
    moment = now or _now()
    query = (
        select(Game)
        .where(Game.first_release_date.isnot(None))
        .where(Game.first_release_date > moment)
        .order_by(Game.first_release_date.asc())
        .limit(limit)
    )
    return db.session.execute(apply_game_access_filters(query, user)).scalars().all()


def build_storefront_shelf(identifier: str, user, *, limit: int = DEFAULT_SHELF_LIMIT) -> list[Game] | None:
    """Dispatch for the storefront seed shelves. ``None`` = not a storefront shelf."""
    if identifier == 'curated_for_you':
        return build_curated_for_you(user, limit=limit)
    if identifier == 'upcoming':
        return build_upcoming(user, limit=limit)
    return None
