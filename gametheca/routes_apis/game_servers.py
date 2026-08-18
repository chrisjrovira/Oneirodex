"""Household game server registry (admin CRUD, member read)."""

from __future__ import annotations

from gametheca.utils.api_response import api_error, api_ok
from flask import jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import select

from gametheca import db
from gametheca.models import Game, GameServer
from gametheca.utils.game_servers import probe_server_health
from gametheca.utils.rbac import is_admin, normalize_role

from . import apis_bp


def _forbidden(message: str = 'Forbidden'):
    return api_error(message, code='forbidden')


def _require_admin():
    if not current_user.is_authenticated or not is_admin(current_user):
        return _forbidden('Admin required')
    return None


def _server_or_404(server_uuid: str) -> GameServer | None:
    return db.session.execute(
        select(GameServer).filter_by(uuid=server_uuid)
    ).scalars().first()


def _validate_game_uuid(game_uuid: str | None) -> str | None:
    if not game_uuid:
        return None
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game:
        raise ValueError('Game not found')
    return game_uuid


@apis_bp.route('/game-servers', methods=['GET'])
@login_required
def list_game_servers():
    servers = db.session.execute(
        select(GameServer).order_by(GameServer.display_name.asc())
    ).scalars().all()
    admin_view = is_admin(current_user)
    return jsonify({
        'servers': [row.to_dict(admin=admin_view) for row in servers],
    })


@apis_bp.route('/game-servers/<server_uuid>', methods=['GET'])
@login_required
def get_game_server(server_uuid: str):
    server = _server_or_404(server_uuid)
    if not server:
        return api_error('Not found', code='not_found')
    return jsonify(server.to_dict(admin=is_admin(current_user)))


@apis_bp.route('/game-servers/<server_uuid>/status', methods=['GET'])
@login_required
def get_game_server_status(server_uuid: str):
    server = _server_or_404(server_uuid)
    if not server:
        return api_error('Not found', code='not_found')
    health = probe_server_health(server.connect_string, server.health_url)
    return jsonify({
        'uuid': server.uuid,
        'display_name': server.display_name,
        **health,
    })


@apis_bp.route('/game-servers', methods=['POST'])
@login_required
def create_game_server():
    denied = _require_admin()
    if denied:
        return denied
    data = request.get_json(silent=True) or {}
    display_name = (data.get('display_name') or '').strip()
    connect_string = (data.get('connect_string') or '').strip()
    if not display_name or not connect_string:
        return api_error('display_name and connect_string required', code='bad_request')
    try:
        game_uuid = _validate_game_uuid((data.get('game_uuid') or '').strip() or None)
    except ValueError as exc:
        return api_error(str(exc), code='bad_request')
    server = GameServer(
        display_name=display_name,
        connect_string=connect_string,
        game_uuid=game_uuid,
        health_url=(data.get('health_url') or '').strip() or None,
        compose_project=(data.get('compose_project') or '').strip() or None,
        container_id=(data.get('container_id') or '').strip() or None,
        invite_note=(data.get('invite_note') or '').strip() or None,
    )
    db.session.add(server)
    db.session.commit()
    return jsonify(server.to_dict(admin=True)), 201


@apis_bp.route('/game-servers/<server_uuid>', methods=['PUT', 'PATCH'])
@login_required
def update_game_server(server_uuid: str):
    denied = _require_admin()
    if denied:
        return denied
    server = _server_or_404(server_uuid)
    if not server:
        return api_error('Not found', code='not_found')
    data = request.get_json(silent=True) or {}
    if 'display_name' in data:
        display_name = (data.get('display_name') or '').strip()
        if not display_name:
            return api_error('display_name cannot be empty', code='bad_request')
        server.display_name = display_name
    if 'connect_string' in data:
        connect_string = (data.get('connect_string') or '').strip()
        if not connect_string:
            return api_error('connect_string cannot be empty', code='bad_request')
        server.connect_string = connect_string
    if 'game_uuid' in data:
        try:
            server.game_uuid = _validate_game_uuid(
                (data.get('game_uuid') or '').strip() or None
            )
        except ValueError as exc:
            return api_error(str(exc), code='bad_request')
    for field in ('health_url', 'compose_project', 'container_id', 'invite_note'):
        if field in data:
            value = data.get(field)
            setattr(server, field, (value or '').strip() or None)
    db.session.commit()
    return jsonify(server.to_dict(admin=True))


@apis_bp.route('/game-servers/<server_uuid>', methods=['DELETE'])
@login_required
def delete_game_server(server_uuid: str):
    denied = _require_admin()
    if denied:
        return denied
    server = _server_or_404(server_uuid)
    if not server:
        return api_error('Not found', code='not_found')
    db.session.delete(server)
    db.session.commit()
    return api_ok({'uuid': server_uuid})


@apis_bp.route('/game-servers/acl-check', methods=['GET'])
@login_required
def game_servers_acl_check():
    """Lightweight role hint for UI (member read vs admin CRUD)."""
    role = normalize_role(getattr(current_user, 'role', None))
    return jsonify({
        'role': role,
        'can_manage': is_admin(current_user),
        'can_read': True,
        'read_only': role == 'child',
    })
