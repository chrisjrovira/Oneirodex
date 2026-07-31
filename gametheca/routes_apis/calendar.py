"""Release calendar API (IGDB upcoming / recent)."""

from __future__ import annotations

from datetime import datetime, timezone

from flask import jsonify, request
from flask_login import login_required

from gametheca.utils.release_calendar import fetch_release_calendar

from . import apis_bp


@apis_bp.route('/calendar', methods=['GET'])
@login_required
def release_calendar():
    """IGDB release window for the Updates / Calendar hub.

    Query: days_ahead (1–180, default 60), days_behind (0–90, default 14),
    limit (1–100, default 40). Always returns HTTP 200 with ``releases`` list
    when IGDB is off/empty (never 500 for empty catalog).
    """
    try:
        days_ahead = int(request.args.get('days_ahead') or 60)
        days_behind = int(request.args.get('days_behind') or 14)
        limit = int(request.args.get('limit') or 40)
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid query parameters'}), 400

    days_ahead = max(1, min(days_ahead, 180))
    days_behind = max(0, min(days_behind, 90))
    limit = max(1, min(limit, 100))

    generated_at = datetime.now(timezone.utc).isoformat()
    try:
        items = fetch_release_calendar(
            days_ahead=days_ahead,
            days_behind=days_behind,
            limit=limit,
        )
    except Exception:
        # Belt-and-suspenders: never 500 the hub for IGDB blips.
        items = []

    return jsonify({
        'days_ahead': days_ahead,
        'days_behind': days_behind,
        'limit': limit,
        'count': len(items),
        'releases': items,
        'generated_at': generated_at,
        'source': 'igdb',
    })
