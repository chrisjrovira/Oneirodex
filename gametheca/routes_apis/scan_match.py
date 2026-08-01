"""Admin scan/match policy API (W20-4)."""

from __future__ import annotations

from flask import jsonify, request
from flask_login import login_required

from gametheca.utils.auth import admin_required
from gametheca.utils.scan_match_settings import get_scan_match_config, save_scan_match_config

from . import apis_bp


@apis_bp.route('/admin/scan-match/config', methods=['GET', 'PUT'])
@login_required
@admin_required
def scan_match_config():
    """
    GET: full scan/match policy (snake_case; always includes core + variant keys).
    PUT: partial update; echoes full resolved policy.
    """
    if request.method == 'GET':
        return jsonify(get_scan_match_config())

    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({'error': 'No fields to update'}), 400
    try:
        saved = save_scan_match_config(data)
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    return jsonify(saved)
