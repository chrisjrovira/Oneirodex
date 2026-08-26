"""Admin cover art studio — procedural templates, size matrix, apply paths."""

from __future__ import annotations

import base64
import io

from gametheca.utils.api_response import api_error, api_ok
from flask import jsonify, render_template, request, send_file
from flask_login import login_required
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from gametheca import db
from gametheca.models import Game
from gametheca.utils.auth import admin_required
from gametheca.utils.cover_art_studio import (
    apply_pack_as_fallback,
    apply_pack_to_game,
    build_zip_bytes,
    clamp_title_scale,
    generate_size_matrix,
    pack_preview_url,
    render_cover_art,
    save_pack,
    safe_pack_dir,
)
from gametheca.utils.cover_art_stock import (
    apply_pack_to_library,
    generate_stock_packs,
    list_stock_catalog,
)
from gametheca.utils.cover_selection import list_games_for_cover_batch
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
        return api_error('title is required', code='bad_request')
    system = (data.get('system') or '').strip() or None
    width = int(data.get('width') or 400)
    height = int(data.get('height') or 600)
    width = max(64, min(width, 2048))
    height = max(64, min(height, 2048))
    fmt = (data.get('format') or 'webp').lower()
    if fmt not in ('webp', 'png'):
        fmt = 'webp'
    if width == height:
        variant = 'square'
    elif width > height * 1.4:
        variant = 'wide'
    else:
        variant = 'tile'
    # artistic defaults ON — pass artistic=0 / false to preview the legacy flat template
    artistic_raw = data.get('artistic', True)
    if isinstance(artistic_raw, str):
        artistic = artistic_raw.strip().lower() not in ('0', 'false', 'no', 'off')
    else:
        artistic = bool(artistic_raw)
    # FEAT-D4: operator overrides for the drawn text. Absent keys keep the
    # derived values; an explicit empty subtitle means "no subtitle".
    headline_override = data.get('headline')
    subtitle_override = data.get('subtitle')
    title_scale = clamp_title_scale(data.get('title_scale'))

    img = render_cover_art(
        width, height, title=title, system=system, variant=variant, artistic=artistic,
        headline_override=headline_override,
        subtitle_override=subtitle_override,
        title_scale=title_scale,
    )
    buf = io.BytesIO()
    img.save(buf, format='WEBP' if fmt == 'webp' else 'PNG', quality=88)
    encoded = base64.b64encode(buf.getvalue()).decode('ascii')
    mime = 'image/webp' if fmt == 'webp' else 'image/png'
    return jsonify({
        'preview': f'data:{mime};base64,{encoded}',
        'width': width,
        'height': height,
        'artistic': artistic,
        'variant': variant,
    })


@admin2_bp.route('/admin/api/art-studio/generate', methods=['POST'])
@login_required
@admin_required
def art_studio_generate():
    data = _json_body()
    title = (data.get('title') or '').strip()
    if not title:
        return api_error('title is required', code='bad_request')
    system = (data.get('system') or '').strip() or None
    fmt = (data.get('format') or 'webp').lower()
    if fmt not in ('webp', 'png'):
        fmt = 'webp'
    # Same overrides the preview accepts. Without them Generate would render the
    # derived text while the preview above it showed the operator's, so the
    # preview would be lying about its own output.
    pack_title_scale = clamp_title_scale(data.get('title_scale'))

    try:
        manifest = save_pack(
            title, system=system, fmt=fmt,
            headline_override=data.get('headline'),
            subtitle_override=data.get('subtitle'),
            title_scale=pack_title_scale,
        )
        preview = pack_preview_url(manifest['pack_id'], 'tile_400x600.webp')
        log_system_event(f"Art studio generated pack {manifest['pack_id']} for {title!r}")
        return jsonify({**manifest, 'preview_url': preview}), 201
    except ValueError as exc:
        return api_error(str(exc), code='bad_request')
    except PermissionError as exc:
        return api_error(f'Permission denied writing generated art pack: {exc}', code='internal')
    except OSError as exc:
        return api_error(f'Failed to write generated art pack to disk: {exc}', code='internal')


@admin2_bp.route('/admin/api/art-studio/download/<pack_id>', methods=['GET'])
@login_required
@admin_required
def art_studio_download(pack_id: str):
    try:
        safe_pack_dir(pack_id)
        payload = build_zip_bytes(pack_id)
    except ValueError as exc:
        return api_error(str(exc), code='bad_request')
    except FileNotFoundError:
        return api_error('Pack not found', code='not_found')
    except PermissionError as exc:
        return api_error(f'Permission denied reading art pack: {exc}', code='internal')
    except OSError as exc:
        return api_error(f'Failed to read art pack from disk: {exc}', code='internal')
    return send_file(
        io.BytesIO(payload),
        mimetype='application/zip',
        as_attachment=True,
        download_name=f'gametheca-art-{pack_id}.zip',
    )


@admin2_bp.route('/admin/api/art-studio/stock', methods=['GET'])
@login_required
@admin_required
def art_studio_stock_catalog():
    """Catalog of platform packs + stock gaming motifs operators can pick."""
    try:
        items = list_stock_catalog()
        return jsonify({'items': items, 'count': len(items)})
    except Exception as exc:  # noqa: BLE001
        return api_error(f'Failed to list stock catalog: {exc}', code='internal')


