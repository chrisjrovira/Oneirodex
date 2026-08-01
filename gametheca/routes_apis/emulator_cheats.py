"""Emulator cheats (.cht) and BIOS management APIs."""

from __future__ import annotations

from io import BytesIO

from flask import jsonify, request, send_file
from flask_login import current_user, login_required
from sqlalchemy import select

from gametheca import db
from gametheca.models import Game
from gametheca.platform import cheat_surface_for_platform
from gametheca.utils.auth import admin_required
from gametheca.utils.emulator_bios import bios_status_for_cores, list_bios_files, store_bios_file
from gametheca.utils.emulator_cheats import (
    create_cheat_file,
    delete_cheat_file,
    list_cheat_files,
    read_cheat_file,
    store_cheat_file,
)
from gametheca.utils.library_acl import user_can_access_game
from gametheca.utils.play_url import library_platform_key

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
    })


@apis_bp.route('/emulator-bios', methods=['POST'])
@login_required
@admin_required
def emulator_bios_upload():
    upload = request.files.get('file')
    if upload is None:
        return jsonify({'error': 'file required'}), 400
    try:
        row = store_bios_file(upload)
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    return jsonify(row), 201
