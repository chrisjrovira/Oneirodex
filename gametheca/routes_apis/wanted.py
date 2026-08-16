"""Wanted update/DLC queue APIs."""

from flask import jsonify, request

from gametheca.utils.api_response import api_error, api_ok
from flask_login import current_user, login_required
from sqlalchemy import select

from gametheca import db
from gametheca.models import Game
from gametheca.utils.library_acl import user_can_access_game
from gametheca.utils.wanted_updates import add_wanted, list_wanted, mark_fulfilled

from . import apis_bp


@apis_bp.route('/updates/wanted', methods=['GET'])
@login_required
def updates_wanted_list():
    return jsonify({'items': list_wanted(current_user.id)})


@apis_bp.route('/updates/wanted', methods=['POST'])
@login_required
def updates_wanted_add():
    data = request.get_json(silent=True) or {}
    game_uuid = (data.get('game_uuid') or '').strip()
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game:
        return api_error('Game not found', code='not_found')
    if not user_can_access_game(current_user, game):
        return api_error('You do not have access to that game', code='forbidden')
    try:
        item = add_wanted(
            current_user.id,
            game_uuid=game_uuid,
            kind=data.get('kind') or 'update',
            label=data.get('label') or game.name,
            store=data.get('store'),
            store_id=data.get('store_id'),
        )
    except ValueError as exc:
        return api_error(str(exc), code='bad_request')
    return api_ok({'item': item}, status=201)


@apis_bp.route('/updates/wanted/fulfill', methods=['POST'])
@login_required
def updates_wanted_fulfill():
    """Mark wanted rows available when a local pack appears (member or scan hook)."""
    data = request.get_json(silent=True) or {}
    game_uuid = (data.get('game_uuid') or '').strip()
    if not game_uuid:
        return api_error('game_uuid is required', code='bad_request')
    count = mark_fulfilled(current_user.id, game_uuid, kind=data.get('kind'))
    return api_ok({'updated': count})
