"""Validate CSV/JSON leaf library definitions (preview-only; never creates).

Same candidate fields as propose-from-tree:
``path``, ``suggested_name``/``name``, ``platform``, ``scan_mode``, ``scan_depth``.

Rejects family mega-lib parents (NINTENDO / Sega / Sony / …), invalid platforms,
and paths outside allowed bases. Does **not** insert Library rows — create via
existing ``POST /admin/library/add`` + first scan (same as propose UI).
"""

from __future__ import annotations

import csv
import io
import json
import os
from typing import Any

from oneirodex.platform import LibraryPlatform
from oneirodex.utils.propose_leaf_libraries import is_family_parent_name
from oneirodex.utils.security import is_safe_path

VALID_SCAN_MODES = frozenset({'folders', 'files'})
VALID_SCAN_DEPTHS = frozenset({1, 2})

# CSV / JSON field aliases → canonical key
_NAME_KEYS = ('suggested_name', 'name', 'library_name', 'title')
_PATH_KEYS = ('path', 'folder', 'folder_path', 'root')
_PLATFORM_KEYS = ('platform', 'library_platform')
_MODE_KEYS = ('scan_mode', 'mode')
_DEPTH_KEYS = ('scan_depth', 'depth')


def _pick(row: dict[str, Any], keys: tuple[str, ...]) -> Any:
    for key in keys:
        if key in row and row[key] is not None and str(row[key]).strip() != '':
            return row[key]
    # Case-insensitive fallback for CSV headers
    lower_map = {str(k).strip().casefold(): v for k, v in row.items() if k is not None}
    for key in keys:
        if key.casefold() in lower_map:
            val = lower_map[key.casefold()]
            if val is not None and str(val).strip() != '':
                return val
    return None


def _normalize_platform(raw: Any) -> str | None:
    if raw is None:
        return None
    text = str(raw).strip()
    if not text:
        return None
    # Accept enum name (SWITCH) or value ("Nintendo Switch")
    try:
        return LibraryPlatform[text].name
    except KeyError:
        pass
    upper = text.upper().replace(' ', '_').replace('-', '_')
    try:
        return LibraryPlatform[upper].name
    except KeyError:
        pass
    for member in LibraryPlatform:
        if member.name.casefold() == text.casefold():
            return member.name
        if member.value.casefold() == text.casefold():
            return member.name
    return None


def _normalize_scan_mode(raw: Any) -> str | None:
    if raw is None or str(raw).strip() == '':
        return 'folders'
    text = str(raw).strip().casefold()
    if text in ('folder', 'directories', 'dirs', 'directory'):
        text = 'folders'
    if text in ('file',):
        text = 'files'
    if text in VALID_SCAN_MODES:
        return text
    return None


def _normalize_scan_depth(raw: Any) -> int | None:
    if raw is None or str(raw).strip() == '':
        return 1
    try:
        depth = int(raw)
    except (TypeError, ValueError):
        return None
    if depth in VALID_SCAN_DEPTHS:
        return depth
    return None


def parse_json_rows(payload: str | bytes | dict | list) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Parse JSON into raw row dicts. Returns (rows, parse_errors)."""
    errors: list[dict[str, Any]] = []
    if isinstance(payload, (bytes, bytearray)):
        payload = payload.decode('utf-8-sig')
    if isinstance(payload, str):
        try:
            data = json.loads(payload)
        except json.JSONDecodeError as exc:
            return [], [{'index': None, 'path': None, 'code': 'invalid_json', 'message': str(exc)}]
    else:
        data = payload

    if isinstance(data, dict):
        rows = (
            data.get('candidates')
            or data.get('items')
            or data.get('libraries')
            or data.get('rows')
            or None
        )
        if rows is None:
            # Single-row object with path
            if _pick(data, _PATH_KEYS) is not None:
                rows = [data]
            else:
                return [], [{
                    'index': None,
                    'path': None,
                    'code': 'invalid_json_shape',
                    'message': 'JSON must be an array or {candidates|items|libraries|rows: [...]}',
                }]
    elif isinstance(data, list):
        rows = data
    else:
        return [], [{
            'index': None,
            'path': None,
            'code': 'invalid_json_shape',
            'message': 'JSON must be an array or object with candidate rows',
        }]

    if not isinstance(rows, list):
        return [], [{
            'index': None,
            'path': None,
            'code': 'invalid_json_shape',
            'message': 'candidates must be a list',
        }]

    out: list[dict[str, Any]] = []
    for index, item in enumerate(rows):
        if not isinstance(item, dict):
            errors.append({
                'index': index,
                'path': None,
                'code': 'invalid_row',
                'message': f'Row {index} is not an object',
            })
            continue
        out.append(item)
    return out, errors


def parse_csv_rows(text: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Parse CSV text with header row into dicts. Returns (rows, parse_errors)."""
    if not text or not str(text).strip():
        return [], [{'index': None, 'path': None, 'code': 'empty_csv', 'message': 'CSV is empty'}]
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        return [], [{'index': None, 'path': None, 'code': 'empty_csv', 'message': 'CSV has no header row'}]
    rows: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    for index, row in enumerate(reader):
        if row is None:
            continue
        # Skip fully blank lines
        if all(v is None or str(v).strip() == '' for v in row.values()):
            continue
        rows.append({k: v for k, v in row.items() if k is not None})
    if not rows and not errors:
        errors.append({
            'index': None,
            'path': None,
            'code': 'empty_csv',
            'message': 'CSV has a header but no data rows',
        })
    return rows, errors


