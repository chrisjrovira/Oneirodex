"""Optional *arr automation module (feature-flagged connectors)."""

from __future__ import annotations

from flask import Blueprint, jsonify, render_template, request
from flask_login import login_required

from gametheca import db
from gametheca.utils.arr_connectors import (
    connector_status,
    get_arr_config,
    qbittorrent_add_url,
    save_arr_config,
    search_indexers,
)
from gametheca.utils.arr_hardlink_pipeline import (
    apply_proposals,
    pipeline_enabled,
    propose_hardlinks,
)
from gametheca.utils.auth import admin_required
from gametheca.utils.module_status import (
    arr_db_enabled,
    arr_module_on,
    ensure_global_settings,
    env_flag,
)
from gametheca.utils.quality_profiles import score_release_title
arr_bp = Blueprint('arr', __name__)


def arr_module_enabled() -> bool:
    return arr_module_on()


@arr_bp.route('/api/arr/status', methods=['GET'])
@login_required
@admin_required
def arr_status():
    """Feature-flag + connector readiness for the optional *arr module."""
    enabled = arr_module_enabled()
    connectors = connector_status() if enabled else []
    configured = any(c.get('configured') for c in connectors)
    return jsonify({
        'enabled': enabled,
        'module': 'arr',
        'status': (
            'ready' if enabled and configured
            else 'enabled' if enabled
            else 'disabled'
        ),
        'message': (
            'Arr module ready — configure indexers/clients in Admin → Arr.'
            if enabled
            else 'Arr module is disabled. Set ENABLE_ARR_MODULE=true or enable in Admin.'
        ),
        'connectors': connectors,
    })


@arr_bp.route('/api/arr/module', methods=['GET', 'PUT'])
@login_required
@admin_required
def arr_module_flag():
    """Read/write the DB toggle. Available even when the module is currently off."""
    env_on = env_flag('ENABLE_ARR_MODULE')
    if request.method == 'GET':
        return jsonify({
            'enabled': arr_module_enabled(),
            'db_enabled': arr_db_enabled(),
            'env_enabled': env_on,
        })
    data = request.get_json(silent=True) or {}
    if 'enabled' not in data and 'enable_arr_module' not in data:
        return jsonify({'error': 'enabled is required'}), 400
    enabled = bool(data.get('enabled', data.get('enable_arr_module')))
    settings = ensure_global_settings()
    settings.enable_arr_module = enabled
    db.session.commit()
    return jsonify({
        'status': 'saved',
        'enabled': arr_module_enabled(),
        'db_enabled': bool(settings.enable_arr_module),
        'env_enabled': env_on,
    })


@arr_bp.route('/api/arr/config', methods=['GET', 'PUT'])
@login_required
@admin_required
def arr_config():
    if not arr_module_enabled():
        return jsonify({'error': 'Arr module is disabled'}), 403
    if request.method == 'GET':
        cfg = get_arr_config()
        return jsonify({
            'prowlarr_url': cfg.get('prowlarr_url') or '',
            'prowlarr_api_key_set': bool(cfg.get('prowlarr_api_key')),
            'jackett_url': cfg.get('jackett_url') or '',
            'jackett_api_key_set': bool(cfg.get('jackett_api_key')),
            'qbittorrent_url': cfg.get('qbittorrent_url') or '',
            'qbittorrent_username': cfg.get('qbittorrent_username') or 'admin',
            'qbittorrent_password_set': bool(cfg.get('qbittorrent_password')),
            'transmission_url': cfg.get('transmission_url') or '',
            'transmission_username': cfg.get('transmission_username') or '',
            'transmission_password_set': bool(cfg.get('transmission_password')),
            'sabnzbd_url': cfg.get('sabnzbd_url') or '',
            'sabnzbd_api_key_set': bool(cfg.get('sabnzbd_api_key')),
            'nzbget_url': cfg.get('nzbget_url') or '',
            'nzbget_username': cfg.get('nzbget_username') or '',
            'nzbget_password_set': bool(cfg.get('nzbget_password')),
        })
    data = request.get_json(silent=True) or {}
    try:
        saved = save_arr_config(data)
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    return jsonify({'status': 'saved', 'config': saved})


