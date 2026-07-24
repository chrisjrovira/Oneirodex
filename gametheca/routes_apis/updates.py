"""Updates inbox — freshness-behind games in one place."""

from flask import jsonify, request
from flask_login import login_required
from sqlalchemy import or_, select

from gametheca import db
from gametheca.models import Game

from . import apis_bp


@apis_bp.route('/updates/inbox', methods=['GET'])
@login_required
def updates_inbox():
    """List games that look behind store versions (member + librarian/admin)."""
    try:
        limit = min(int(request.args.get('limit') or 50), 200)
    except (TypeError, ValueError):
        limit = 50
    library_uuid = (request.args.get('library_uuid') or '').strip() or None

    query = select(Game).filter(
        or_(
            Game.freshness_status == 'behind',
            Game.freshness_status == 'heuristic_behind',
        )
    ).order_by(Game.name.asc()).limit(limit)
    if library_uuid:
        query = query.filter(Game.library_uuid == library_uuid)

    games = db.session.execute(query).scalars().all()
    items = [
        {
            'uuid': g.uuid,
            'name': g.name,
            'freshness_status': g.freshness_status,
            'freshness_confidence': g.freshness_confidence,
            'local_version': g.local_version,
            'remote_version_summary': g.remote_version_summary,
            'freshness_checked_at': g.freshness_checked_at.isoformat() if g.freshness_checked_at else None,
            'library_uuid': g.library_uuid,
        }
        for g in games
    ]
    return jsonify({'count': len(items), 'items': items})
