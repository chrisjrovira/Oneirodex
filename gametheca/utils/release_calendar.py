"""IGDB-backed release calendar (upcoming + recent)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from gametheca.utils.igdb_api import make_igdb_api_request


def fetch_release_calendar(
    *,
    days_ahead: int = 60,
    days_behind: int = 14,
    limit: int = 40,
    status: dict | None = None,
) -> list[dict]:
    """
    Return IGDB games with first_release_date in [now-behind, now+ahead].
    Artwork/metadata only — never downloads games.

    When IGDB is off, misconfigured, or returns empty/error, returns ``[]``
    (never raises for empty/off — callers return stable HTTP 200).

    Pass ``status`` — any dict — to learn *why* the list is empty: it is filled
    in with ``reason`` (None for "genuinely nothing in this window",
    'not_configured', or 'unavailable') and ``detail``. Callers that only want
    the rows omit it and are unaffected.

    An out-parameter rather than the module-level ``last_status`` this replaced:
    that was one dict shared by every worker thread, so a request that failed
    could overwrite the reason a concurrent request was about to read, and the
    calendar would tell one member IGDB was unreachable because someone else's
    fetch had just failed. The status now belongs to the call that asked for it.
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
    # Why it is empty is recorded, not discarded (W27).
    #
    # Every failure here used to return a bare `[]`, so "IGDB is not
    # configured", "the call failed" and "nothing releases in this window" were
    # indistinguishable to the page — which is why the calendar showed a blank
    # panel and said nothing about it.
    #
    # Both keys are set on every path, including the happy one, so a reused dict
    # cannot leak a stale reason or detail from an earlier call.
    def _record(reason=None, detail=None):
        if status is not None:
            status['reason'] = reason
            status['detail'] = detail

    try:
        raw = make_igdb_api_request('https://api.igdb.com/v4/games', body)
    except Exception as exc:
        _record('unavailable', str(exc))
        return []
    if not isinstance(raw, list):
        # IGDB off / auth fail / unexpected payload. `make_igdb_api_request`
        # returns a non-list for all three, so they cannot be told apart here —
        # 'not_configured' is the overwhelmingly common cause on a fresh
        # install, and the page words it as "check IGDB credentials" rather
        # than asserting which of the three it was.
        _record('not_configured')
        return []

    _record()

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
