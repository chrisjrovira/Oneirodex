"""Queued companion commands from the web UI (install / update / uninstall)."""

from __future__ import annotations

import json
import os
import threading
import uuid
from datetime import datetime, timezone
from typing import Any

_LOCK = threading.Lock()
_VALID_ACTIONS = frozenset({'install', 'update', 'uninstall'})
_VALID_KINDS = frozenset({'base', 'update', 'extra'})


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
    folder = os.path.join(_library_root(), 'client_commands')
    os.makedirs(folder, exist_ok=True)
    return os.path.join(folder, f'user_{int(user_id)}.json')


def _read_queue(path: str) -> list[dict[str, Any]]:
    if not os.path.isfile(path):
        return []
    try:
        with open(path, 'r', encoding='utf-8') as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return []
    commands = data.get('commands') if isinstance(data, dict) else None
    if not isinstance(commands, list):
        return []
    return [row for row in commands if isinstance(row, dict)]


def _write_queue(path: str, commands: list[dict[str, Any]]) -> None:
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump({'commands': commands}, fh, indent=2)


def enqueue_client_command(
    user_id: int,
    game_uuid: str,
    action: str,
    *,
    kind: str | None = None,
    version_uuid: str | None = None,
) -> dict[str, Any]:
    """Append a pending command for the companion to claim."""
    cleaned_uuid = str(game_uuid or '').strip()
    cleaned_action = str(action or '').strip().lower()
    cleaned_kind = str(kind or '').strip().lower() or None
    cleaned_version = str(version_uuid or '').strip() or None
    if not cleaned_uuid:
        raise ValueError('game_uuid is required')
    if cleaned_action not in _VALID_ACTIONS:
        raise ValueError(f'action must be one of: {", ".join(sorted(_VALID_ACTIONS))}')
    if cleaned_kind is not None and cleaned_kind not in _VALID_KINDS:
        raise ValueError(f'kind must be one of: {", ".join(sorted(_VALID_KINDS))}')
    if cleaned_kind in {'update', 'extra'} and not cleaned_version:
        raise ValueError('version_uuid required for update/extra kind')

    command = {
        'id': str(uuid.uuid4()),
        'game_uuid': cleaned_uuid,
        'action': cleaned_action,
        'status': 'pending',
        'created_at': datetime.now(timezone.utc).isoformat(),
    }
    if cleaned_kind:
        command['kind'] = cleaned_kind
    if cleaned_version:
        command['version_uuid'] = cleaned_version

    path = _store_path(user_id)
    with _LOCK:
        queue = _read_queue(path)
        # Drop duplicate pending for same game+action+version.
        queue = [
            row
            for row in queue
            if not (
                row.get('status') == 'pending'
                and row.get('game_uuid') == cleaned_uuid
                and row.get('action') == cleaned_action
                and (row.get('version_uuid') or None) == cleaned_version
            )
        ]
        queue.append(command)
        if len(queue) > 50:
            queue = queue[-50:]
        _write_queue(path, queue)
    return command


def claim_pending_commands(user_id: int, *, limit: int = 10) -> list[dict[str, Any]]:
    """Pop up to ``limit`` pending commands and mark them claimed."""
    path = _store_path(user_id)
    claimed: list[dict[str, Any]] = []
    with _LOCK:
        queue = _read_queue(path)
        remaining: list[dict[str, Any]] = []
        for row in queue:
            if (
                len(claimed) < limit
                and row.get('status') == 'pending'
                and row.get('action') in _VALID_ACTIONS
                and row.get('game_uuid')
            ):
                delivered = {
                    'id': str(row.get('id') or uuid.uuid4()),
                    'game_uuid': str(row['game_uuid']),
                    'action': str(row['action']),
                    'created_at': row.get('created_at'),
                }
                if row.get('kind'):
                    delivered['kind'] = str(row['kind'])
                if row.get('version_uuid'):
                    delivered['version_uuid'] = str(row['version_uuid'])
                claimed.append(delivered)
            else:
                remaining.append(row)
        _write_queue(path, remaining)
    return claimed
