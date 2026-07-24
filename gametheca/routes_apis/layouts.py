"""Detail layout API."""

from __future__ import annotations

from flask import jsonify, request
from flask_login import login_required

from gametheca.utils.auth import admin_required
from gametheca.utils.detail_layouts import get_detail_layout, save_detail_layout

from . import apis_bp


@apis_bp.route('/layouts/detail', methods=['GET'])
@login_required
def layouts_detail_get():
    return jsonify(get_detail_layout())


@apis_bp.route('/layouts/detail', methods=['PUT'])
@login_required
@admin_required
def layouts_detail_put():
    data = request.get_json(silent=True) or {}
    try:
        saved = save_detail_layout(data)
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    return jsonify(saved)
