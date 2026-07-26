"""Updates inbox — freshness-behind games in one place."""

from flask import jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import or_, select

from gametheca import db
from gametheca.models import Game
from gametheca.utils.game_versions import list_game_versions
from gametheca.utils.library_acl import apply_game_access_filters
from gametheca.utils.lifecycle import web_client_connected
from gametheca.utils.secondary_scrapers import (
    search_gog_games,
    search_steam_games,
)

from . import apis_bp


def _public_local_packs(game: Game) -> list[dict]:
    packs = []
    for version in list_game_versions(game):
        kind = version.get('kind')
        if kind not in ('update', 'extra'):
            continue
        version_uuid = version.get('uuid')
        if not version_uuid:
            continue
        packs.append({
            'kind': kind,
            'uuid': version_uuid,
            'label': version.get('label') or kind,
            'download_url': f'/download_other/{kind}/{game.uuid}/{version_uuid}',
        })
    return packs


def _dlc_summary(game: Game) -> dict | None:
    payload = getattr(game, 'freshness_payload', None) or {}
    dlc = payload.get('dlc')
    if isinstance(dlc, dict) and dlc:
        missing = dlc.get('missing_dlc_count_estimate')
        if missing is None:
            missing = dlc.get('missing_count')
        store_count = dlc.get('store_dlc_count')
        if store_count is None:
            store_count = dlc.get('store_count')
        return {
            'store_count': store_count,
            'local_hint': dlc.get('local_dlc_count_hint') or dlc.get('local_hint'),
            'missing_count': missing,
            'store': dlc.get('store'),
        }
    remotes = payload.get('remotes') if isinstance(payload, dict) else None
    if isinstance(remotes, list):
        for remote in remotes:
            if isinstance(remote, dict) and remote.get('dlc_count') is not None:
                return {
                    'store_count': remote.get('dlc_count'),
                    'local_hint': (payload.get('local') or {}).get('dlc_count_hint'),
                    'missing_count': None,
                    'store': remote.get('store'),
                }
    return None


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
    items = []
    for game in games:
        packs = _public_local_packs(game)
        latest_update = next((pack for pack in packs if pack['kind'] == 'update'), None)
        latest_extra = next((pack for pack in packs if pack['kind'] == 'extra'), None)
        items.append({
            'uuid': game.uuid,
            'name': game.name,
            'freshness_status': game.freshness_status,
            'freshness_confidence': game.freshness_confidence,
            'local_version': game.local_version,
            'remote_version_summary': game.remote_version_summary,
            'freshness_checked_at': (
                game.freshness_checked_at.isoformat() if game.freshness_checked_at else None
            ),
            'library_uuid': game.library_uuid,
            'steam_app_id': getattr(game, 'steam_app_id', None),
            'updates_count': sum(1 for pack in packs if pack['kind'] == 'update'),
            'extras_count': sum(1 for pack in packs if pack['kind'] == 'extra'),
            'local_packs': packs,
            'latest_update': latest_update,
            'latest_extra': latest_extra,
            'dlc': _dlc_summary(game),
            'client_connected': False,
        })

    # Presence for Apply buttons — cheap TTL check once per request.
    connected = web_client_connected(user_id=current_user.id)
    for item in items:
        item['client_connected'] = connected

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
