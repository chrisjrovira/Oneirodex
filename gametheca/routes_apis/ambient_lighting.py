"""Admin ambient lighting API."""

from __future__ import annotations

from flask import jsonify, request
from flask_login import login_required

from gametheca.utils.auth import admin_required
from gametheca.utils.ambient_lighting import (
    ambient_lighting_status,
    get_ambient_config,
    save_ambient_config,
)

from . import apis_bp


@apis_bp.route('/admin/ambient-lighting/status', methods=['GET'])
@login_required
@admin_required
def ambient_lighting_status_route():
    probe = request.args.get('probe', '').lower() in ('1', 'true', 'yes')
    return jsonify(ambient_lighting_status(probe=probe))


@apis_bp.route('/admin/ambient-lighting/config', methods=['GET', 'PUT'])
@login_required
@admin_required
def ambient_lighting_config_route():
    if request.method == 'GET':
        return jsonify(get_ambient_config())
    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({'error': 'No fields to update'}), 400
    try:
        saved = save_ambient_config(data)
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    return jsonify({'status': 'saved', **saved})


@apis_bp.route('/admin/ambient-lighting/test', methods=['POST'])
@login_required
@admin_required
def ambient_lighting_test_route():
    return jsonify(ambient_lighting_status(probe=True))
