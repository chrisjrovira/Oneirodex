"""IGDB-backed release calendar (upcoming + recent)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from gametheca.utils.igdb_api import make_igdb_api_request


def fetch_release_calendar(*, days_ahead: int = 60, days_behind: int = 14, limit: int = 40) -> list[dict]:
    """
    Return IGDB games with first_release_date in [now-behind, now+ahead].
    Artwork/metadata only — never downloads games.
    """
    days_ahead = max(1, min(int(days_ahead or 60), 180))
    days_behind = max(0, min(int(days_behind or 14), 90))
    limit = max(1, min(int(limit or 40), 100))

    now = datetime.now(timezone.utc)
    start = int((now - timedelta(days=days_behind)).timestamp())
    end = int((now + timedelta(days=days_ahead)).timestamp())

    body = (
        f'fields name,slug,first_release_date,cover.image_id,rating,aggregated_rating;'
        f' where first_release_date >= {start} & first_release_date <= {end};'
        f' sort first_release_date asc;'
        f' limit {limit};'
    )
    raw = make_igdb_api_request('https://api.igdb.com/v4/games', body)
    if not isinstance(raw, list):
        if isinstance(raw, dict) and raw.get('error'):
            raise RuntimeError(str(raw.get('error')))
        return []

    items: list[dict] = []
    for row in raw:
        ts = row.get('first_release_date')
        release_iso = None
        if isinstance(ts, (int, float)):
            release_iso = datetime.fromtimestamp(ts, tz=timezone.utc).date().isoformat()
        cover_id = None
        cover = row.get('cover')
        if isinstance(cover, dict):
            cover_id = cover.get('image_id')
        cover_url = (
            f'https://images.igdb.com/igdb/image/upload/t_cover_small/{cover_id}.jpg'
            if cover_id else None
        )
        items.append({
            'igdb_id': row.get('id'),
            'name': row.get('name'),
            'slug': row.get('slug'),
            'first_release_date': release_iso,
            'cover_url': cover_url,
            'rating': row.get('aggregated_rating') or row.get('rating'),
            'window': 'upcoming' if (ts or 0) >= int(now.timestamp()) else 'recent',
        })
    return items
