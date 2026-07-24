"""Register-only store ownership sync APIs (never downloads from stores)."""

from flask import jsonify, request
from flask_login import current_user, login_required

from gametheca.utils.store_ownership import (
    connect_epic_account,
    connect_gog_account,
    connect_steam_account,
    disconnect_epic_account,
    disconnect_gog_account,
    disconnect_steam_account,
    get_ownership_summary,
    import_epic_csv,
    import_gog_csv,
    import_steam_csv,
    is_ownership_sync_enabled,
    sync_steam_owned_games,
)

from . import apis_bp


def _feature_disabled_response():
    return jsonify({'error': 'Store ownership sync is disabled by administrator'}), 403


def _read_csv_payload() -> str:
    if request.is_json:
        data = request.get_json(silent=True) or {}
        return data.get('csv') or ''
    upload = request.files.get('file')
    if upload:
        return upload.read().decode('utf-8', errors='replace')
    return request.form.get('csv') or ''


@apis_bp.route('/ownership', methods=['GET'])
@login_required
def ownership_status():
    return jsonify(get_ownership_summary(current_user.id))


@apis_bp.route('/ownership/steam', methods=['POST'])
@login_required
def connect_steam():
    if not is_ownership_sync_enabled():
        return _feature_disabled_response()
    data = request.get_json(silent=True) or {}
    steam_id = (data.get('steam_id') or '').strip()
    if not steam_id:
        return jsonify({'error': 'steam_id required'}), 400
    try:
        account = connect_steam_account(current_user.id, steam_id)
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    return jsonify({
        'account': account.to_dict(),
        'summary': get_ownership_summary(current_user.id),
    }), 201


@apis_bp.route('/ownership/steam', methods=['DELETE'])
@login_required
def disconnect_steam():
    if not is_ownership_sync_enabled():
        return _feature_disabled_response()
    disconnect_steam_account(current_user.id)
    return jsonify({'summary': get_ownership_summary(current_user.id)})


@apis_bp.route('/ownership/steam/sync', methods=['POST'])
@login_required
def sync_steam():
    if not is_ownership_sync_enabled():
        return _feature_disabled_response()
    try:
        result = sync_steam_owned_games(current_user.id)
    except PermissionError as exc:
        return jsonify({'error': str(exc)}), 403
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    except Exception as exc:
        return jsonify({'error': f'Steam sync failed: {exc}'}), 502
    return jsonify({
        **result,
        'summary': get_ownership_summary(current_user.id),
    })


@apis_bp.route('/ownership/steam/csv', methods=['POST'])
@login_required
def import_steam_csv_route():
    if not is_ownership_sync_enabled():
        return _feature_disabled_response()
    csv_text = _read_csv_payload()
    if not csv_text.strip():
        return jsonify({'error': 'csv content required'}), 400
    try:
        result = import_steam_csv(current_user.id, csv_text)
    except PermissionError as exc:
        return jsonify({'error': str(exc)}), 403
    return jsonify({
        **result,
        'summary': get_ownership_summary(current_user.id),
    })


@apis_bp.route('/ownership/gog', methods=['POST'])
@login_required
def connect_gog():
    if not is_ownership_sync_enabled():
        return _feature_disabled_response()
    data = request.get_json(silent=True) or {}
    gog_user_id = (data.get('gog_user_id') or data.get('user_id') or '').strip() or None
    note = (data.get('note') or '').strip() or None
    account = connect_gog_account(current_user.id, gog_user_id, note)
    return jsonify({
        'account': account.to_dict(),
        'summary': get_ownership_summary(current_user.id),
    }), 201


@apis_bp.route('/ownership/gog', methods=['DELETE'])
@login_required
def disconnect_gog():
    if not is_ownership_sync_enabled():
        return _feature_disabled_response()
    disconnect_gog_account(current_user.id)
    return jsonify({'summary': get_ownership_summary(current_user.id)})


@apis_bp.route('/ownership/gog/csv', methods=['POST'])
@login_required
def import_gog_csv_route():
    if not is_ownership_sync_enabled():
        return _feature_disabled_response()
    csv_text = _read_csv_payload()
    if not csv_text.strip():
        return jsonify({'error': 'csv content required'}), 400
    try:
        result = import_gog_csv(current_user.id, csv_text)
    except PermissionError as exc:
        return jsonify({'error': str(exc)}), 403
    return jsonify({
        **result,
        'summary': get_ownership_summary(current_user.id),
    })


@apis_bp.route('/ownership/epic', methods=['POST'])
@login_required
def connect_epic():
    if not is_ownership_sync_enabled():
        return _feature_disabled_response()
    data = request.get_json(silent=True) or {}
    epic_account_id = (
        data.get('epic_account_id') or data.get('user_id') or ''
    ).strip() or None
    note = (data.get('note') or '').strip() or None
    account = connect_epic_account(current_user.id, epic_account_id, note)
    return jsonify({
        'account': account.to_dict(),
        'summary': get_ownership_summary(current_user.id),
    }), 201


@apis_bp.route('/ownership/epic', methods=['DELETE'])
@login_required
def disconnect_epic():
    if not is_ownership_sync_enabled():
        return _feature_disabled_response()
    disconnect_epic_account(current_user.id)
    return jsonify({'summary': get_ownership_summary(current_user.id)})


@apis_bp.route('/ownership/epic/csv', methods=['POST'])
@login_required
def import_epic_csv_route():
    if not is_ownership_sync_enabled():
        return _feature_disabled_response()
    csv_text = _read_csv_payload()
    if not csv_text.strip():
        return jsonify({'error': 'csv content required'}), 400
    try:
        result = import_epic_csv(current_user.id, csv_text)
    except PermissionError as exc:
        return jsonify({'error': str(exc)}), 403
    return jsonify({
        **result,
        'summary': get_ownership_summary(current_user.id),
    })
