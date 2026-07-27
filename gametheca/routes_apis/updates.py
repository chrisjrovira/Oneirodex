"""Updates inbox — freshness-behind games in one place."""

import os

from flask import jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import or_, select

from gametheca import db
from gametheca.models import Game, GameExtra, GameUpdate
from gametheca.utils.library_acl import apply_game_access_filters
from gametheca.utils.lifecycle import web_client_connected
from gametheca.utils.secondary_scrapers import (
    search_gog_games,
    search_steam_games,
)

from . import apis_bp


def _basename_label(path: str, fallback: str) -> str:
    name = os.path.basename(path.rstrip('\\/')) if path else ''
    return name or fallback


def _pack_row(kind: str, game_uuid: str, version_uuid: str, label: str) -> dict:
    return {
        'kind': kind,
        'uuid': version_uuid,
        'label': label,
        'download_url': f'/download_other/{kind}/{game_uuid}/{version_uuid}',
    }


def _batch_local_packs(game_uuids: list[str]) -> dict[str, list[dict]]:
    """Load update/extra packs for many games in two queries."""
    packs_by_game: dict[str, list[dict]] = {uuid: [] for uuid in game_uuids}
    if not game_uuids:
        return packs_by_game

    updates = db.session.execute(
        select(GameUpdate)
        .filter(GameUpdate.game_uuid.in_(game_uuids))
        .order_by(GameUpdate.created_at.desc())
    ).scalars().all()
    for update in updates:
        packs_by_game.setdefault(update.game_uuid, []).append(
            _pack_row(
                'update',
                update.game_uuid,
                update.uuid,
                f'Update: {_basename_label(update.file_path, update.uuid[:8])}',
            )
        )

    extras = db.session.execute(
        select(GameExtra)
        .filter(GameExtra.game_uuid.in_(game_uuids))
        .order_by(GameExtra.created_at.desc())
    ).scalars().all()
    for extra in extras:
        packs_by_game.setdefault(extra.game_uuid, []).append(
            _pack_row(
                'extra',
                extra.game_uuid,
                extra.uuid,
                f'Extra: {_basename_label(extra.file_path, extra.uuid[:8])}',
            )
        )
    return packs_by_game


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
    packs_by_game = _batch_local_packs([game.uuid for game in games])
    connected = web_client_connected(user_id=current_user.id)

    items = []
    for game in games:
        packs = packs_by_game.get(game.uuid) or []
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
            'client_connected': connected,
        })

    return jsonify({'count': len(items), 'items': items})


@apis_bp.route('/updates/store_search', methods=['GET'])
@login_required
def updates_store_search():
    """Multi-store search for update/DLC discovery (register/match only).

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

    # Bind store hits to library games (steam_app_id, then normalized name).
    steam_ids = {
        int(row['steam_app_id'])
        for row in results
        if row.get('source') == 'steam' and str(row.get('steam_app_id') or '').isdigit()
    }
    games_by_steam: dict[int, Game] = {}
    if steam_ids:
        for game in db.session.execute(
            apply_game_access_filters(
                select(Game).filter(Game.steam_app_id.in_(list(steam_ids))),
                current_user,
            )
        ).scalars().all():
            if game.steam_app_id is not None:
                games_by_steam[int(game.steam_app_id)] = game

    name_keys = {(row.get('name') or '').strip().lower() for row in results if row.get('name')}
    games_by_name: dict[str, Game] = {}
    if name_keys:
        # Bound scan: only games the user can access whose name matches any hit.
        for game in db.session.execute(
            apply_game_access_filters(select(Game), current_user).limit(2000)
        ).scalars().all():
            key = (game.name or '').strip().lower()
            if key in name_keys and key not in games_by_name:
                games_by_name[key] = game

    for row in results:
        matched = None
        sid = row.get('steam_app_id')
        if sid is not None and str(sid).isdigit():
            matched = games_by_steam.get(int(sid))
        if matched is None:
            matched = games_by_name.get((row.get('name') or '').strip().lower())
        if matched is not None:
            row['matched_game_uuid'] = matched.uuid
            row['matched_game_name'] = matched.name
            row['library_url'] = f'/game_details/{matched.uuid}'
        else:
            row['matched_game_uuid'] = None
            row['matched_game_name'] = None
            row['library_url'] = None

    return jsonify({'q': name, 'source': source, 'results': results[: limit * 2]})
