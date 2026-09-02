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

# Capability-language dialects (form hint → code normalize into .cht). No Class A brands.
CHEAT_DIALECTS = frozenset({
    'raw',
    'game_genie',
    'action_replay',
    'gameshark',
})

_DIALECT_LABELS = {
    'raw': 'Raw',
    'game_genie': 'GG-style',
    'action_replay': 'AR-style',
    'gameshark': 'GS-style',
}


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


def _assert_under_game_dir(game_uuid: str, path: str) -> str:
    """Resolve path and ensure it stays under EMULATOR_CHEATS_PATH/{uuid}/."""
    folder = os.path.realpath(_game_dir(game_uuid))
    resolved = os.path.realpath(path)
    if resolved != folder and not resolved.startswith(folder + os.sep):
        raise ValueError('Invalid cheat path')
    return resolved


def _cht_filename(name: str) -> str:
    raw = (name or '').strip()
    if not raw:
        raise ValueError('name required')
    safe = secure_filename(raw)
    if not safe:
        raise ValueError('name required')
    if not safe.lower().endswith('.cht'):
        safe = f'{safe}.cht'
    safe = secure_filename(safe)
    if not safe or not safe.lower().endswith('.cht'):
        raise ValueError('Only .cht files are supported')
    return safe


def _normalize_code(code: str, dialect: str | None) -> str:
    """Serialize operator code text into RetroArch cheatN_code form."""
    text = (code or '').strip()
    if not text:
        raise ValueError('code required')
    # Collapse whitespace; join multi-token lines with + (RetroArch convention).
    parts = re.split(r'\s+', text)
    if dialect in (None, 'raw') and len(parts) == 1:
        return parts[0]
    return '+'.join(parts)


def _normalize_dialect(dialect: Any) -> str | None:
    if dialect is None or dialect == '':
        return None
    value = str(dialect).strip().lower().replace('-', '_').replace(' ', '_')
    if value not in CHEAT_DIALECTS:
        raise ValueError(
            'dialect must be one of: raw, game_genie, action_replay, gameshark'
        )
    return value


def build_cht_text(
    *,
    name: str,
    codes: list[Any],
    dialect: str | None = None,
) -> str:
    """Build RetroArch .cht body from easy-create payload."""
    if not (name or '').strip():
        raise ValueError('name required')
    if not isinstance(codes, list) or not codes:
        raise ValueError('codes required')

    dialect = _normalize_dialect(dialect)
    label = _DIALECT_LABELS.get(dialect or '', '')
    lines = [f'cheats = {len(codes)}', '']

    for index, row in enumerate(codes):
        if not isinstance(row, dict):
            raise ValueError('each code must be an object with code')
        code_raw = row.get('code')
        if code_raw is None or str(code_raw).strip() == '':
            raise ValueError('code required')
        desc = (row.get('desc') or row.get('description') or '').strip()
        if not desc:
            desc = name.strip() if len(codes) == 1 else f'Code {index + 1}'
        if label and label.lower() not in desc.lower():
            desc = f'{label}: {desc}'
        code = _normalize_code(str(code_raw), dialect)
        # Escape quotes in desc for .cht string values
        desc_safe = desc.replace('\\', '\\\\').replace('"', '\\"')
        code_safe = code.replace('\\', '\\\\').replace('"', '\\"')
        lines.append(f'cheat{index}_desc = "{desc_safe}"')
        lines.append(f'cheat{index}_code = "{code_safe}"')
        lines.append(f'cheat{index}_enable = false')
        lines.append('')

    return '\n'.join(lines).rstrip() + '\n'


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
    path = _assert_under_game_dir(game_uuid, os.path.join(_game_dir(game_uuid), safe))
    if not os.path.isfile(path):
        raise FileNotFoundError('Cheat file not found')
    with open(path, 'rb') as handle:
        return handle.read()


def store_cheat_file(game_uuid: str, file_storage) -> dict[str, Any]:
    safe = secure_filename(getattr(file_storage, 'filename', None) or '')
    if not safe.lower().endswith('.cht'):
        raise ValueError('Only .cht files are supported')
    dest = _assert_under_game_dir(game_uuid, os.path.join(_game_dir(game_uuid), safe))
    file_storage.save(dest)
    return {
        'name': safe,
        'size': os.path.getsize(dest),
        'url': f'/api/games/{game_uuid}/cheats/{safe}',
    }


def create_cheat_file(
    game_uuid: str,
    *,
    name: str,
    codes: list[Any],
    dialect: str | None = None,
) -> dict[str, Any]:
    """Write a new .cht from easy-create JSON under EMULATOR_CHEATS_PATH/{uuid}/."""
    safe = _cht_filename(name)
    dialect = _normalize_dialect(dialect)
    body = build_cht_text(name=name, codes=codes, dialect=dialect)
    dest = _assert_under_game_dir(game_uuid, os.path.join(_game_dir(game_uuid), safe))
    with open(dest, 'w', encoding='utf-8', newline='\n') as handle:
        handle.write(body)
    row: dict[str, Any] = {
        'name': safe,
        'size': os.path.getsize(dest),
        'url': f'/api/games/{game_uuid}/cheats/{safe}',
        'created': True,
    }
    if dialect:
        row['dialect'] = dialect
    return row


def delete_cheat_file(game_uuid: str, filename: str) -> None:
    safe = secure_filename(filename)
    path = _assert_under_game_dir(game_uuid, os.path.join(_game_dir(game_uuid), safe))
    if os.path.isfile(path):
        os.remove(path)
