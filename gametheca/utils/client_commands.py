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
_IN_FLIGHT_TTL_SECONDS = 600


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


def _parse_iso(value: Any) -> datetime | None:
    if not value or not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        return None


def _reclaim_stale(queue: list[dict[str, Any]], *, now: datetime) -> list[dict[str, Any]]:
    refreshed: list[dict[str, Any]] = []
    for row in queue:
        if row.get('status') != 'in_flight':
            refreshed.append(row)
            continue
        claimed_at = _parse_iso(row.get('claimed_at'))
        age = (now - claimed_at).total_seconds() if claimed_at else _IN_FLIGHT_TTL_SECONDS + 1
        if age > _IN_FLIGHT_TTL_SECONDS:
            pending = dict(row)
            pending['status'] = 'pending'
            pending.pop('claimed_at', None)
            refreshed.append(pending)
        else:
            refreshed.append(row)
    return refreshed


def _public_command(row: dict[str, Any]) -> dict[str, Any]:
    delivered = {
        'id': str(row.get('id') or uuid.uuid4()),
        'game_uuid': str(row['game_uuid']),
        'action': str(row['action']),
        'created_at': row.get('created_at'),
        'status': row.get('status') or 'pending',
    }
    if row.get('kind'):
        delivered['kind'] = str(row['kind'])
    if row.get('version_uuid'):
        delivered['version_uuid'] = str(row['version_uuid'])
    return delivered


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
    """Mark up to ``limit`` pending commands in_flight and return them (durable until ack)."""
    path = _store_path(user_id)
    claimed: list[dict[str, Any]] = []
    now = datetime.now(timezone.utc)
    with _LOCK:
        queue = _reclaim_stale(_read_queue(path), now=now)
        updated: list[dict[str, Any]] = []
        for row in queue:
            if (
                len(claimed) < limit
                and row.get('status') == 'pending'
                and row.get('action') in _VALID_ACTIONS
                and row.get('game_uuid')
            ):
                in_flight = dict(row)
                in_flight['status'] = 'in_flight'
                in_flight['claimed_at'] = now.isoformat()
                if not in_flight.get('id'):
                    in_flight['id'] = str(uuid.uuid4())
                updated.append(in_flight)
                claimed.append(_public_command(in_flight))
            else:
                updated.append(row)
        _write_queue(path, updated)
    return claimed


def ack_client_commands(user_id: int, command_ids: list[str]) -> int:
    """Remove successfully handled commands from the queue."""
    wanted = {str(cid).strip() for cid in command_ids if str(cid).strip()}
    if not wanted:
        return 0
    path = _store_path(user_id)
    with _LOCK:
        queue = _read_queue(path)
        remaining = [row for row in queue if str(row.get('id') or '') not in wanted]
        removed = len(queue) - len(remaining)
        if removed:
            _write_queue(path, remaining)
        return removed


def nack_client_commands(user_id: int, command_ids: list[str]) -> int:
    """Return in-flight commands to pending so they can be retried."""
    wanted = {str(cid).strip() for cid in command_ids if str(cid).strip()}
    if not wanted:
        return 0
    path = _store_path(user_id)
    released = 0
    with _LOCK:
        queue = _read_queue(path)
        updated: list[dict[str, Any]] = []
        for row in queue:
            if str(row.get('id') or '') in wanted:
                pending = dict(row)
                pending['status'] = 'pending'
                pending.pop('claimed_at', None)
                updated.append(pending)
                released += 1
            else:
                updated.append(row)
        if released:
            _write_queue(path, updated)
    return released
