"""Wanted update/DLC queue APIs."""

from flask import jsonify

from oneirodex.utils.api_response import api_error, api_ok
from flask_login import current_user, login_required
from sqlalchemy import select

from oneirodex import db
from oneirodex.models import Game
from oneirodex.utils.library_acl import user_can_access_game
from oneirodex.utils.wanted_updates import add_wanted, list_wanted, mark_fulfilled
from oneirodex.schemas.wanted import AddWantedBody, FulfillWantedBody
from oneirodex.utils.validation import validate_body

from . import apis_bp


@apis_bp.route('/updates/wanted', methods=['GET'])
@login_required
def updates_wanted_list():
    return jsonify({'items': list_wanted(current_user.id)})


@apis_bp.route('/updates/wanted', methods=['POST'])
@login_required
@validate_body(AddWantedBody)
def updates_wanted_add(body: AddWantedBody):
    game_uuid = body.game_uuid
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game:
        return api_error('Game not found', code='not_found')
    if not user_can_access_game(current_user, game):
        return api_error('You do not have access to that game', code='forbidden')
    try:
        item = add_wanted(
            current_user.id,
            game_uuid=game_uuid,
            kind=body.kind or 'update',
            label=body.label or game.name,
            store=body.store,
            store_id=body.store_id,
        )
    except ValueError as exc:
        return api_error(str(exc), code='bad_request')
    return api_ok({'item': item}, status=201)


@apis_bp.route('/updates/wanted/fulfill', methods=['POST'])
@login_required
@validate_body(FulfillWantedBody)
def updates_wanted_fulfill(body: FulfillWantedBody):
    """Mark wanted rows available when a local pack appears (member or scan hook)."""
    count = mark_fulfilled(current_user.id, body.game_uuid, kind=body.kind)
    return api_ok({'updated': count})