@admin2_bp.route('/admin/api/art-studio/stock/generate', methods=['POST'])
@login_required
@admin_required
def art_studio_stock_generate():
    """Idempotent write of stock/platform packs under static/library/stock/."""
    data = _json_body()
    ids = data.get('ids')
    if isinstance(ids, str):
        ids = [i.strip() for i in ids.split(',') if i.strip()]
    elif isinstance(ids, list):
        ids = [str(i).strip() for i in ids if str(i).strip()]
    else:
        ids = None
    fmt = (data.get('format') or 'webp').lower()
    if fmt not in ('webp', 'png'):
        fmt = 'webp'
    try:
        result = generate_stock_packs(ids, fmt=fmt)
        log_system_event(f"Art studio stock generate count={result['count']}")
        return jsonify(result), 201
    except ValueError as exc:
        return api_error(str(exc), code='bad_request')
    except PermissionError as exc:
        return api_error(f'Permission denied writing stock packs: {exc}', code='internal')
    except OSError as exc:
        return api_error(f'Failed to write stock packs: {exc}', code='internal')


@admin2_bp.route('/admin/api/art-studio/apply', methods=['POST'])
@login_required
@admin_required
def art_studio_apply():
    data = _json_body()
    pack_id = (data.get('pack_id') or data.get('id') or '').strip()
    if not pack_id:
        return api_error('pack_id is required', code='bad_request')
    mode = (data.get('mode') or 'game').strip().lower()
    try:
        if mode == 'fallback':
            paths = apply_pack_as_fallback(pack_id)
            log_system_event(f"Art studio set fallback pack {pack_id}")
            return jsonify({'mode': 'fallback', 'paths': paths, 'pack_id': pack_id})
        if mode == 'library':
            library_uuid = (data.get('library_uuid') or '').strip()
            if not library_uuid:
                return api_error('library_uuid is required for library mode', code='bad_request')
            result = apply_pack_to_library(pack_id, library_uuid)
            log_system_event(f"Art studio applied pack {pack_id} to library {library_uuid}")
            return jsonify({'mode': 'library', **result})
        game_uuid = (data.get('game_uuid') or '').strip()
        if not game_uuid:
            return api_error('game_uuid is required for game mode', code='bad_request')
        filename = (data.get('filename') or '').strip() or None
        result = apply_pack_to_game(pack_id, game_uuid, filename=filename)
        log_system_event(f"Art studio applied pack {pack_id} to game {game_uuid}")
        return jsonify({'mode': 'game', **result})
    except LookupError as exc:
        return api_error(str(exc), code='not_found')
    except (ValueError, FileNotFoundError) as exc:
        return api_error(str(exc), code='bad_request')
    except PermissionError as exc:
        return api_error(f'Permission denied writing cover art: {exc}', code='internal')
    except OSError as exc:
        return api_error(f'Failed to write cover art to disk: {exc}', code='internal')
    except Exception as exc:  # noqa: BLE001 - surface DB/commit failures as JSON, not an HTML 500 page
        return api_error(f'Unexpected error applying pack: {exc}', code='internal')


@admin2_bp.route('/admin/api/art-studio/batch-generate', methods=['POST'])
@login_required
@admin_required
def art_studio_batch_generate():
    """Generate + apply system-templated covers for games missing covers."""
    return _art_studio_apply_batch_impl()


@admin2_bp.route('/admin/api/art-studio/apply-batch', methods=['POST'])
@login_required
@admin_required
def art_studio_apply_batch():
    """Alias expected by Admin ArtStudioPage — same as batch-generate."""
    return _art_studio_apply_batch_impl()


def _art_studio_apply_batch_impl():
    data = _json_body()
    try:
        limit = min(int(data.get('limit') or data.get('limit_games') or 25), 100)
    except (TypeError, ValueError):
        limit = 25

    game_uuids = data.get('game_uuids')
    if isinstance(game_uuids, str):
        game_uuids = [u.strip() for u in game_uuids.split(',') if u.strip()]
    elif isinstance(game_uuids, list):
        game_uuids = [str(u).strip() for u in game_uuids if str(u).strip()]
    else:
        game_uuids = None

    override_system = (data.get('system') or data.get('platform') or '').strip() or None

    if game_uuids:
        games = list(
            db.session.execute(
                select(Game)
                .options(joinedload(Game.library))
                .filter(Game.uuid.in_(game_uuids))
            ).scalars().unique().all()
        )
    else:
        games = list_games_for_cover_batch(
            library_uuid=(data.get('library_uuid') or '').strip() or None,
            platform=override_system,
            service=(data.get('service') or '').strip() or None,
            missing_cover=bool(data.get('missing_cover', True)),
            limit=limit,
        )

    applied = []
    failed = []
    for game in games:
        system = override_system
        if not system and game.library and game.library.platform:
            system = game.library.platform.value
        try:
            manifest = save_pack(game.name or 'Untitled', system=system)
            result = apply_pack_to_game(manifest['pack_id'], game.uuid)
            applied.append({
                'game_uuid': game.uuid,
                'name': game.name,
                'system': system,
                'pack_id': manifest['pack_id'],
                **result,
            })
        except Exception as exc:  # noqa: BLE001
            failed.append({
                'game_uuid': game.uuid,
                'name': game.name,
                'error': str(exc),
            })

    log_system_event(
        f"Art studio apply-batch applied={len(applied)} failed={len(failed)}"
    )
    return jsonify({
        'applied': len(applied),
        'failed': len(failed),
        'results': applied,
        'errors': failed,
    })

