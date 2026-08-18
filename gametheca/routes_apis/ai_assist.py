"""AI assist API routes (admin, suggestions only)."""

from __future__ import annotations

import os

from gametheca.utils.api_response import api_error, api_ok
from flask import jsonify, request
from flask_login import login_required
from sqlalchemy import select

from gametheca import db
from gametheca.models import Game, Library, UnmatchedFolder
from gametheca.utils.ai_assist import (
    ai_auto_apply_enabled,
    ai_enabled,
    apply_triage_title,
    doctor_notes,
    get_ai_config,
    ollama_status,
    save_ai_config,
    triage_folder,
)
from gametheca.utils.auth import admin_required

from . import apis_bp


def _basename(path: str | None) -> str:
    return os.path.basename((path or '').rstrip('/\\'))


@apis_bp.route('/ai/status', methods=['GET'])
@login_required
@admin_required
def ai_status():
    # Deliberately not api_ok: `ollama_status()` reports `error` as *why*
    # Ollama is unreachable, on an otherwise fine 200 — data, not an envelope
    # failure. api_ok pops `error`, so wrapping this would delete the one field
    # the endpoint exists to return. Baselined on purpose.
    return jsonify(ollama_status())


@apis_bp.route('/ai/config', methods=['GET', 'PUT'])
@login_required
@admin_required
def ai_config():
    """Read/write AI enable + Ollama URL/model. Works even when currently off."""
    if request.method == 'GET':
        return jsonify(get_ai_config())
    data = request.get_json(silent=True) or {}
    if not any(key in data for key in ('enabled', 'enable_ai_assist', 'ollama_base_url', 'ollama_model')):
        return api_error('No recognized fields to update', code='bad_request')
    saved = save_ai_config(data)
    return api_ok({'status': 'saved', **saved})


@apis_bp.route('/ai/triage', methods=['POST'])
@login_required
@admin_required
def ai_triage():
    if not ai_enabled():
        return api_error('AI assist is disabled', code='forbidden')
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or data.get('folder_name') or '').strip()
    platform = data.get('platform')
    folder_id = data.get('unmatched_folder_id') or data.get('folder_id')
    if folder_id and not name:
        row = db.session.get(UnmatchedFolder, folder_id)
        if not row:
            return api_error('Unmatched folder not found', code='not_found')
        name = (getattr(row, 'search_name', None) or '').strip() or _basename(row.folder_path)
        if not platform and row.library_uuid:
            lib = db.session.execute(
                select(Library).filter_by(uuid=row.library_uuid),
            ).scalars().first()
            if lib and lib.platform is not None:
                platform = str(lib.platform)
    if not name and data.get('folder_path'):
        name = _basename(data.get('folder_path'))
    try:
        result = triage_folder(name, platform)
    except ValueError as exc:
        return api_error(str(exc), code='bad_request')
    except PermissionError as exc:
        return api_error(str(exc), code='forbidden')
    except ConnectionError as exc:
        return api_error(str(exc), code='unavailable')
    return jsonify(result)


@apis_bp.route('/ai/doctor-notes', methods=['POST'])
@login_required
@admin_required
def ai_doctor_notes():
    if not ai_enabled():
        return api_error('AI assist is disabled', code='forbidden')
    data = request.get_json(silent=True) or {}
    context = {
        'issues': data.get('issues') or data.get('issue_codes') or [],
        'summary': data.get('summary') or data.get('extra'),
        'game_name': data.get('game_name') or data.get('name'),
    }
    game_uuid = (data.get('game_uuid') or '').strip()
    if game_uuid:
        game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
        if not game:
            return api_error('Game not found', code='not_found')
        context['game_name'] = game.name
        context['summary'] = context.get('summary') or (game.summary or '')[:500]
    try:
        result = doctor_notes(context)
    except ValueError as exc:
        return api_error(str(exc), code='bad_request')
    except PermissionError as exc:
        return api_error(str(exc), code='forbidden')
    except ConnectionError as exc:
        return api_error(str(exc), code='unavailable')
    return jsonify(result)

@apis_bp.route('/ai/apply-triage', methods=['POST'])
@login_required
@admin_required
def ai_apply_triage():
    """Apply a chosen triage title to an existing game (never silent)."""
    if not ai_auto_apply_enabled():
        return api_error(
            'AI auto-apply is disabled. Set ENABLE_AI_AUTO_APPLY=true.',
            code='forbidden',
            auto_apply_enabled=False,
        )
    data = request.get_json(silent=True) or {}
    try:
        result = apply_triage_title(
            (data.get('game_uuid') or '').strip(),
            (data.get('title') or data.get('name') or '').strip(),
        )
    except ValueError as exc:
        return api_error(str(exc), code='bad_request')
    except LookupError as exc:
        return api_error(str(exc), code='not_found')
    except PermissionError as exc:
        return api_error(str(exc), code='forbidden')
    return jsonify(result), 200 if result.get('unchanged') else 201
