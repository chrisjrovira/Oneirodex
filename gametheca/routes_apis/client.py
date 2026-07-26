"""Companion client presence APIs."""

import uuid

from flask import jsonify, request
from flask_login import current_user, login_required

from gametheca.utils.api_tokens import require_api_scope, user_has_scope
from gametheca.utils.client_commands import claim_pending_commands, enqueue_client_command
from gametheca.utils.client_lifecycle import load_lifecycle_map, save_lifecycle_records
from gametheca.utils.client_presence import record_client_heartbeat

from . import apis_bp


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
    # Deliver queued Install/Update/Uninstall requests from the web UI.
    payload['commands'] = claim_pending_commands(current_user.id)
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
    try:
        command = enqueue_client_command(
            current_user.id,
            data.get('game_uuid'),
            data.get('action'),
            kind=data.get('kind'),
            version_uuid=data.get('version_uuid'),
        )
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    return jsonify({'ok': True, 'command': command}), 201


@apis_bp.route('/client/commands', methods=['GET'])
@login_required
@require_api_scope('read:library')
def client_commands_get():
    """Explicit poll for pending commands (companion may also use heartbeat)."""
    limit = request.args.get('limit', 10, type=int) or 10
    limit = max(1, min(limit, 25))
    return jsonify({'commands': claim_pending_commands(current_user.id, limit=limit)})
