"""Frontend export + plugin/activity/mods API routes (Waves 8–11)."""

from __future__ import annotations

from flask import Response, current_app, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import select

from gametheca import db
from gametheca.models import Game
from gametheca.utils.activity_feed import list_now_playing, list_recent_activity
from gametheca.utils.auth import admin_required
from gametheca.utils.frontend_export import build_es_de_gamelist, build_pegasus_metadata
from gametheca.utils.game_mods import load_mods, mods_enabled, save_mods
from gametheca.utils.library_acl import apply_game_access_filters, user_can_access_game
from gametheca.utils.plugins import get_plugin, list_plugins
from gametheca.utils.rbac import normalize_role

from . import apis_bp


def _games_for_platform(platform: str | None, *, limit: int = 500) -> list[Game]:
    query = Game.query
    query = apply_game_access_filters(query, current_user)
    games = list(query.limit(limit).all())
    if not platform:
        return games
    key = platform.upper()
    out = []
    for game in games:
        lib = getattr(game, 'library', None)
        plat = getattr(lib, 'platform', None) if lib else None
        name = getattr(plat, 'name', None) if plat is not None else None
        if name and str(name).upper() == key:
            out.append(game)
    return out


def _game_rows(games: list[Game]) -> list[dict]:
    rows = []
    for game in games:
        rows.append({
            'uuid': game.uuid,
            'name': game.name,
            'summary': getattr(game, 'summary', None) or '',
            'path': getattr(game, 'full_disk_path', None) or game.name,
            'cover_url': getattr(game, 'cover', None) or '',
            'developer': '',
            'publisher': '',
            'genre': '',
        })
    return rows


@apis_bp.route('/export/esde', methods=['GET'])
@login_required
def export_esde():
    platform = (request.args.get('platform') or '').strip()
    games = _games_for_platform(platform or None)
    xml = build_es_de_gamelist(_game_rows(games), system=platform or 'all')
    return Response(
        xml,
        mimetype='application/xml',
        headers={'Content-Disposition': f'attachment; filename="gamelist-{platform or "all"}.xml"'},
    )


@apis_bp.route('/export/pegasus', methods=['GET'])
@login_required
def export_pegasus():
    platform = (request.args.get('platform') or '').strip() or 'Library'
    games = _games_for_platform(platform if platform != 'Library' else None)
    text = build_pegasus_metadata(_game_rows(games), collection=platform)
    return Response(
        text,
        mimetype='text/plain',
        headers={'Content-Disposition': f'attachment; filename="metadata-{platform}.pegasus.txt"'},
    )


@apis_bp.route('/plugins', methods=['GET'])
@login_required
@admin_required
def plugins_list():
    category = request.args.get('category')
    return jsonify({'plugins': list_plugins(category=category)})


@apis_bp.route('/plugins/<plugin_id>', methods=['GET'])
@login_required
@admin_required
def plugins_get(plugin_id):
    row = get_plugin(plugin_id)
    if not row:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(row)


@apis_bp.route('/activity', methods=['GET'])
@login_required
def activity_feed():
    role = normalize_role(getattr(current_user, 'role', None))
    # Child accounts only see their own sessions via playtime/me; keep feed for others.
    if role == 'child':
        return jsonify({'activity': [], 'now_playing': [], 'restricted': True})
    limit = min(100, max(1, int(request.args.get('limit') or 25)))
    return jsonify({
        'activity': list_recent_activity(limit=limit, viewer=current_user),
        'now_playing': list_now_playing(viewer=current_user),
    })


@apis_bp.route('/games/<game_uuid>/mods', methods=['GET'])
@login_required
def get_game_mods(game_uuid):
    if not mods_enabled():
        return jsonify({'enabled': False, 'mods': []})
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game:
        return jsonify({'error': 'Game not found'}), 404
    if not user_can_access_game(current_user, game):
        return jsonify({'error': 'Forbidden'}), 403
    pack = load_mods(game_uuid)
    return jsonify({'enabled': True, **pack})


@apis_bp.route('/games/<game_uuid>/mods', methods=['PUT', 'POST'])
@login_required
@admin_required
def put_game_mods(game_uuid):
    if not mods_enabled():
        return jsonify({'error': 'ENABLE_MOD_TRACKING is off'}), 403
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game:
        return jsonify({'error': 'Game not found'}), 404
    data = request.get_json(silent=True) or {}
    mods = data.get('mods') if isinstance(data.get('mods'), list) else []
    return jsonify({'ok': True, **save_mods(game_uuid, mods)})


@apis_bp.route('/emulator/health', methods=['GET'])
@login_required
def emulator_core_health():
    from gametheca.platform import WEBRETR_INSTALLED_CORES, core_is_browser_playable

    cores = sorted(WEBRETR_INSTALLED_CORES)
    return jsonify({
        'installed_cores': cores,
        'pcdos_browser': bool(current_app.config.get('ENABLE_PCDOS_BROWSER')),
        'core_checks': {core: core_is_browser_playable(core) for core in cores},
    })
