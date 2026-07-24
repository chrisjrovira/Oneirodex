"""Local version / DLC hints from name, NFO, and on-disk files."""

from __future__ import annotations

import os
import re
from datetime import datetime, timezone

VERSION_PATTERNS = [
    re.compile(r'(?i)\bv(\d+(?:\.\d+){1,3})\b'),
    re.compile(r'(?i)(?:^|[_\s.-])(\d+\.\d+(?:\.\d+){0,2})(?:[_\s.-]|$)'),
    re.compile(r'(?i)build[:\s_-]*(\d+)'),
]
DLC_COUNT_RE = re.compile(r'(?i)\+(\d+)\s*DLCs?')
VERSION_FILE_NAMES = (
    'version.txt',
    'version',
    'VERSION',
    'build.txt',
    'Build.txt',
    'product_version.txt',
)


def _first_version(text: str | None) -> str | None:
    if not text:
        return None
    for pattern in VERSION_PATTERNS:
        match = pattern.search(text)
        if match:
            return match.group(1)
    return None


def _folder_mtime(path: str | None) -> str | None:
    if not path or not os.path.isdir(path):
        return None
    try:
        ts = os.path.getmtime(path)
        return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
    except OSError:
        return None


def _read_version_file(folder: str) -> tuple[str | None, str | None]:
    for name in VERSION_FILE_NAMES:
        path = os.path.join(folder, name)
        if not os.path.isfile(path):
            continue
        try:
            with open(path, 'r', encoding='utf-8', errors='ignore') as handle:
                content = handle.read(4096)
        except OSError:
            continue
        version = _first_version(content) or content.strip().splitlines()[0].strip()[:80]
        if version:
            return version, name
    return None, None


def _scan_update_dlc_hints(game) -> list[str]:
    hints = []
    for update in getattr(game, 'updates', None) or []:
        path = getattr(update, 'file_path', '') or ''
        base = os.path.basename(path.rstrip('\\/'))
        if base:
            hints.append(base)
        nfo = getattr(update, 'nfo_content', None)
        if nfo:
            hints.append(nfo[:200])
    for extra in getattr(game, 'extras', None) or []:
        path = getattr(extra, 'file_path', '') or ''
        base = os.path.basename(path.rstrip('\\/')).lower()
        if 'dlc' in base:
            hints.append(os.path.basename(path.rstrip('\\/')))
    return hints


def detect_local_facts(game) -> dict:
    """Collect local version / DLC facts without network I/O."""
    name = getattr(game, 'name', None) or ''
    path = getattr(game, 'full_disk_path', None) or ''
    folder_label = os.path.basename(path.rstrip('\\/')) if path else ''
    nfo = getattr(game, 'nfo_content', None) or ''

    sources_tried = []
    version = None
    source = None

    for label, text in (
        ('folder_name', folder_label),
        ('game_name', name),
        ('nfo', nfo),
    ):
        sources_tried.append(label)
        found = _first_version(text)
        if found:
            version = found
            source = label
            break

    version_file = None
    if path and os.path.isdir(path):
        file_ver, file_name = _read_version_file(path)
        sources_tried.append('version_file')
        if file_ver and not version:
            version = file_ver
            source = 'version_file'
            version_file = file_name
        elif file_ver:
            version_file = file_name

    dlc_count = None
    for text in (folder_label, name, nfo):
        match = DLC_COUNT_RE.search(text or '')
        if match:
            dlc_count = int(match.group(1))
            break

    update_hints = _scan_update_dlc_hints(game)

    return {
        'version': version,
        'source': source,
        'version_file': version_file,
        'dlc_count_hint': dlc_count,
        'update_hints': update_hints[:20],
        'folder_mtime': _folder_mtime(path),
        'path': path or None,
        'sources_tried': sources_tried,
    }
