"""Remote play / Moonlight BYO host API (GOW-1/GOW-2)."""

from __future__ import annotations

from flask import jsonify, request
from flask_login import login_required

from oneirodex.utils.api_response import api_error, api_ok
from oneirodex.utils.auth import admin_required
from oneirodex.utils.remote_play import (
    get_remote_play_config,
    member_remote_play_status,
    save_remote_play_config,
)

from . import apis_bp


@apis_bp.route('/remote-play/status', methods=['GET'])
@login_required
def remote_play_status_route():
    """Member-safe status — host + hints only; no operator tokens."""
    return jsonify(member_remote_play_status())


@apis_bp.route('/admin/remote-play/config', methods=['GET', 'PUT'])
@login_required
@admin_required
def remote_play_admin_config_route():
    if request.method == 'GET':
        return jsonify(get_remote_play_config(admin=True))
    data = request.get_json(silent=True) or {}
    if not data:
        return api_error('No fields to update', code='bad_request')
    try:
        saved = save_remote_play_config(data)
    except ValueError as exc:
        return api_error(str(exc), code='bad_request')
    return api_ok({'status': 'saved', **saved})
