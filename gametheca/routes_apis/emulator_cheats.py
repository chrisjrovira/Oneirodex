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


def _refuse_non_retroarch(game):
    """Mutating .cht ops only for RetroArch-capable platforms (GM Wave 19)."""
    surface = _game_cheat_surface(game)
    if surface != 'retroarch':
        return jsonify({
            'error': 'RetroArch cheats are not available for this platform',
            'cheat_surface': surface,
        }), 403
    return None


@apis_bp.route('/games/<game_uuid>/cheats', methods=['GET'])
@login_required
def list_game_cheats(game_uuid):
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game:
        return jsonify({'error': 'Game not found'}), 404
    if not user_can_access_game(current_user, game):
        return jsonify({'error': 'Forbidden'}), 403
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
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game:
        return jsonify({'error': 'Game not found'}), 404
    if not user_can_access_game(current_user, game):
        return jsonify({'error': 'Forbidden'}), 403
    refused = _refuse_non_retroarch(game)
    if refused is not None:
        return refused

    upload = request.files.get('file')
    if upload is not None and (getattr(upload, 'filename', None) or '').strip():
        try:
            row = store_cheat_file(game_uuid, upload)
        except ValueError as exc:
            return jsonify({'error': str(exc)}), 400
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
            return jsonify({'error': str(exc)}), 400
        return jsonify(row), 201

    return jsonify({'error': 'file required or JSON body with name and codes'}), 400


@apis_bp.route('/games/<game_uuid>/cheats/<path:filename>', methods=['GET'])
@login_required
def download_game_cheat(game_uuid, filename):
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game:
        return jsonify({'error': 'Game not found'}), 404
    if not user_can_access_game(current_user, game):
        return jsonify({'error': 'Forbidden'}), 403
    refused = _refuse_non_retroarch(game)
    if refused is not None:
        return refused
    try:
        payload = read_cheat_file(game_uuid, filename)
    except (ValueError, FileNotFoundError) as exc:
        return jsonify({'error': str(exc)}), 404
    return send_file(
        BytesIO(payload),
        mimetype='text/plain',
        as_attachment=True,
        download_name=filename,
    )


@apis_bp.route('/games/<game_uuid>/cheats/<path:filename>', methods=['DELETE'])
@login_required
def remove_game_cheat(game_uuid, filename):
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game:
        return jsonify({'error': 'Game not found'}), 404
    if not user_can_access_game(current_user, game):
        return jsonify({'error': 'Forbidden'}), 403
    refused = _refuse_non_retroarch(game)
    if refused is not None:
        return refused
    try:
        delete_cheat_file(game_uuid, filename)
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    return jsonify({'ok': True})


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
        return None, (
            jsonify({
                'error': 'PC cheats apply to PC titles. This platform uses the '
                         'RetroArch cheat surface.',
                'cheat_surface': surface,
            }), 400,
        )
    return surface, None


@apis_bp.route('/games/<game_uuid>/pc_cheats', methods=['GET'])
@login_required
def pc_cheats_list(game_uuid: str):
    """Cheat notes for a PC game."""
    from gametheca.models import PcCheat

    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game:
        return jsonify({'error': 'Game not found'}), 404
    if not user_can_access_game(current_user, game):
        return jsonify({'error': 'Forbidden'}), 403

    _, error = _pc_surface_or_error(game)
    if error:
        return error

    rows = db.session.execute(
        select(PcCheat).filter_by(game_uuid=game_uuid).order_by(PcCheat.id.asc())
    ).scalars().all()
    return jsonify({
        'ok': True,
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
        return jsonify({'error': 'Game not found'}), 404

    _, error = _pc_surface_or_error(game)
    if error:
        return error

    data = request.get_json(silent=True) or {}
    label = (data.get('label') or '').strip()
    if not label:
        return jsonify({'error': 'A label is required'}), 400

    method = (data.get('method') or 'note').strip().lower()
    if method not in PC_CHEAT_METHODS:
        return jsonify({
            'error': f"method must be one of: {', '.join(sorted(PC_CHEAT_METHODS))}",
        }), 400

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
    return jsonify({'ok': True, 'cheat': row.to_dict()}), 201


@apis_bp.route('/games/<game_uuid>/pc_cheats/<int:cheat_id>', methods=['DELETE'])
@login_required
@librarian_required
def pc_cheats_delete(game_uuid: str, cheat_id: int):
    from gametheca.models import PcCheat

    row = db.session.get(PcCheat, cheat_id)
    if row is None or row.game_uuid != game_uuid:
        return jsonify({'error': 'Cheat not found'}), 404
    db.session.delete(row)
    db.session.commit()
    return jsonify({'ok': True, 'removed': cheat_id})
