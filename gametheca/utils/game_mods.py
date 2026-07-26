"""Per-game mod tracking (JSON packs under library/mods)."""

from __future__ import annotations

import json
import os
import re
from typing import Any

from flask import current_app

_SAFE_UUID = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    re.I,
)


def mods_enabled() -> bool:
    return str(current_app.config.get('ENABLE_MOD_TRACKING', 'true')).lower() in (
        '1', 'true', 'yes', 'on',
    )


def mods_root() -> str:
    root = current_app.config.get('GAME_MODS_PATH')
    if root:
        return root
    return os.path.join(current_app.root_path, 'static', 'library', 'mods')


def _pack_path(game_uuid: str) -> str:
    if not _SAFE_UUID.match(game_uuid or ''):
        raise ValueError('Invalid game UUID')
    folder = os.path.join(mods_root(), game_uuid)
    os.makedirs(folder, exist_ok=True)
    return os.path.join(folder, 'mods.json')


def load_mods(game_uuid: str) -> dict[str, Any]:
    path = _pack_path(game_uuid)
    if not os.path.isfile(path):
        return {'game_uuid': game_uuid, 'mods': []}
    try:
        with open(path, 'r', encoding='utf-8') as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return {'game_uuid': game_uuid, 'mods': []}
    mods = data.get('mods') if isinstance(data, dict) else []
    if not isinstance(mods, list):
        mods = []
    cleaned = []
    for row in mods:
        if not isinstance(row, dict) or not row.get('id'):
            continue
        cleaned.append({
            'id': str(row.get('id')),
            'name': str(row.get('name') or row.get('id')),
            'version': str(row.get('version') or ''),
            'url': str(row.get('url') or ''),
            'notes': str(row.get('notes') or ''),
            'enabled': bool(row.get('enabled', True)),
        })
    return {'game_uuid': game_uuid, 'mods': cleaned}


def save_mods(game_uuid: str, mods: list[dict[str, Any]]) -> dict[str, Any]:
    pack = {'game_uuid': game_uuid, 'mods': mods}
    path = _pack_path(game_uuid)
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(pack, fh, indent=2)
    return load_mods(game_uuid)
