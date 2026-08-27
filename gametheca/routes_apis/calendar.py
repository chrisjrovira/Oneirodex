"""Release calendar API (IGDB upcoming / recent)."""

from __future__ import annotations

from datetime import datetime, timezone

from flask import jsonify, request
from flask_login import login_required

from gametheca.utils.api_response import api_error
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
        return api_error('Invalid query parameters', code='bad_request')

    days_ahead = max(1, min(days_ahead, 180))
    days_behind = max(0, min(days_behind, 90))
    limit = max(1, min(limit, 100))

    generated_at = datetime.now(timezone.utc).isoformat()
    # Per-request status dict, not module state: two members loading the
    # calendar at once must not be able to read each other's failure reason.
    status: dict = {}
    try:
        items = fetch_release_calendar(
            days_ahead=days_ahead,
            days_behind=days_behind,
            limit=limit,
            status=status,
        )
    except Exception:
        # Belt-and-suspenders: never 500 the hub for IGDB blips.
        items = []
        reason = 'unavailable'
    else:
        reason = status.get('reason')

    return jsonify({
        'days_ahead': days_ahead,
        'days_behind': days_behind,
        'limit': limit,
        'count': len(items),
        'releases': items,
        'generated_at': generated_at,
        'source': 'igdb',
        # Still HTTP 200 with an empty list — the hub must not 500 for an IGDB
        # blip — but the page can now tell "nothing releases in this window"
        # from "IGDB is not set up", instead of rendering the same blank panel
        # for both and leaving the operator to guess.
        'empty_reason': reason if not items else None,
    })
