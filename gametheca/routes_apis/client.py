"""Companion client presence APIs."""

import uuid

from flask import jsonify, request
from flask_login import current_user, login_required

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
