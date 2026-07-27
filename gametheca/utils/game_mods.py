"""Per-game mod tracking (JSON packs under library/mods)."""

from __future__ import annotations

import json
import os
import re
from typing import Any
from uuid import uuid4

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


def _normalize_mod_row(row: dict[str, Any], *, default_order: int) -> dict[str, Any] | None:
    if not isinstance(row, dict):
        return None
    mod_id = str(row.get('id') or '').strip()
    if not mod_id:
        return None
    source_url = str(
        row.get('source_url')
        or row.get('url')
        or ''
    ).strip()
    try:
        load_order = int(row.get('load_order', default_order))
    except (TypeError, ValueError):
        load_order = default_order
    return {
        'id': mod_id,
        'name': str(row.get('name') or mod_id),
        'version': str(row.get('version') or ''),
        'source_url': source_url,
        'url': source_url,
        'notes': str(row.get('notes') or ''),
        'enabled': bool(row.get('enabled', True)),
        'load_order': load_order,
    }


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
    cleaned: list[dict[str, Any]] = []
    for index, row in enumerate(mods):
        normalized = _normalize_mod_row(row, default_order=index)
        if normalized:
            cleaned.append(normalized)
    cleaned.sort(key=lambda item: (item['load_order'], item['name'].lower()))
    return {'game_uuid': game_uuid, 'mods': cleaned}


def save_mods(game_uuid: str, mods: list[dict[str, Any]]) -> dict[str, Any]:
    normalized: list[dict[str, Any]] = []
    for index, row in enumerate(mods):
        item = _normalize_mod_row(row, default_order=index)
        if item:
            normalized.append(item)
    normalized.sort(key=lambda item: (item['load_order'], item['name'].lower()))
    pack = {'game_uuid': game_uuid, 'mods': normalized}
    path = _pack_path(game_uuid)
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(pack, fh, indent=2)
    return load_mods(game_uuid)


def create_mod(game_uuid: str, payload: dict[str, Any]) -> dict[str, Any]:
    pack = load_mods(game_uuid)
    mods = pack['mods']
    mod_id = str(payload.get('id') or uuid4())
    if any(row['id'] == mod_id for row in mods):
        raise ValueError('Mod id already exists')
    next_order = max((row['load_order'] for row in mods), default=-1) + 1
    row = _normalize_mod_row(
        {
            'id': mod_id,
            'name': payload.get('name'),
            'version': payload.get('version'),
            'source_url': payload.get('source_url', payload.get('url')),
            'notes': payload.get('notes'),
            'enabled': payload.get('enabled', True),
            'load_order': payload.get('load_order', next_order),
        },
        default_order=next_order,
    )
    if not row:
        raise ValueError('Invalid mod payload')
    mods.append(row)
    saved = save_mods(game_uuid, mods)
    created = next(item for item in saved['mods'] if item['id'] == mod_id)
    return created


def update_mod(game_uuid: str, mod_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    pack = load_mods(game_uuid)
    mods = pack['mods']
    index = next((i for i, row in enumerate(mods) if row['id'] == mod_id), None)
    if index is None:
        raise LookupError('Mod not found')
    current = mods[index]
    merged = {
        **current,
        **payload,
        'id': mod_id,
        'source_url': payload.get('source_url', payload.get('url', current['source_url'])),
    }
    updated = _normalize_mod_row(merged, default_order=current['load_order'])
    if not updated:
        raise ValueError('Invalid mod payload')
    mods[index] = updated
    saved = save_mods(game_uuid, mods)
    return next(item for item in saved['mods'] if item['id'] == mod_id)


def delete_mod(game_uuid: str, mod_id: str) -> bool:
    pack = load_mods(game_uuid)
    mods = [row for row in pack['mods'] if row['id'] != mod_id]
    if len(mods) == len(pack['mods']):
        return False
    save_mods(game_uuid, mods)
    return True


def list_mods_summary(game_uuids: list[str]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for game_uuid in game_uuids:
        pack = load_mods(game_uuid)
        mods = pack['mods']
        if not mods:
            continue
        rows.append({
            'game_uuid': game_uuid,
            'mod_count': len(mods),
            'enabled_count': sum(1 for row in mods if row.get('enabled')),
        })
    return rows
