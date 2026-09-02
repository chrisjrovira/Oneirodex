"""Register-only store ownership sync APIs (never downloads from stores)."""

from oneirodex.utils.api_response import api_error, api_ok
from flask import jsonify, request
from flask_login import current_user, login_required

from oneirodex.utils.store_ownership import (
    connect_amazon_account,
    connect_epic_account,
    connect_gog_account,
    connect_steam_account,
    disconnect_amazon_account,
    disconnect_epic_account,
    disconnect_gog_account,
    disconnect_steam_account,
    get_ownership_summary,
    import_amazon_csv,
    import_epic_csv,
    import_gog_csv,
    import_meta_quest_csv,
    import_steam_csv,
    is_ownership_sync_enabled,
    sync_amazon_owned_games,
    sync_epic_owned_games,
    sync_gog_owned_games,
    sync_steam_owned_games,
)

from . import apis_bp


def _feature_disabled_response():
    return api_error('Store ownership sync is disabled by administrator', code='forbidden')


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
        return api_error('steam_id required', code='bad_request')
    try:
        account = connect_steam_account(current_user.id, steam_id)
    except ValueError as exc:
        return api_error(str(exc), code='bad_request')
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
        return api_error(str(exc), code='forbidden')
    except ValueError as exc:
        return api_error(str(exc), code='bad_request')
    except Exception as exc:
        return api_error(f'Steam sync failed: {exc}', code='bad_gateway')
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
        return api_error('csv content required', code='bad_request')
    try:
        result = import_steam_csv(current_user.id, csv_text)
    except PermissionError as exc:
        return api_error(str(exc), code='forbidden')
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
    refresh_token = (data.get('refresh_token') or data.get('token') or '').strip() or None
    access_token = (data.get('access_token') or '').strip() or None
    account = connect_gog_account(
        current_user.id,
        gog_user_id,
        note,
        refresh_token=refresh_token,
        access_token=access_token,
    )
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


@apis_bp.route('/ownership/gog/sync', methods=['POST'])
@login_required
def sync_gog():
    if not is_ownership_sync_enabled():
        return _feature_disabled_response()
    try:
        result = sync_gog_owned_games(current_user.id)
    except PermissionError as exc:
        return api_error(str(exc), code='forbidden')
    except ValueError as exc:
        return api_error(str(exc), code='bad_request')
    except Exception as exc:
        return api_error(f'GOG sync failed: {exc}', code='bad_gateway')
    return jsonify({
        **result,
        'summary': get_ownership_summary(current_user.id),
    })


@apis_bp.route('/ownership/gog/csv', methods=['POST'])
@login_required
def import_gog_csv_route():
    if not is_ownership_sync_enabled():
        return _feature_disabled_response()
    csv_text = _read_csv_payload()
    if not csv_text.strip():
        return api_error('csv content required', code='bad_request')
    try:
        result = import_gog_csv(current_user.id, csv_text)
    except PermissionError as exc:
        return api_error(str(exc), code='forbidden')
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
    device_auth = data.get('device_auth') or data.get('token') or None
    account = connect_epic_account(
        current_user.id, epic_account_id, note, device_auth=device_auth,
    )
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


@apis_bp.route('/ownership/epic/sync', methods=['POST'])
@login_required
def sync_epic():
    if not is_ownership_sync_enabled():
        return _feature_disabled_response()
    try:
        result = sync_epic_owned_games(current_user.id)
    except PermissionError as exc:
        return api_error(str(exc), code='forbidden')
    except ValueError as exc:
        return api_error(str(exc), code='bad_request')
    except Exception as exc:
        return api_error(f'Epic sync failed: {exc}', code='bad_gateway')
    return jsonify({
        **result,
        'summary': get_ownership_summary(current_user.id),
    })


@apis_bp.route('/ownership/epic/csv', methods=['POST'])
@login_required
def import_epic_csv_route():
    if not is_ownership_sync_enabled():
        return _feature_disabled_response()
    csv_text = _read_csv_payload()
    if not csv_text.strip():
        return api_error('csv content required', code='bad_request')
    try:
        result = import_epic_csv(current_user.id, csv_text)
    except PermissionError as exc:
        return api_error(str(exc), code='forbidden')
    return jsonify({
        **result,
        'summary': get_ownership_summary(current_user.id),
    })


@apis_bp.route('/ownership/amazon', methods=['POST'])
@login_required
def connect_amazon():
    if not is_ownership_sync_enabled():
        return _feature_disabled_response()
    data = request.get_json(silent=True) or {}
    amazon_user_id = (
        data.get('amazon_user_id') or data.get('user_id') or ''
    ).strip() or None
    note = (data.get('note') or '').strip() or None
    credential = (
        data.get('credential')
        or data.get('token')
        or data.get('nile_json')
        or None
    )
    refresh_token = (data.get('refresh_token') or '').strip() or None
    access_token = (data.get('access_token') or '').strip() or None
    device_serial = (
        data.get('device_serial') or data.get('device_serial_number') or ''
    ).strip() or None
    account = connect_amazon_account(
        current_user.id,
        amazon_user_id,
        note,
        credential=credential,
        refresh_token=refresh_token,
        access_token=access_token,
        device_serial=device_serial,
    )
    return jsonify({
        'account': account.to_dict(),
        'summary': get_ownership_summary(current_user.id),
    }), 201


@apis_bp.route('/ownership/amazon', methods=['DELETE'])
@login_required
def disconnect_amazon():
    if not is_ownership_sync_enabled():
        return _feature_disabled_response()
    disconnect_amazon_account(current_user.id)
    return jsonify({'summary': get_ownership_summary(current_user.id)})


@apis_bp.route('/ownership/amazon/sync', methods=['POST'])
@login_required
def sync_amazon():
    if not is_ownership_sync_enabled():
        return _feature_disabled_response()
    try:
        result = sync_amazon_owned_games(current_user.id)
    except PermissionError as exc:
        return api_error(str(exc), code='forbidden')
    except ValueError as exc:
        return api_error(str(exc), code='bad_request')
    except Exception as exc:
        return api_error(f'Amazon sync failed: {exc}', code='bad_gateway')
    return jsonify({
        **result,
        'summary': get_ownership_summary(current_user.id),
    })


@apis_bp.route('/ownership/amazon/csv', methods=['POST'])
@login_required
def import_amazon_csv_route():
    if not is_ownership_sync_enabled():
        return _feature_disabled_response()
    csv_text = _read_csv_payload()
    if not csv_text.strip():
        return api_error('csv content required', code='bad_request')
    try:
        result = import_amazon_csv(current_user.id, csv_text)
    except PermissionError as exc:
        return api_error(str(exc), code='forbidden')
    return jsonify({
        **result,
        'summary': get_ownership_summary(current_user.id),
    })


@apis_bp.route('/ownership/meta_quest/csv', methods=['POST'])
@login_required
def import_meta_quest_csv_route():
    """Register-only Meta/Quest ownership CSV (never downloads DRM titles)."""
    if not is_ownership_sync_enabled():
        return _feature_disabled_response()
    csv_text = _read_csv_payload()
    if not csv_text.strip():
        return api_error('csv content required', code='bad_request')
    try:
        result = import_meta_quest_csv(current_user.id, csv_text)
    except PermissionError as exc:
        return api_error(str(exc), code='forbidden')
    except ValueError as exc:
        return api_error(str(exc), code='bad_request')
    return jsonify({
        **result,
        'summary': get_ownership_summary(current_user.id),
        'note': 'Ownership register only — Oneirodex never downloads Meta/Quest DRM titles.',
    })

