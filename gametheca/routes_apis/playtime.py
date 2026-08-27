"""Playtime session APIs."""

from flask import jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import select

from gametheca import db
from gametheca.models import Game, PlaySession, UserGameProgress
from gametheca.utils.api_response import api_error
from gametheca.utils.library_acl import user_can_access_game
from gametheca.utils.playtime import end_session, heartbeat_session, start_session

from . import apis_bp


@apis_bp.route('/playtime/sessions', methods=['POST'])
@login_required
def playtime_start():
    data = request.get_json(silent=True) or {}
    game_uuid = (data.get('game_uuid') or '').strip()
    if not game_uuid:
        return api_error('game_uuid required', code='bad_request')
    try:
        session = start_session(current_user.id, game_uuid, client=data.get('client'))
    except PermissionError:
        return api_error('Forbidden', code='forbidden')
    except ValueError as exc:
        return api_error(str(exc), code='not_found')
    return jsonify(session.to_dict()), 201


@apis_bp.route('/playtime/sessions/<int:session_id>/heartbeat', methods=['POST'])
@login_required
def playtime_heartbeat(session_id: int):
    session = db.session.get(PlaySession, session_id)
    if not session or session.user_id != current_user.id:
        return api_error('Session not found', code='not_found')
    try:
        session = heartbeat_session(session)
    except ValueError as exc:
        return api_error(str(exc), code='bad_request')
    return jsonify(session.to_dict())


@apis_bp.route('/playtime/sessions/<int:session_id>/stop', methods=['POST'])
@login_required
def playtime_stop(session_id: int):
    session = db.session.get(PlaySession, session_id)
    if not session or session.user_id != current_user.id:
        return api_error('Session not found', code='not_found')
    session = end_session(session)
    return jsonify(session.to_dict())


@apis_bp.route('/playtime/me', methods=['GET'])
@login_required
def playtime_me():
    rows = db.session.execute(
        select(UserGameProgress)
        .filter_by(user_id=current_user.id)
        .order_by(UserGameProgress.last_played_at.desc())
        .limit(100)
    ).scalars().all()
    total = sum(int(r.total_seconds or 0) for r in rows)
    game_uuids = [r.game_uuid for r in rows]
    names = {}
    if game_uuids:
        for game in db.session.execute(select(Game).filter(Game.uuid.in_(game_uuids))).scalars().all():
            names[game.uuid] = game.name
    games = []
    for row in rows:
        payload = row.to_dict()
        payload['game_name'] = names.get(row.game_uuid) or row.game_uuid
        games.append(payload)
    return jsonify({
        'total_seconds': total,
        'games': games,
    })


@apis_bp.route('/playtime/games/<game_uuid>', methods=['GET'])
@login_required
def playtime_for_game(game_uuid: str):
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game or not user_can_access_game(current_user, game):
        return api_error('Forbidden', code='forbidden')
    row = db.session.execute(
        select(UserGameProgress).filter_by(user_id=current_user.id, game_uuid=game_uuid)
    ).scalars().first()
    if not row:
        return jsonify({
            'user_id': current_user.id,
            'game_uuid': game_uuid,
            'total_seconds': 0,
            'session_count': 0,
            'last_played_at': None,
        })
    return jsonify(row.to_dict())
