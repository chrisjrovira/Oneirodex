"""Emulator cheats (.cht) and BIOS management APIs."""

from __future__ import annotations

from io import BytesIO

from flask import jsonify, request, send_file
from flask_login import current_user, login_required
from sqlalchemy import select

from gametheca import db
from gametheca.models import Game
from gametheca.platform import cheat_surface_for_platform
from gametheca.utils.api_response import api_error, api_ok
from gametheca.utils.auth import admin_required
from gametheca.utils.emulator_bios import (
    bios_status_for_cores,
    bios_status_for_platforms,
    list_bios_files,
    store_bios_file,
)
from gametheca.utils.emulator_cheats import (
    create_cheat_file,
    delete_cheat_file,
    list_cheat_files,
    read_cheat_file,
    store_cheat_file,
)
from gametheca.utils.library_acl import user_can_access_game
from gametheca.utils.play_url import library_platform_key
from gametheca.utils.rbac import librarian_required

from . import apis_bp


def _game_cheat_surface(game) -> str:
    return cheat_surface_for_platform(library_platform_key(game))


def _accessible_game(game_uuid: str):
    """Load a game the caller may see, or the response that refuses it.

    Five handlers opened with these four lines. Returns ``(game, None)`` on
    success and ``(None, response)`` otherwise.

    Note `pc_cheats_create` deliberately keeps its own lookup: it is
    `librarian_required` and does not apply the per-library ACL, matching how
    privileged roles bypass ownership elsewhere in the tree.
    """
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game:
        return None, api_error('Game not found', code='not_found')
    if not user_can_access_game(current_user, game):
        return None, api_error('You do not have access to that game', code='forbidden')
    return game, None


def _refuse_non_retroarch(game):
    """Mutating .cht ops only for RetroArch-capable platforms (GM Wave 19)."""
    surface = _game_cheat_surface(game)
    if surface != 'retroarch':
        return api_error(
            'RetroArch cheats are not available for this platform',
            code='forbidden',
            cheat_surface=surface,
        )
    return None


@apis_bp.route('/games/<game_uuid>/cheats', methods=['GET'])
@login_required
def list_game_cheats(game_uuid):
    game, refusal = _accessible_game(game_uuid)
    if refusal is not None:
        return refusal
    surface = _game_cheat_surface(game)
    cheats = list_cheat_files(game_uuid) if surface == 'retroarch' else []
    return jsonify({
        'game_uuid': game_uuid,
        'cheat_surface': surface,
        'cheats': cheats,
    })


@apis_bp.route('/games/<game_uuid>/cheats', methods=['POST'])
@login_required
def upload_game_cheat(game_uuid):
    """Upload a prebuilt .cht or easy-create from JSON body.

    Multipart: ``file`` = .cht upload (legacy).
    JSON: ``{ name, codes: [{desc?, code}], dialect? }`` → write .cht.
    """
    game, refusal = _accessible_game(game_uuid)
    if refusal is not None:
        return refusal
    refused = _refuse_non_retroarch(game)
    if refused is not None:
        return refused

    upload = request.files.get('file')
    if upload is not None and (getattr(upload, 'filename', None) or '').strip():
        try:
            row = store_cheat_file(game_uuid, upload)
        except ValueError as exc:
            return api_error(str(exc), code='bad_request')
        return jsonify(row), 201

    data = request.get_json(silent=True)
    if isinstance(data, dict):
        try:
            row = create_cheat_file(
                game_uuid,
                name=data.get('name'),
                codes=data.get('codes'),
                dialect=data.get('dialect'),
            )
        except ValueError as exc:
            return api_error(str(exc), code='bad_request')
        return jsonify(row), 201

    return api_error('Send a .cht file, or a JSON body with name and codes', code='bad_request')


@apis_bp.route('/games/<game_uuid>/cheats/<path:filename>', methods=['GET'])
@login_required
def download_game_cheat(game_uuid, filename):
    game, refusal = _accessible_game(game_uuid)
    if refusal is not None:
        return refusal
    refused = _refuse_non_retroarch(game)
    if refused is not None:
        return refused
    try:
        payload = read_cheat_file(game_uuid, filename)
    except (ValueError, FileNotFoundError) as exc:
        return api_error(str(exc), code='not_found')
    return send_file(
        BytesIO(payload),
        mimetype='text/plain',
        as_attachment=True,
        download_name=filename,
    )


@apis_bp.route('/games/<game_uuid>/cheats/<path:filename>', methods=['DELETE'])
@login_required
def remove_game_cheat(game_uuid, filename):
    game, refusal = _accessible_game(game_uuid)
    if refusal is not None:
        return refusal
    refused = _refuse_non_retroarch(game)
    if refused is not None:
        return refused
    try:
        delete_cheat_file(game_uuid, filename)
    except ValueError as exc:
        return api_error(str(exc), code='bad_request')
    return api_ok()


