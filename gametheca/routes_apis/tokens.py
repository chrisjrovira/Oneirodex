"""Personal access token management and OpenAPI document endpoints."""

from flask import current_app, jsonify, request, send_file
from flask_login import current_user, login_required
from sqlalchemy import select

from gametheca import db
from gametheca.models import ApiToken
from gametheca.utils.api_tokens import (
    TOKEN_SCOPE_PRESETS,
    VALID_SCOPES,
    generate_api_token,
    is_raw_api_token,
    revoke_api_token,
)

from . import apis_bp

import os


@apis_bp.route('/tokens', methods=['GET'])
@login_required
def list_api_tokens():
    rows = db.session.execute(
        select(ApiToken)
        .filter_by(user_id=current_user.id)
        .order_by(ApiToken.created_at.desc())
    ).scalars().all()
    return jsonify({
        'tokens': [row.to_public_dict() for row in rows],
        'valid_scopes': sorted(VALID_SCOPES),
        'scope_presets': TOKEN_SCOPE_PRESETS,
    })


@apis_bp.route('/tokens', methods=['POST'])
@login_required
def create_api_token():
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'name is required'}), 400
    preset = (data.get('preset') or '').strip().lower()
    scopes = data.get('scopes')
    if preset:
        preset_def = TOKEN_SCOPE_PRESETS.get(preset)
        if preset_def is None:
            return jsonify({'error': f'Unknown preset: {preset}'}), 400
        scopes = preset_def['scopes']
    if scopes is not None and not isinstance(scopes, list):
        return jsonify({'error': 'scopes must be a list'}), 400
    if current_user.role != 'admin' and scopes and 'admin' in scopes:
        return jsonify({'error': 'admin scope requires admin role'}), 403

    row, raw = generate_api_token(current_user, name, scopes)
    # Contract: `secret` is the raw token only — no labels, expiry, or HTML.
    if not is_raw_api_token(raw):
        current_app.logger.error('api_token_create_impure prefix=%s', row.token_prefix)
        return jsonify({'error': 'Token generation failed purity check'}), 500
    return jsonify({
        'token': row.to_public_dict(),
        'secret': raw,
        'warning': 'Store this secret now; it will not be shown again.',
    }), 201


@apis_bp.route('/tokens/<int:token_id>', methods=['DELETE'])
@login_required
def delete_api_token(token_id: int):
    ok = revoke_api_token(token_id, user_id=current_user.id)
    if not ok:
        return jsonify({'error': 'Token not found'}), 404
    return jsonify({'ok': True})


@apis_bp.route('/openapi.json', methods=['GET'])
def openapi_json():
    """Serve the OpenAPI 3 document (public schema; operations still auth-gated)."""
    path = _openapi_path()
    if not os.path.isfile(path):
        return jsonify({'error': 'OpenAPI document not found'}), 404
    return send_file(path, mimetype='application/json')


@apis_bp.route('/openapi.yaml', methods=['GET'])
def openapi_yaml():
    path = _openapi_path().replace('.json', '.yaml')
    if not os.path.isfile(path):
        return jsonify({'error': 'OpenAPI document not found'}), 404
    return send_file(path, mimetype='application/yaml')


def _openapi_path() -> str:
    root = os.path.abspath(os.path.join(current_app.root_path, '..'))
    return os.path.join(root, 'docs', 'openapi', 'openapi.json')
