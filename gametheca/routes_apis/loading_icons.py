"""Loading icon settings API (Wave 2d) — admin lock/rotate + public bootstrap."""

from __future__ import annotations

from flask import jsonify, request
from flask_login import login_required

from gametheca.utils.auth import admin_required
from gametheca.utils.loading_icons import (
    get_loading_icon_settings,
    member_loading_icon_payload,
    save_loading_icon_settings,
)

from . import apis_bp


@apis_bp.route('/loading-icon', methods=['GET'])
def loading_icon_public():
    """Public bootstrap for member/admin loading UIs (no admin auth)."""
    return jsonify(member_loading_icon_payload())


@apis_bp.route('/admin/loading-icon/config', methods=['GET', 'PUT'])
@login_required
@admin_required
def loading_icon_admin_config():
    if request.method == 'GET':
        return jsonify(get_loading_icon_settings(admin=True))
    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({'error': 'No fields to update'}), 400
    try:
        saved = save_loading_icon_settings(data)
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    return jsonify({'status': 'saved', **saved})
