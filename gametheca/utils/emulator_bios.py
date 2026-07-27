"""Admin BIOS / system file management for WebRetro / RetroArch."""

from __future__ import annotations

import os
from typing import Any

from flask import current_app, g, has_request_context
from werkzeug.utils import secure_filename

# Common libretro system files (operators supply legally obtained BIOS).
BIOS_REQUIREMENTS: dict[str, list[str]] = {
    'mednafen_psx_hw': ['scph5500.bin', 'scph5501.bin', 'scph5502.bin'],
    'opera': ['panafz1.bin', 'panafz10.bin'],
    'neocd': ['neocd_f.rom', 'neocd_sf.rom', 'neocd_st.rom', 'neocd_z.rom', 'front-sp1.bin'],
    'yabause': ['saturn_bios.bin'],
    'genesis_plus_gx': ['bios_CD_U.bin', 'bios_CD_E.bin', 'bios_CD_J.bin'],
}


def bios_root() -> str:
    root = current_app.config.get('EMULATOR_BIOS_PATH')
    if root:
        return root
    return os.path.join(current_app.root_path, 'static', 'library', 'bios')


def list_bios_files() -> list[dict[str, Any]]:
    if has_request_context() and hasattr(g, '_bios_files_cache'):
        return g._bios_files_cache

    root = bios_root()
    os.makedirs(root, exist_ok=True)
    rows = []
    for name in sorted(os.listdir(root)):
        path = os.path.join(root, name)
        if not os.path.isfile(path):
            continue
        rows.append({
            'name': name,
            'size': os.path.getsize(path),
        })

    if has_request_context():
        g._bios_files_cache = rows
    return rows


def bios_status_for_cores() -> list[dict[str, Any]]:
    present = {row['name'].lower() for row in list_bios_files()}
    status = []
    for core, required in BIOS_REQUIREMENTS.items():
        found = [name for name in required if name.lower() in present]
        status.append({
            'core': core,
            'required': required,
            'present': found,
            'ready': len(found) > 0,
        })
    return status


def store_bios_file(file_storage) -> dict[str, Any]:
    root = bios_root()
    os.makedirs(root, exist_ok=True)
    original = secure_filename(getattr(file_storage, 'filename', None) or '')
    if not original:
        raise ValueError('Filename required')
    dest = os.path.join(root, original)
    file_storage.save(dest)
    return {'name': original, 'size': os.path.getsize(dest)}
