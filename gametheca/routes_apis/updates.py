"""Updates inbox — freshness-behind games in one place."""

from flask import jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import or_, select

from gametheca import db
from gametheca.models import Game
from gametheca.utils.library_acl import apply_game_access_filters
from gametheca.utils.secondary_scrapers import (
    search_gog_games,
    search_steam_games,
)

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
    )
    query = apply_game_access_filters(query, current_user)
    query = query.order_by(Game.name.asc()).limit(limit)
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
            'steam_app_id': getattr(g, 'steam_app_id', None),
        }
        for g in games
    ]
    return jsonify({'count': len(items), 'items': items})


@apis_bp.route('/updates/store_search', methods=['GET'])
@login_required
def updates_store_search():
    """Hydra-inspired multi-store search for update/DLC discovery.

    Query: q (name), source=steam|gog|all, limit<=10
    """
    name = (request.args.get('q') or request.args.get('name') or '').strip()
    source = (request.args.get('source') or 'all').strip().lower()
    try:
        limit = min(int(request.args.get('limit') or 8), 10)
    except (TypeError, ValueError):
        limit = 8

    if not name:
        return jsonify({'error': 'q required'}), 400
    if source not in ('steam', 'gog', 'all'):
        return jsonify({'error': 'source must be steam, gog, or all'}), 400

    results = []
    if source in ('steam', 'all'):
        for hit in search_steam_games(name, limit=limit):
            results.append({
                'source': 'steam',
                'name': hit.get('name'),
                'url': hit.get('url') or hit.get('store_url'),
                'steam_app_id': hit.get('steam_app_id') or hit.get('app_id'),
                'score': hit.get('score'),
            })
    if source in ('gog', 'all'):
        for hit in search_gog_games(name, limit=limit):
            results.append({
                'source': 'gog',
                'name': hit.get('name'),
                'url': hit.get('url') or hit.get('store_url'),
                'gog_id': hit.get('gog_id') or hit.get('id'),
                'score': hit.get('score'),
            })

    return jsonify({'q': name, 'source': source, 'results': results[: limit * 2]})
