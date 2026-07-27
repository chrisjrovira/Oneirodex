"""Single-player assist packs (Wand-inspired) for the desktop companion."""

from __future__ import annotations

import json
import os
import re
from typing import Any

from flask import current_app, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import select

from gametheca import db
from gametheca.models import Game
from gametheca.utils.auth import admin_required
from gametheca.utils.library_acl import user_can_access_game

from . import apis_bp

_SAFE_UUID = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    re.I,
)


def assists_enabled() -> bool:
    return str(current_app.config.get('ENABLE_GAME_ASSISTS', 'true')).lower() in (
        '1', 'true', 'yes', 'on',
    )


def assists_root() -> str:
    root = current_app.config.get('GAME_ASSISTS_PATH')
    if root:
        return root
    return os.path.join(current_app.root_path, 'static', 'library', 'assists')


def _pack_path(game_uuid: str) -> str:
    if not _SAFE_UUID.match(game_uuid or ''):
        raise ValueError('Invalid game UUID')
    folder = os.path.join(assists_root(), game_uuid)
    os.makedirs(folder, exist_ok=True)
    return os.path.join(folder, 'pack.json')


def load_assist_pack(game_uuid: str) -> dict[str, Any] | None:
    path = _pack_path(game_uuid)
    if not os.path.isfile(path):
        return None
    try:
        with open(path, 'r', encoding='utf-8') as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return None
    if not isinstance(data, dict):
        return None
    toggles = data.get('toggles')
    if not isinstance(toggles, list):
        toggles = []
    return {
        'game_uuid': game_uuid,
        'title': data.get('title') or 'Assists',
        'policy': data.get('policy') or 'single_player_offline_only',
        'toggles': [
            {
                'id': str(row.get('id') or ''),
                'label': str(row.get('label') or row.get('id') or 'Toggle'),
                'description': str(row.get('description') or ''),
            }
            for row in toggles
            if isinstance(row, dict) and row.get('id')
        ],
    }


@apis_bp.route('/games/<game_uuid>/assists', methods=['GET'])
@login_required
def get_game_assists(game_uuid):
    if not assists_enabled():
        return jsonify({'enabled': False, 'pack': None})
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game:
        return jsonify({'error': 'Game not found'}), 404
    if not user_can_access_game(current_user, game):
        return jsonify({'error': 'Forbidden'}), 403
    return jsonify({'enabled': True, 'pack': load_assist_pack(game_uuid)})


@apis_bp.route('/games/<game_uuid>/assists', methods=['PUT', 'POST'])
@login_required
@admin_required
def put_game_assists(game_uuid):
    if not assists_enabled():
        return jsonify({'error': 'ENABLE_GAME_ASSISTS is off'}), 403
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game:
        return jsonify({'error': 'Game not found'}), 404
    data = request.get_json(silent=True) or {}
    pack = {
        'title': data.get('title') or game.name,
        'policy': 'single_player_offline_only',
        'toggles': data.get('toggles') or [],
    }
    path = _pack_path(game_uuid)
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(pack, fh, indent=2)
    return jsonify({'ok': True, 'pack': load_assist_pack(game_uuid)})
