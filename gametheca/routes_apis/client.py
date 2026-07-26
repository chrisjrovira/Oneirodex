"""Companion client presence APIs."""

import uuid

from flask import jsonify, request
from flask_login import current_user, login_required

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
    return jsonify(device.to_dict())


@apis_bp.route('/client/lifecycle', methods=['GET'])
@login_required
def client_lifecycle_get():
    mapping = load_lifecycle_map(current_user.id)
    records = [{'game_uuid': uuid, 'state': state} for uuid, state in mapping.items()]
    return jsonify({'records': records})


@apis_bp.route('/client/lifecycle', methods=['POST'])
@login_required
def client_lifecycle_post():
    data = request.get_json(silent=True) or {}
    records = data.get('records')
    if not isinstance(records, list):
        return jsonify({'error': 'records must be a list'}), 400
    mapping = save_lifecycle_records(current_user.id, records)
    return jsonify({
        'ok': True,
        'count': len(mapping),
        'records': [{'game_uuid': uuid, 'state': state} for uuid, state in mapping.items()],
    })
