"""Member Acquire API — native indexers / hubs / debrid search & send (feature-flagged)."""

from __future__ import annotations

from flask import jsonify, request
from flask_login import current_user, login_required

from gametheca.utils.acquire_scoring import rank_acquire_hits, title_looks_like_newer_repack
from gametheca.utils.arr_connectors import get_arr_config, search_indexers, send_to_download_client
from gametheca.utils.debrid_connectors import (
    alldebrid_upload_magnet,
    debrid_enabled,
    debrid_status,
    premiumize_add_magnet,
    real_debrid_add_magnet,
    torbox_add_magnet,
)
from gametheca.utils.indexer_registry import indexer_status_summary
from gametheca.utils.module_status import arr_module_on
from gametheca.utils.rbac import is_librarian

from . import apis_bp


def _acquire_allowed() -> bool:
    return arr_module_on() or debrid_enabled()


def _indexer_readiness() -> dict:
    """Native + hub readiness for Acquire empty-state (same warning semantics as Arr status)."""
    if not arr_module_on():
        return {
            'native_ready': False,
            'hubs_ready': False,
            'indexers_ready': False,
            'indexer_warnings': [],
            'native_count': 0,
            'native_ready_count': 0,
        }
    native = indexer_status_summary()
    cfg = get_arr_config()
    hubs_ready = bool(
        (cfg.get('prowlarr_url') and cfg.get('prowlarr_api_key'))
        or (cfg.get('jackett_url') and cfg.get('jackett_api_key'))
    )
    native_ready = bool(native.get('configured'))
    return {
        'native_ready': native_ready,
        'hubs_ready': hubs_ready,
        'indexers_ready': native_ready or hubs_ready,
        'indexer_warnings': list(native.get('warnings') or []),
        'native_count': int(native.get('count') or 0),
        'native_ready_count': int(native.get('ready') or 0),
    }


@apis_bp.route('/acquire/status', methods=['GET'])
@login_required
def acquire_status():
    readiness = _indexer_readiness()
    return jsonify({
        'enabled': _acquire_allowed(),
        'arr_enabled': arr_module_on(),
        'debrid_enabled': debrid_enabled(),
        'debrid': debrid_status(),
        'can_send': is_librarian(current_user),
        'clients': ['qbittorrent', 'transmission', 'sabnzbd', 'nzbget'],
        'native_ready': readiness['native_ready'],
        'hubs_ready': readiness['hubs_ready'],
        'indexers_ready': readiness['indexers_ready'],
        'indexer_warnings': readiness['indexer_warnings'],
        'native_count': readiness['native_count'],
        'native_ready_count': readiness['native_ready_count'],
        'message': (
            'Acquisition ready (native indexers / hubs / debrid configured by admin).'
            if _acquire_allowed()
            else 'Enable ENABLE_ARR_MODULE and/or ENABLE_DEBRID to use Acquire.'
        ),
    })


@apis_bp.route('/acquire/search', methods=['GET'])
@login_required
def acquire_search():
    if not arr_module_on():
        return jsonify({'error': 'Arr module disabled'}), 403
    query = (request.args.get('q') or '').strip()
    if not query:
        return jsonify({'error': 'q required'}), 400
    current_label = (request.args.get('current') or '').strip()
    try:
        hits = search_indexers(query)
    except Exception as exc:
        return jsonify({'error': str(exc)}), 502
    ranked = rank_acquire_hits([hit.to_dict() for hit in hits], query=query)
    if current_label:
        for row in ranked:
            row['newer_repack'] = title_looks_like_newer_repack(
                str(row.get('title') or ''),
                current_label,
            )
    warnings = list(indexer_status_summary().get('warnings') or [])
    return jsonify({'q': query, 'results': ranked, 'warnings': warnings})


@apis_bp.route('/acquire/download', methods=['POST'])
@login_required
def acquire_download():
    """Send magnet/URL to download client or debrid — librarian/admin only."""
    if not is_librarian(current_user):
        return jsonify({'error': 'Librarian or admin required'}), 403
    data = request.get_json(silent=True) or {}
    url = (data.get('url') or data.get('magnet') or '').strip()
    provider = (data.get('provider') or 'qbittorrent').strip().lower()
    if not url:
        return jsonify({'error': 'url or magnet required'}), 400
    if url.lower().startswith('http://') or url.lower().startswith('https://'):
        from gametheca.utils.security import validate_user_outbound_http_url
        ok, result = validate_user_outbound_http_url(url)
        if not ok:
            return jsonify({'error': result}), 400
        url = result
    try:
        if provider in ('qbittorrent', 'transmission', 'sabnzbd', 'nzbget', 'deluge'):
            if not arr_module_on():
                return jsonify({'error': 'Arr module disabled'}), 403
            result = send_to_download_client(url, provider=provider)
            return jsonify({'ok': True, 'provider': provider, 'result': result})
        if provider == 'real_debrid':
            if not debrid_enabled():
                return jsonify({'error': 'Debrid disabled'}), 403
            payload = real_debrid_add_magnet(url)
            return jsonify({'ok': True, 'provider': 'real_debrid', 'result': payload})
        if provider == 'alldebrid':
            if not debrid_enabled():
                return jsonify({'error': 'Debrid disabled'}), 403
            payload = alldebrid_upload_magnet(url)
            return jsonify({'ok': True, 'provider': 'alldebrid', 'result': payload})
        if provider == 'premiumize':
            if not debrid_enabled():
                return jsonify({'error': 'Debrid disabled'}), 403
            payload = premiumize_add_magnet(url)
            return jsonify({'ok': True, 'provider': 'premiumize', 'result': payload})
        if provider == 'torbox':
            if not debrid_enabled():
                return jsonify({'error': 'Debrid disabled'}), 403
            payload = torbox_add_magnet(url)
            return jsonify({'ok': True, 'provider': 'torbox', 'result': payload})
        return jsonify({'error': 'Unknown provider'}), 400
    except Exception as exc:
        return jsonify({'error': str(exc)}), 502