def validate_import_row(
    row: dict[str, Any],
    *,
    index: int,
    allowed_bases: list[str] | None,
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    """Validate one raw row. Returns (candidate, error) — one side is None."""
    path_raw = _pick(row, _PATH_KEYS)
    path = str(path_raw).strip() if path_raw is not None else ''
    if not path:
        return None, {
            'index': index,
            'path': None,
            'code': 'missing_path',
            'message': 'path is required',
        }

    path = os.path.normpath(path)
    basename = os.path.basename(path.rstrip('\\/')) or path

    if is_family_parent_name(basename):
        return None, {
            'index': index,
            'path': path,
            'code': 'family_parent_rejected',
            'message': (
                f'Refused family/mega-lib parent "{basename}" — '
                'import leaf platform folders only (never NINTENDO/Sega/Sony/…).'
            ),
        }

    if allowed_bases is not None:
        safe, err = is_safe_path(path, allowed_bases)
        if not safe:
            return None, {
                'index': index,
                'path': path,
                'code': 'path_outside_allowed_bases',
                'message': err or 'path outside allowed bases',
            }

    platform_raw = _pick(row, _PLATFORM_KEYS)
    platform = _normalize_platform(platform_raw)
    if platform is None:
        shown = str(platform_raw).strip() if platform_raw is not None else ''
        return None, {
            'index': index,
            'path': path,
            'code': 'invalid_platform',
            'message': f'Invalid platform {shown!r} — use a LibraryPlatform name (e.g. SWITCH, PSX, NES)',
        }

    scan_mode = _normalize_scan_mode(_pick(row, _MODE_KEYS))
    if scan_mode is None:
        return None, {
            'index': index,
            'path': path,
            'code': 'invalid_scan_mode',
            'message': 'scan_mode must be folders or files',
        }

    scan_depth = _normalize_scan_depth(_pick(row, _DEPTH_KEYS))
    if scan_depth is None:
        return None, {
            'index': index,
            'path': path,
            'code': 'invalid_scan_depth',
            'message': 'scan_depth must be 1 or 2',
        }

    name_raw = _pick(row, _NAME_KEYS)
    suggested_name = str(name_raw).strip() if name_raw is not None else ''
    if not suggested_name:
        if platform == 'SWITCH':
            suggested_name = 'Nintendo Switch'
        else:
            suggested_name = basename

    candidate = {
        'path': path,
        'suggested_name': suggested_name,
        'platform': platform,
        'scan_mode': scan_mode,
        'scan_depth': scan_depth,
        'reason': 'csv/json import preview',
        'source_index': index,
    }
    return candidate, None


def preview_import_rows(
    rows: list[dict[str, Any]],
    *,
    allowed_bases: list[str] | None,
    prior_errors: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Normalize raw rows into candidates + errors. Never creates libraries."""
    candidates: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = list(prior_errors or [])
    for index, row in enumerate(rows):
        candidate, error = validate_import_row(row, index=index, allowed_bases=allowed_bases)
        if error:
            errors.append(error)
            continue
        assert candidate is not None
        candidates.append(candidate)

    return {
        'status': 'ok',
        'auto_create': False,
        'candidates': candidates,
        'errors': errors,
        'count': len(candidates),
        'error_count': len(errors),
        'create_hint': (
            'Preview only — never auto-creates. Confirm in UI by creating each selected '
            'row via POST /admin/library/add (name/platform/scan_depth) then '
            'POST /api/admin/libraries/scan {library_uuid, folder: path, scan_mode} '
            '(same confirm path as propose leaf libraries).'
        ),
    }


def preview_from_json(
    payload: str | bytes | dict | list,
    *,
    allowed_bases: list[str] | None,
) -> dict[str, Any]:
    rows, parse_errors = parse_json_rows(payload)
    return preview_import_rows(rows, allowed_bases=allowed_bases, prior_errors=parse_errors)


def preview_from_csv(
    text: str,
    *,
    allowed_bases: list[str] | None,
) -> dict[str, Any]:
    rows, parse_errors = parse_csv_rows(text)
    return preview_import_rows(rows, allowed_bases=allowed_bases, prior_errors=parse_errors)
