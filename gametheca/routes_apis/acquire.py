"""Member Acquire API — BYO arr/debrid search & send (feature-flagged)."""

from __future__ import annotations

from flask import jsonify, request
from flask_login import current_user, login_required

from gametheca.utils.acquire_scoring import rank_acquire_hits, title_looks_like_newer_repack
from gametheca.utils.arr_connectors import search_indexers, send_to_download_client
from gametheca.utils.debrid_connectors import (
    alldebrid_upload_magnet,
    debrid_enabled,
    debrid_status,
    premiumize_add_magnet,
    real_debrid_add_magnet,
    torbox_add_magnet,
)
from gametheca.utils.module_status import arr_module_on
from gametheca.utils.rbac import is_librarian

from . import apis_bp


def _acquire_allowed() -> bool:
    return arr_module_on() or debrid_enabled()


@apis_bp.route('/acquire/status', methods=['GET'])
@login_required
def acquire_status():
    return jsonify({
        'enabled': _acquire_allowed(),
        'arr_enabled': arr_module_on(),
        'debrid_enabled': debrid_enabled(),
        'debrid': debrid_status(),
        'can_send': is_librarian(current_user),
        'clients': ['qbittorrent', 'transmission', 'sabnzbd', 'nzbget'],
        'message': (
            'BYO acquisition ready (indexers/debrid configured by admin).'
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
    return jsonify({'q': query, 'results': ranked})


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
