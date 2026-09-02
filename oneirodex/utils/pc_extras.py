"""PC-first extras / DLC folder discovery during library scan.

Console/ROM DLC trees are deferred (messy naming). This module only classifies
common under-game folder names and known sidecar patterns for PC libraries.
"""

from __future__ import annotations

import os
import re
from typing import Iterable

# Normalized folder basename → extra_kind
_PC_FOLDER_KIND: dict[str, str] = {
    'dlc': 'dlc',
    'dlcs': 'dlc',
    'dlcpack': 'dlc',
    'dlcpacks': 'dlc',
    'dlc pack': 'dlc',
    'dlc packs': 'dlc',
    'add-on': 'dlc',
    'addon': 'dlc',
    'add-ons': 'dlc',
    'addons': 'dlc',
    'extra': 'extra',
    'extras': 'extra',
    'extra content': 'extra',
    'extracontent': 'extra',
    'bonus': 'extra',
    'bonus content': 'extra',
    'bonuscontent': 'extra',
    'soundtrack': 'extra',
    'ost': 'extra',
    'artbook': 'extra',
    'manual': 'manual',
    'manuals': 'manual',
}

_DLC_TOKEN_RE = re.compile(r'(^|[\s_\-.])dlc($|[\s_\-.])', re.IGNORECASE)


def _normalize_folder_key(name: str) -> str:
    return re.sub(r'\s+', ' ', (name or '').strip().lower().replace('_', ' ').replace('-', ' '))


def classify_pc_extra_folder(folder_name: str) -> str | None:
    """Return extra_kind for a known PC extras/DLC folder name, else None."""
    key = _normalize_folder_key(folder_name)
    if key in _PC_FOLDER_KIND:
        return _PC_FOLDER_KIND[key]
    if _DLC_TOKEN_RE.search(folder_name or ''):
        return 'dlc'
    return None


def is_pc_library_platform(platform) -> bool:
    """True for PC Windows / PC DOS (Wave 2a PC-first extras)."""
    if platform is None:
        return False
    value = getattr(platform, 'value', None) or getattr(platform, 'name', None) or str(platform)
    value_u = str(value).upper()
    return value_u in {'PCWIN', 'PCDOS', 'PC WINDOWS', 'PC DOS'} or 'PC WINDOWS' in str(value).upper()


def discover_pc_extra_folders(
    full_disk_path: str,
    *,
    configured_extras_name: str | None = None,
    configured_updates_name: str | None = None,
) -> list[dict]:
    """
    List under-game folders that look like DLC/extras for PC ingest.

    Returns dicts: {path, name, extra_kind}. Skips the configured updates folder
    and de-dupes the configured extras folder (caller may already process it).
    """
    if not full_disk_path or not os.path.isdir(full_disk_path):
        return []

    skip = set()
    for raw in (configured_extras_name, configured_updates_name):
        if raw:
            skip.add(_normalize_folder_key(raw))

    found: list[dict] = []
    try:
        entries = os.listdir(full_disk_path)
    except OSError:
        return []

    for entry in entries:
        child = os.path.join(full_disk_path, entry)
        if not os.path.isdir(child):
            continue
        key = _normalize_folder_key(entry)
        if key in skip:
            continue
        kind = classify_pc_extra_folder(entry)
        if not kind:
            continue
        found.append({'path': child, 'name': entry, 'extra_kind': kind})
    return found


def discover_pc_sidecar_dlc(
    full_disk_path: str,
    game_name: str | None = None,
) -> list[dict]:
    """
    Detect sibling folders next to the game that look like DLC packs for the title.

    Example: ``/games/Foo`` + sibling ``/games/Foo DLC`` or ``/games/Foo-DLC-Pack``.
    Conservative: basename must start with cleaned game/folder stem and contain DLC.
    """
    parent = os.path.dirname(full_disk_path.rstrip('\\/')) if full_disk_path else ''
    if not parent or not os.path.isdir(parent):
        return []

    stem = folder_stem(full_disk_path) or folder_stem_from_name(game_name or '')
    if len(stem) < 3:
        return []

    stem_norm = _normalize_folder_key(stem)
    game_norm = os.path.normcase(os.path.abspath(full_disk_path)) if full_disk_path else ''
    found: list[dict] = []
    try:
        siblings = os.listdir(parent)
    except OSError:
        return []

    for entry in siblings:
        child = os.path.join(parent, entry)
        if not os.path.isdir(child):
            continue
        try:
            if os.path.normcase(os.path.abspath(child)) == game_norm:
                continue
        except (OSError, ValueError):
            continue
        entry_key = _normalize_folder_key(entry)
        if not entry_key.startswith(stem_norm):
            continue
        if entry_key == stem_norm:
            continue
        if not (_DLC_TOKEN_RE.search(entry) or 'dlc' in entry_key):
            continue
        found.append({'path': child, 'name': entry, 'extra_kind': 'dlc'})
    return found


def folder_stem(path: str | None) -> str:
    if not path:
        return ''
    return os.path.basename(path.replace('\\', '/').rstrip('/'))


def folder_stem_from_name(name: str) -> str:
    return (name or '').strip()


def iter_pc_extra_roots(
    full_disk_path: str,
    *,
    configured_extras_name: str | None = None,
    configured_updates_name: str | None = None,
    game_name: str | None = None,
    include_sidecars: bool = True,
) -> Iterable[dict]:
    """Yield unique DLC/extra roots for a PC game folder."""
    seen: set[str] = set()
    batches = [
        discover_pc_extra_folders(
            full_disk_path,
            configured_extras_name=configured_extras_name,
            configured_updates_name=configured_updates_name,
        )
    ]
    if include_sidecars:
        batches.append(discover_pc_sidecar_dlc(full_disk_path, game_name=game_name))
    for batch in batches:
        for item in batch:
            key = os.path.normcase(os.path.abspath(item['path']))
            if key in seen:
                continue
            seen.add(key)
            yield item
