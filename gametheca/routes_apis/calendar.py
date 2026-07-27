"""Release calendar API (IGDB upcoming / recent)."""

from __future__ import annotations

from flask import jsonify, request
from flask_login import login_required

from gametheca.utils.release_calendar import fetch_release_calendar

from . import apis_bp


@apis_bp.route('/calendar', methods=['GET'])
@login_required
def release_calendar():
    try:
        days_ahead = int(request.args.get('days_ahead') or 60)
        days_behind = int(request.args.get('days_behind') or 14)
        limit = int(request.args.get('limit') or 40)
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid query parameters'}), 400
    try:
        items = fetch_release_calendar(
            days_ahead=days_ahead,
            days_behind=days_behind,
            limit=limit,
        )
    except RuntimeError as exc:
        return jsonify({'error': str(exc)}), 502
    return jsonify({
        'days_ahead': days_ahead,
        'days_behind': days_behind,
        'count': len(items),
        'releases': items,
    })