@arr_bp.route('/api/arr/search', methods=['GET'])
@login_required
@admin_required
def arr_search():
    if not arr_module_enabled():
        return jsonify({'error': 'Arr module is disabled'}), 403
    query = (request.args.get('q') or request.args.get('query') or '').strip()
    if not query:
        return jsonify({'error': 'Query parameter q is required'}), 400
    try:
        limit = min(int(request.args.get('limit') or 25), 50)
    except (TypeError, ValueError):
        limit = 25
    try:
        hits = search_indexers(query, limit=limit)
    except RuntimeError as exc:
        return jsonify({'error': str(exc)}), 502
    results = []
    for hit in hits:
        payload = hit.to_dict()
        payload['quality'] = score_release_title(hit.title, size_bytes=hit.size)
        results.append(payload)
    results.sort(key=lambda item: item['quality']['score'], reverse=True)
    return jsonify({'query': query, 'results': results})


@arr_bp.route('/api/arr/download', methods=['POST'])
@login_required
@admin_required
def arr_download():
    if not arr_module_enabled():
        return jsonify({'error': 'Arr module is disabled'}), 403
    data = request.get_json(silent=True) or {}
    url = (data.get('download_url') or data.get('url') or '').strip()
    if not url:
        return jsonify({'error': 'download_url is required'}), 400
    if url.lower().startswith('http://') or url.lower().startswith('https://'):
        from gametheca.utils.security import validate_user_outbound_http_url
        ok, result = validate_user_outbound_http_url(url)
        if not ok:
            return jsonify({'error': result}), 400
        url = result
    try:
        result = qbittorrent_add_url(url)
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    except RuntimeError as exc:
        return jsonify({'error': str(exc)}), 502
    return jsonify(result), 202


@arr_bp.route('/api/arr/hardlink/preview', methods=['POST'])
@login_required
@admin_required
def arr_hardlink_preview():
    if not arr_module_enabled():
        return jsonify({'error': 'Arr module is disabled'}), 403
    if not pipeline_enabled():
        return jsonify({
            'error': 'Arr-hardlink pipeline is disabled. Set ENABLE_ARR_HARDLINK_PIPELINE=true.',
        }), 403
    data = request.get_json(silent=True) or {}
    dest = (data.get('library_dest_dir') or data.get('dest_dir') or '').strip()
    if not dest:
        return jsonify({'error': 'library_dest_dir is required'}), 400
    try:
        limit = min(int(data.get('limit') or 50), 200)
    except (TypeError, ValueError):
        limit = 50
    try:
        result = propose_hardlinks(dest, limit=limit)
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    except PermissionError as exc:
        return jsonify({'error': str(exc)}), 403
    except RuntimeError as exc:
        return jsonify({'error': str(exc)}), 502
    return jsonify(result)


@arr_bp.route('/api/arr/hardlink/apply', methods=['POST'])
@login_required
@admin_required
def arr_hardlink_apply():
    if not arr_module_enabled():
        return jsonify({'error': 'Arr module is disabled'}), 403
    if not pipeline_enabled():
        return jsonify({
            'error': 'Arr-hardlink pipeline is disabled. Set ENABLE_ARR_HARDLINK_PIPELINE=true.',
        }), 403
    data = request.get_json(silent=True) or {}
    proposals = data.get('proposals')
    if not isinstance(proposals, list) or not proposals:
        dest = (data.get('library_dest_dir') or data.get('dest_dir') or '').strip()
        if not dest:
            return jsonify({'error': 'proposals or library_dest_dir required'}), 400
        try:
            preview = propose_hardlinks(dest, limit=int(data.get('limit') or 50))
            proposals = preview.get('proposals') or []
        except ValueError as exc:
            return jsonify({'error': str(exc)}), 400
        except PermissionError as exc:
            return jsonify({'error': str(exc)}), 403
        except RuntimeError as exc:
            return jsonify({'error': str(exc)}), 502
    try:
        result = apply_proposals(proposals, only_ok=bool(data.get('only_ok', True)))
    except PermissionError as exc:
        return jsonify({'error': str(exc)}), 403
    return jsonify(result), 201


@arr_bp.route('/admin/arr', methods=['GET'])
@login_required
@admin_required
def arr_admin_page():
    """Admin page for the optional *arr module."""
    enabled = arr_module_enabled()
    return render_template(
        'admin/arr_module.html',
        enabled=enabled,
        db_enabled=arr_db_enabled(),
        env_enabled=env_flag('ENABLE_ARR_MODULE'),
        connectors=connector_status() if enabled else [],
        hardlink_pipeline=pipeline_enabled(),
    )

