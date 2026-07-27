"""Admin cover art studio — procedural templates, size matrix, apply paths."""

from __future__ import annotations

import base64
import io

from flask import jsonify, render_template, request, send_file
from flask_login import login_required

from gametheca.utils.auth import admin_required
from gametheca.utils.cover_art_studio import (
    apply_pack_as_fallback,
    apply_pack_to_game,
    build_zip_bytes,
    generate_size_matrix,
    pack_preview_url,
    render_cover_art,
    save_pack,
    safe_pack_dir,
)
from gametheca.utils.event_logging import log_system_event
from . import admin2_bp


def _json_body() -> dict:
    return request.get_json(silent=True) or {}


@admin2_bp.route('/admin/art_studio', methods=['GET'])
@login_required
@admin_required
def art_studio_page():
    return render_template('admin/admin_art_studio.html')


@admin2_bp.route('/admin/api/art-studio/preview', methods=['POST'])
@login_required
@admin_required
def art_studio_preview():
    data = _json_body()
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'title is required'}), 400
    system = (data.get('system') or '').strip() or None
    width = int(data.get('width') or 400)
    height = int(data.get('height') or 600)
    width = max(64, min(width, 2048))
    height = max(64, min(height, 2048))
    fmt = (data.get('format') or 'webp').lower()
    if fmt not in ('webp', 'png'):
        fmt = 'webp'
    variant = 'wide' if width > height * 1.4 else 'tile'
    img = render_cover_art(width, height, title=title, system=system, variant=variant)
    buf = io.BytesIO()
    img.save(buf, format='WEBP' if fmt == 'webp' else 'PNG', quality=88)
    encoded = base64.b64encode(buf.getvalue()).decode('ascii')
    mime = 'image/webp' if fmt == 'webp' else 'image/png'
    return jsonify({'preview': f'data:{mime};base64,{encoded}', 'width': width, 'height': height})


@admin2_bp.route('/admin/api/art-studio/generate', methods=['POST'])
@login_required
@admin_required
def art_studio_generate():
    data = _json_body()
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'title is required'}), 400
    system = (data.get('system') or '').strip() or None
    fmt = (data.get('format') or 'webp').lower()
    if fmt not in ('webp', 'png'):
        fmt = 'webp'
    try:
        manifest = save_pack(title, system=system, fmt=fmt)
        preview = pack_preview_url(manifest['pack_id'], 'tile_400x600.webp')
        log_system_event(f"Art studio generated pack {manifest['pack_id']} for {title!r}")
        return jsonify({**manifest, 'preview_url': preview}), 201
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400


@admin2_bp.route('/admin/api/art-studio/download/<pack_id>', methods=['GET'])
@login_required
@admin_required
def art_studio_download(pack_id: str):
    try:
        safe_pack_dir(pack_id)
        payload = build_zip_bytes(pack_id)
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    except FileNotFoundError:
        return jsonify({'error': 'Pack not found'}), 404
    return send_file(
        io.BytesIO(payload),
        mimetype='application/zip',
        as_attachment=True,
        download_name=f'gametheca-art-{pack_id}.zip',
    )


@admin2_bp.route('/admin/api/art-studio/apply', methods=['POST'])
@login_required
@admin_required
def art_studio_apply():
    data = _json_body()
    pack_id = (data.get('pack_id') or '').strip()
    if not pack_id:
        return jsonify({'error': 'pack_id is required'}), 400
    mode = (data.get('mode') or 'game').strip().lower()
    try:
        if mode == 'fallback':
            paths = apply_pack_as_fallback(pack_id)
            log_system_event(f"Art studio set fallback pack {pack_id}")
            return jsonify({'mode': 'fallback', 'paths': paths})
        game_uuid = (data.get('game_uuid') or '').strip()
        if not game_uuid:
            return jsonify({'error': 'game_uuid is required for game mode'}), 400
        filename = (data.get('filename') or '').strip() or None
        result = apply_pack_to_game(pack_id, game_uuid, filename=filename)
        log_system_event(f"Art studio applied pack {pack_id} to game {game_uuid}")
        return jsonify({'mode': 'game', **result})
    except LookupError as exc:
        return jsonify({'error': str(exc)}), 404
    except (ValueError, FileNotFoundError) as exc:
        return jsonify({'error': str(exc)}), 400
