"""RetroArch-style .cht cheat library for browser / companion emulation."""

from __future__ import annotations

import os
import re
from typing import Any

from flask import current_app
from werkzeug.utils import secure_filename

_SAFE_UUID = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    re.I,
)


def cheats_root() -> str:
    root = current_app.config.get('EMULATOR_CHEATS_PATH')
    if root:
        return root
    return os.path.join(current_app.root_path, 'static', 'library', 'cheats')


def _game_dir(game_uuid: str) -> str:
    if not _SAFE_UUID.match(game_uuid or ''):
        raise ValueError('Invalid game UUID')
    path = os.path.join(cheats_root(), game_uuid)
    os.makedirs(path, exist_ok=True)
    return path


def list_cheat_files(game_uuid: str) -> list[dict[str, Any]]:
    folder = _game_dir(game_uuid)
    rows = []
    for name in sorted(os.listdir(folder)):
        if not name.lower().endswith('.cht'):
            continue
        path = os.path.join(folder, name)
        if not os.path.isfile(path):
            continue
        rows.append({
            'name': name,
            'size': os.path.getsize(path),
            'url': f'/api/games/{game_uuid}/cheats/{name}',
        })
    return rows


def read_cheat_file(game_uuid: str, filename: str) -> bytes:
    safe = secure_filename(filename)
    if not safe.lower().endswith('.cht'):
        raise ValueError('Only .cht files are supported')
    path = os.path.join(_game_dir(game_uuid), safe)
    if not os.path.isfile(path):
        raise FileNotFoundError('Cheat file not found')
    with open(path, 'rb') as handle:
        return handle.read()


def store_cheat_file(game_uuid: str, file_storage) -> dict[str, Any]:
    safe = secure_filename(getattr(file_storage, 'filename', None) or '')
    if not safe.lower().endswith('.cht'):
        raise ValueError('Only .cht files are supported')
    dest = os.path.join(_game_dir(game_uuid), safe)
    file_storage.save(dest)
    return {
        'name': safe,
        'size': os.path.getsize(dest),
        'url': f'/api/games/{game_uuid}/cheats/{safe}',
    }


def delete_cheat_file(game_uuid: str, filename: str) -> None:
    safe = secure_filename(filename)
    path = os.path.join(_game_dir(game_uuid), safe)
    if os.path.isfile(path):
        os.remove(path)