@apis_bp.route('/emulator-bios', methods=['GET'])
@login_required
@admin_required
def emulator_bios_list():
    return jsonify({
        'files': list_bios_files(),
        'cores': bios_status_for_cores(),
        # Per-system view: which consoles can actually boot, and what is missing.
        'platforms': bios_status_for_platforms(),
    })


@apis_bp.route('/emulator-bios', methods=['POST'])
@login_required
@admin_required
def emulator_bios_upload():
    upload = request.files.get('file')
    if upload is None:
        return api_error('Choose a firmware file to upload.', code='bad_request')
    try:
        row = store_bios_file(upload)
    except ValueError as exc:
        # store_bios_file raises user-safe messages only (no paths, no secrets).
        return api_error(str(exc), code='unprocessable')
    except OSError:
        return api_error(
            'Could not write to the firmware volume. Check the mount is present and writable.',
            code='internal',
        )
    return api_ok(row, status=201)


# --- FEAT-D2: PC cheat notes -------------------------------------------------
# The stance reversal that opened this kept three guardrails, enforced here:
#   1. `.cht` stays RetroArch-only — this is a separate surface, not a way to
#      write cheat files for cores.
#   2. Data is operator-authored. Nothing scrapes third-party trainer sites.
#   3. Never writes to a game binary or a running process — these are notes.

PC_CHEAT_METHODS = {
    'console': 'In-game console command',
    'config': 'Config / ini file edit',
    'save': 'Save-file field (external editor)',
    'launch_flag': 'Launch option / command-line flag',
    'note': 'Note',
}


def _pc_surface_or_error(game):
    """PC cheats only apply to the native-PC surface."""
    surface = _game_cheat_surface(game)
    if surface != 'pc_wand':
        return None, api_error(
            'PC cheats apply to PC titles. This platform uses the '
            'RetroArch cheat surface.',
            code='bad_request',
            cheat_surface=surface,
        )
    return surface, None


@apis_bp.route('/games/<game_uuid>/pc_cheats', methods=['GET'])
@login_required
def pc_cheats_list(game_uuid: str):
    """Cheat notes for a PC game."""
    from gametheca.models import PcCheat

    game, refusal = _accessible_game(game_uuid)
    if refusal is not None:
        return refusal

    _, error = _pc_surface_or_error(game)
    if error:
        return error

    rows = db.session.execute(
        select(PcCheat).filter_by(game_uuid=game_uuid).order_by(PcCheat.id.asc())
    ).scalars().all()
    return api_ok({
        'game_uuid': game_uuid,
        'methods': [{'id': k, 'label': v} for k, v in PC_CHEAT_METHODS.items()],
        'cheats': [row.to_dict() for row in rows],
        'stance': (
            'Notes only — GameTheca never modifies game files or injects into a '
            'running game. Single-player use.'
        ),
    })


@apis_bp.route('/games/<game_uuid>/pc_cheats', methods=['POST'])
@login_required
@librarian_required
def pc_cheats_create(game_uuid: str):
    """Record a cheat note. Librarian+, because it is shared household content."""
    from gametheca.models import PcCheat

    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game:
        return api_error('Game not found', code='not_found')

    _, error = _pc_surface_or_error(game)
    if error:
        return error

    data = request.get_json(silent=True) or {}
    label = (data.get('label') or '').strip()
    if not label:
        return api_error('A label is required', code='bad_request')

    method = (data.get('method') or 'note').strip().lower()
    if method not in PC_CHEAT_METHODS:
        return api_error(
            f"method must be one of: {', '.join(sorted(PC_CHEAT_METHODS))}",
            code='bad_request',
        )

    row = PcCheat(
        game_uuid=game_uuid,
        method=method,
        label=label[:160],
        payload=(data.get('payload') or '').strip() or None,
        notes=(data.get('notes') or '').strip()[:1000] or None,
        single_player_only=bool(data.get('single_player_only', True)),
        created_by_user_id=getattr(current_user, 'id', None),
    )
    db.session.add(row)
    db.session.commit()
    return api_ok({'cheat': row.to_dict()}, status=201)


@apis_bp.route('/games/<game_uuid>/pc_cheats/<int:cheat_id>', methods=['DELETE'])
@login_required
@librarian_required
def pc_cheats_delete(game_uuid: str, cheat_id: int):
    from gametheca.models import PcCheat

    row = db.session.get(PcCheat, cheat_id)
    if row is None or row.game_uuid != game_uuid:
        return api_error('Cheat not found', code='not_found')
    db.session.delete(row)
    db.session.commit()
    return api_ok({'removed': cheat_id})
