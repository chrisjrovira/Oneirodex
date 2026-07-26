"""Companion client presence APIs."""

import uuid

from flask import g, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import select

from gametheca import db
from gametheca.models import Game, GameExtra, GameUpdate
from gametheca.utils.api_tokens import require_api_scope, user_has_scope
from gametheca.utils.client_commands import (
    ack_client_commands,
    claim_pending_commands,
    enqueue_client_command,
    nack_client_commands,
)
from gametheca.utils.client_lifecycle import load_lifecycle_map, save_lifecycle_records
from gametheca.utils.client_presence import record_client_heartbeat
from gametheca.utils.library_acl import user_can_access_game

from . import apis_bp


def _has_companion_token() -> bool:
    return getattr(g, 'api_token', None) is not None


@apis_bp.route('/client/heartbeat', methods=['POST'])
@login_required
def client_heartbeat():
    data = request.get_json(silent=True) or {}
    device_id = (data.get('device_id') or '').strip()
    if not device_id:
        device_id = str(uuid.uuid4())

    device = record_client_heartbeat(
        current_user.id,
        device_id,
        device_name=data.get('device_name'),
        client_version=data.get('client_version'),
        user_agent=request.headers.get('User-Agent'),
    )
    payload = device.to_dict()
    # Only deliver the queue to Bearer companion tokens (not browser session CSRF).
    if _has_companion_token():
        payload['commands'] = claim_pending_commands(current_user.id)
    else:
        payload['commands'] = []
    return jsonify(payload)


@apis_bp.route('/client/lifecycle', methods=['GET'])
@login_required
@require_api_scope('read:library')
def client_lifecycle_get():
    mapping = load_lifecycle_map(current_user.id)
    records = [{'game_uuid': uuid, 'state': state} for uuid, state in mapping.items()]
    return jsonify({'records': records})


@apis_bp.route('/client/lifecycle', methods=['POST'])
@login_required
def client_lifecycle_post():
    # Sec-B: Bearer-only — CSRF-exempt endpoint must not accept session cookie alone.
    if not _has_companion_token():
        return jsonify({'error': 'Companion API token required'}), 403
    # Companion tokens typically carry write:download; library write also accepted.
    if not (
        user_has_scope('write:download')
        or user_has_scope('write:library')
    ):
        return jsonify({'error': 'Missing scope: write:download or write:library'}), 403
    data = request.get_json(silent=True) or {}
    records = data.get('records')
    if not isinstance(records, list):
        return jsonify({'error': 'records must be a list'}), 400
    replace = bool(data.get('replace'))
    mapping = save_lifecycle_records(current_user.id, records, replace=replace)
    return jsonify({
        'ok': True,
        'count': len(mapping),
        'records': [{'game_uuid': uuid, 'state': state} for uuid, state in mapping.items()],
    })


@apis_bp.route('/client/commands', methods=['POST'])
@login_required
def client_commands_post():
    """Queue a companion action from the member SPA / game details island."""
    data = request.get_json(silent=True) or {}
    game_uuid = (data.get('game_uuid') or '').strip()
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game:
        return jsonify({'error': 'Game not found'}), 404
    if not user_can_access_game(current_user, game):
        return jsonify({'error': 'Forbidden'}), 403

    kind = data.get('kind')
    version_uuid = (data.get('version_uuid') or '').strip() or None
    if kind in ('update', 'extra') and version_uuid:
        Model = GameUpdate if kind == 'update' else GameExtra
        pack = db.session.execute(
            select(Model).filter_by(game_uuid=game.uuid, uuid=version_uuid)
        ).scalars().first()
        if not pack:
            return jsonify({'error': 'Version not found for game'}), 404

    try:
        command = enqueue_client_command(
            current_user.id,
            game_uuid,
            data.get('action'),
            kind=kind,
            version_uuid=version_uuid,
        )
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    return jsonify({'ok': True, 'command': command}), 201


@apis_bp.route('/client/commands', methods=['GET'])
@login_required
@require_api_scope('read:library')
def client_commands_get():
    """Explicit poll for pending commands (companion may also use heartbeat)."""
    if not _has_companion_token():
        return jsonify({'error': 'Companion API token required'}), 403
    limit = request.args.get('limit', 10, type=int) or 10
    limit = max(1, min(limit, 25))
    return jsonify({'commands': claim_pending_commands(current_user.id, limit=limit)})


@apis_bp.route('/client/commands/ack', methods=['POST'])
@login_required
def client_commands_ack():
    if not _has_companion_token():
        return jsonify({'error': 'Companion API token required'}), 403
    data = request.get_json(silent=True) or {}
    ids = data.get('ids') if isinstance(data.get('ids'), list) else []
    removed = ack_client_commands(current_user.id, [str(i) for i in ids])
    return jsonify({'ok': True, 'removed': removed})


@apis_bp.route('/client/commands/nack', methods=['POST'])
@login_required
def client_commands_nack():
    if not _has_companion_token():
        return jsonify({'error': 'Companion API token required'}), 403
    data = request.get_json(silent=True) or {}
    ids = data.get('ids') if isinstance(data.get('ids'), list) else []
    released = nack_client_commands(current_user.id, [str(i) for i in ids])
    return jsonify({'ok': True, 'released': released})
