"""Admin challenge solver API."""

from __future__ import annotations

from flask import jsonify, request
from flask_login import login_required

from gametheca.utils.api_response import api_error, api_ok
from gametheca.utils.auth import admin_required
from gametheca.utils.challenge_solver import (
    challenge_solver_status,
    get_challenge_config,
    save_challenge_config,
)

from . import apis_bp


@apis_bp.route('/admin/challenge-solver/status', methods=['GET'])
@login_required
@admin_required
def challenge_solver_status_route():
    probe = request.args.get('probe', '').lower() in ('1', 'true', 'yes')
    return jsonify(challenge_solver_status(probe=probe))


@apis_bp.route('/admin/challenge-solver/config', methods=['GET', 'PUT'])
@login_required
@admin_required
def challenge_solver_config_route():
    if request.method == 'GET':
        return jsonify(get_challenge_config())
    data = request.get_json(silent=True) or {}
    if not data:
        return api_error('No fields to update', code='bad_request')
    try:
        saved = save_challenge_config(data)
    except ValueError as exc:
        return api_error(str(exc), code='bad_request')
    return api_ok({'status': 'saved', **saved})


@apis_bp.route('/admin/challenge-solver/test', methods=['POST'])
@login_required
@admin_required
def challenge_solver_test_route():
    return jsonify(challenge_solver_status(probe=True))
