"""Emulator save-state API (opt-in cloud sync)."""

from __future__ import annotations

from io import BytesIO

from flask import jsonify, request, send_file
from flask_login import current_user, login_required
from sqlalchemy import select

from gametheca import db
from gametheca.models import Game
from gametheca.utils.emulator_saves import (
    delete_save,
    list_saves,
    read_save_bytes,
    save_sync_enabled,
    store_save,
)
from gametheca.utils.library_acl import user_can_access_game

from . import apis_bp


@apis_bp.route('/games/<game_uuid>/saves', methods=['GET'])
@login_required
def list_game_saves(game_uuid):
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game:
        return jsonify({'error': 'Game not found'}), 404
    if not user_can_access_game(current_user, game):
        return jsonify({'error': 'Forbidden'}), 403

    return jsonify({
        'enabled': save_sync_enabled(),
        'game_uuid': game_uuid,
        'saves': [row.to_dict() for row in list_saves(current_user.id, game_uuid)],
    })


@apis_bp.route('/games/<game_uuid>/saves', methods=['POST'])
@login_required
def upload_game_save(game_uuid):
    if not save_sync_enabled():
        return jsonify({'error': 'Emulator save sync is disabled'}), 403

    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game:
        return jsonify({'error': 'Game not found'}), 404
    if not user_can_access_game(current_user, game):
        return jsonify({'error': 'Forbidden'}), 403

    upload = request.files.get('file') or request.files.get('save')
    if not upload:
        return jsonify({'error': 'multipart file field "file" is required'}), 400
    slot = (request.form.get('slot') or request.args.get('slot') or 'slot1').strip()

    try:
        row = store_save(
            user_id=current_user.id,
            game_uuid=game_uuid,
            slot_name=slot,
            file_storage=upload,
        )
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    except RuntimeError as exc:
        return jsonify({'error': str(exc)}), 403

    return jsonify(row.to_dict()), 201


@apis_bp.route('/games/<game_uuid>/saves/<slot_name>', methods=['GET'])
@login_required
def download_game_save(game_uuid, slot_name):
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game:
        return jsonify({'error': 'Game not found'}), 404
    if not user_can_access_game(current_user, game):
        return jsonify({'error': 'Forbidden'}), 403

    rows = list_saves(current_user.id, game_uuid)
    row = next((item for item in rows if item.slot_name == slot_name), None)
    if not row:
        return jsonify({'error': 'Save not found'}), 404
    try:
        payload = read_save_bytes(row)
    except FileNotFoundError:
        return jsonify({'error': 'Save not found'}), 404
    except Exception as exc:
        return jsonify({'error': f'Failed to read save: {exc}'}), 500

    return send_file(
        BytesIO(payload),
        as_attachment=True,
        download_name=row.filename,
        mimetype='application/octet-stream',
    )


@apis_bp.route('/games/<game_uuid>/saves/<slot_name>', methods=['DELETE'])
@login_required
def delete_game_save(game_uuid, slot_name):
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game:
        return jsonify({'error': 'Game not found'}), 404
    if not user_can_access_game(current_user, game):
        return jsonify({'error': 'Forbidden'}), 403
    if not delete_save(current_user.id, game_uuid, slot_name):
        return jsonify({'error': 'Save not found'}), 404
    return jsonify({'status': 'deleted', 'slot_name': slot_name})
