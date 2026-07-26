"""Companion client lifecycle registry synced to the server for web UI."""

from __future__ import annotations

import json
import os
import threading
from typing import Any

_LOCK = threading.Lock()
_VALID_STATES = frozenset({'not_downloaded', 'downloaded', 'installed', 'update_available'})


def _library_root() -> str:
    try:
        from flask import current_app

        upload = current_app.config.get('UPLOAD_FOLDER')
        if upload:
            return upload
    except RuntimeError:
        pass
    return os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'library')


def _store_path(user_id: int) -> str:
    folder = os.path.join(_library_root(), 'client_lifecycle')
    os.makedirs(folder, exist_ok=True)
    return os.path.join(folder, f'user_{int(user_id)}.json')


def load_lifecycle_map(user_id: int | None) -> dict[str, str]:
    """Return {game_uuid: state} for the user, or empty."""
    if user_id is None:
        return {}
    path = _store_path(user_id)
    if not os.path.isfile(path):
        return {}
    try:
        with open(path, 'r', encoding='utf-8') as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return {}
    records = data.get('records') if isinstance(data, dict) else None
    if not isinstance(records, list):
        return {}
    out: dict[str, str] = {}
    for row in records:
        if not isinstance(row, dict):
            continue
        uuid = str(row.get('game_uuid') or '').strip()
        state = str(row.get('state') or '').strip()
        if uuid and state in _VALID_STATES:
            out[uuid] = state
    return out


def save_lifecycle_records(user_id: int, records: list[dict[str, Any]]) -> dict[str, str]:
    """Replace the user's lifecycle map from companion payload."""
    cleaned: list[dict[str, str]] = []
    mapping: dict[str, str] = {}
    for row in records or []:
        if not isinstance(row, dict):
            continue
        uuid = str(row.get('game_uuid') or '').strip()
        state = str(row.get('state') or '').strip()
        if not uuid or state not in _VALID_STATES:
            continue
        cleaned.append({'game_uuid': uuid, 'state': state})
        mapping[uuid] = state

    path = _store_path(user_id)
    with _LOCK:
        with open(path, 'w', encoding='utf-8') as fh:
            json.dump({'records': cleaned}, fh, indent=2)
    return mapping


def installed_game_uuids(user_id: int | None) -> set[str]:
    return {
        uuid
        for uuid, state in load_lifecycle_map(user_id).items()
        if state in {'installed', 'update_available'}
    }
