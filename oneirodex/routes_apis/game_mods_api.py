"""Per-game mod registry CRUD (ENABLE_MOD_TRACKING)."""

from __future__ import annotations

from oneirodex.utils.api_response import api_error, api_ok
from flask import jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import select

from oneirodex import db
from oneirodex.models import Game
from oneirodex.utils.game_mods import (
    create_mod,
    delete_mod,
    list_mods_summary,
    load_mods,
    mods_enabled,
    save_mods,
    update_mod,
)
from oneirodex.utils.library_acl import apply_game_access_filters, user_can_access_game
from oneirodex.utils.rbac import is_librarian, normalize_role

from . import apis_bp


def _mods_disabled():
    return api_error('ENABLE_MOD_TRACKING is off', code='forbidden', enabled=False)


def _forbidden(message: str = 'Forbidden'):
    return api_error(message, code='forbidden')


def _require_librarian():
    if not current_user.is_authenticated or not is_librarian(current_user):
        return _forbidden('Librarian or admin required')
    if normalize_role(current_user.role) == 'child':
        return _forbidden('Child accounts are read-only for mods')
    return None


def _game_or_404(game_uuid: str) -> Game | None:
    return db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()


def _require_game_read(game: Game | None):
    if not game:
        return api_error('Game not found', code='not_found')
    if not user_can_access_game(current_user, game):
        return _forbidden()
    return None


@apis_bp.route('/mods/summary', methods=['GET'])
@login_required
def mods_summary():
    if not mods_enabled():
        return jsonify({'enabled': False, 'games': []})
    query = apply_game_access_filters(Game.query, current_user)
    games = query.all()
    rows = list_mods_summary([game.uuid for game in games])
    by_uuid = {game.uuid: game.name for game in games}
    payload = []
    for row in rows:
        payload.append({
            **row,
            'game_name': by_uuid.get(row['game_uuid']),
        })
    return jsonify({'enabled': True, 'games': payload})


@apis_bp.route('/games/<game_uuid>/mods', methods=['GET'])
@login_required
def get_game_mods(game_uuid: str):
    if not mods_enabled():
        return jsonify({'enabled': False, 'mods': []})
    game = _game_or_404(game_uuid)
    denied = _require_game_read(game)
    if denied:
        return denied
    pack = load_mods(game_uuid)
    return jsonify({'enabled': True, **pack})


@apis_bp.route('/games/<game_uuid>/mods', methods=['POST'])
@login_required
def post_game_mod(game_uuid: str):
    if not mods_enabled():
        return _mods_disabled()
    denied = _require_librarian()
    if denied:
        return denied
    game = _game_or_404(game_uuid)
    read_denied = _require_game_read(game)
    if read_denied:
        return read_denied
    data = request.get_json(silent=True) or {}
    try:
        created = create_mod(game_uuid, data)
    except ValueError as exc:
        return api_error(str(exc), code='bad_request')
    return api_ok({'mod': created}, status=201)


@apis_bp.route('/games/<game_uuid>/mods/<mod_id>', methods=['PUT', 'PATCH'])
@login_required
def patch_game_mod(game_uuid: str, mod_id: str):
    if not mods_enabled():
        return _mods_disabled()
    denied = _require_librarian()
    if denied:
        return denied
    game = _game_or_404(game_uuid)
    read_denied = _require_game_read(game)
    if read_denied:
        return read_denied
    data = request.get_json(silent=True) or {}
    try:
        updated = update_mod(game_uuid, mod_id, data)
    except LookupError:
        return api_error('Mod not found', code='not_found')
    except ValueError as exc:
        return api_error(str(exc), code='bad_request')
    return api_ok({'mod': updated})


@apis_bp.route('/games/<game_uuid>/mods/<mod_id>', methods=['DELETE'])
@login_required
def delete_game_mod(game_uuid: str, mod_id: str):
    if not mods_enabled():
        return _mods_disabled()
    denied = _require_librarian()
    if denied:
        return denied
    game = _game_or_404(game_uuid)
    read_denied = _require_game_read(game)
    if read_denied:
        return read_denied
    if not delete_mod(game_uuid, mod_id):
        return api_error('Mod not found', code='not_found')
    return api_ok({'id': mod_id})


@apis_bp.route('/games/<game_uuid>/mods', methods=['PUT'])
@login_required
def put_game_mods_bulk(game_uuid: str):
    """Replace the full mod list (librarian/admin)."""
    if not mods_enabled():
        return _mods_disabled()
    denied = _require_librarian()
    if denied:
        return denied
    game = _game_or_404(game_uuid)
    read_denied = _require_game_read(game)
    if read_denied:
        return read_denied
    data = request.get_json(silent=True) or {}
    mods = data.get('mods') if isinstance(data.get('mods'), list) else []
    return api_ok({**save_mods(game_uuid, mods)})
