"""Admin BIOS / system file management for WebRetro / RetroArch."""

from __future__ import annotations

import os
from typing import Any

from flask import current_app, g, has_request_context
from werkzeug.utils import secure_filename

# Common libretro system files (operators supply legally obtained BIOS).
#
# GameTheca never downloads or bundles BIOS: these files are proprietary console
# firmware. This table only describes what a core *asks for*, so the admin UI can
# say "PS2 needs scph39001.bin — missing" and the operator supplies it from their
# own dump or their own firmware set. See docs/runbooks/emulator-bios.md.
BIOS_REQUIREMENTS: dict[str, list[str]] = {
    'mednafen_psx_hw': ['scph5500.bin', 'scph5501.bin', 'scph5502.bin'],
    'opera': ['panafz1.bin', 'panafz10.bin'],
    'neocd': ['neocd_f.rom', 'neocd_sf.rom', 'neocd_st.rom', 'neocd_z.rom', 'front-sp1.bin'],
    'yabause': ['saturn_bios.bin'],
    'genesis_plus_gx': ['bios_CD_U.bin', 'bios_CD_E.bin', 'bios_CD_J.bin'],
    # Console-gaming leaf systems (2026-08-03).
    'flycast': ['dc_boot.bin', 'dc_flash.bin'],
    'pcsx2': ['scph39001.bin', 'scph70012.bin'],
    'melonds': ['bios7.bin', 'bios9.bin', 'firmware.bin'],
    'mgba': ['gba_bios.bin'],
    'handy': ['lynxboot.img'],
    'gearcoleco': ['colecovision.rom'],
    'freeintv': ['exec.bin', 'grom.bin'],
    'o2em': ['o2rom.bin'],
    'mednafen_pce': ['syscard3.pce'],
    'mednafen_pce_fast': ['syscard3.pce'],
    'mednafen_supergrafx': ['syscard3.pce'],
    'puae': ['kick34005.A500', 'kick40068.A1200', 'kick33180.A500'],
    'cap32': ['cpc6128.rom'],
    'prosystem': ['7800 BIOS (U).rom'],
}

# Which of the above a core genuinely cannot boot without. Everything else is an
# optional accuracy/enhancement file, so the UI does not cry wolf about e.g.
# gba_bios.bin, which mGBA happily runs without via its HLE fallback.
BIOS_HARD_REQUIRED_CORES = frozenset({
    'mednafen_psx_hw', 'opera', 'neocd', 'yabause', 'flycast', 'pcsx2',
    'melonds', 'mednafen_pce', 'mednafen_pce_fast', 'mednafen_supergrafx',
    'puae', 'freeintv', 'o2em', 'gearcoleco',
})


def bios_status_for_platforms() -> list[dict[str, Any]]:
    """Per-system BIOS readiness for the admin firmware panel.

    Answers the operator question directly — "which of my systems can actually
    play?" — instead of making them map libretro core ids to consoles by hand.

    Readiness is judged on *loadable* files only, the same rule
    bios_status_for_cores follows. Both views read one list, so counting a
    nested file here would have this panel call a system ready while the core
    panel called the same file misplaced.
    """
    from gametheca.platform import LibraryPlatform, platform_emulator_mapping

    files = list_bios_files()
    present = {row['name'].lower() for row in files if row['loadable']}
    nested = {
        row['name'].lower(): row['subdir'] for row in files if not row['loadable']
    }
    rows: list[dict[str, Any]] = []
    for platform, cores in platform_emulator_mapping.items():
        core_ids = [c.value for c in cores]
        needed = {
            name
            for core in core_ids
            for name in BIOS_REQUIREMENTS.get(core, [])
        }
        if not needed:
            continue
        missing = sorted(n for n in needed if n.lower() not in present)
        found = sorted(n for n in needed if n.lower() in present)
        # Named separately so the panel can say "move these" rather than
        # "missing" for a file the operator can plainly see on disk.
        misplaced = [
            {'name': name, 'subdir': nested[name.lower()]}
            for name in sorted(needed)
            if name.lower() in nested and name.lower() not in present
        ]
        hard = any(core in BIOS_HARD_REQUIRED_CORES for core in core_ids)
        rows.append({
            'platform': platform.name,
            'label': platform.value,
            'cores': core_ids,
            'required': sorted(needed),
            'present': found,
            'missing': missing,
            'misplaced': misplaced,
            # Any one accepted file is usually enough (region variants).
            'ready': bool(found),
            'blocking': bool(missing) and not found and hard,
        })
    rows.sort(key=lambda r: (not r['blocking'], r['label']))
    return rows


def bios_root() -> str:
    root = current_app.config.get('EMULATOR_BIOS_PATH')
    if root:
        return root
    return os.path.join(current_app.root_path, 'static', 'library', 'bios')


def list_bios_files() -> list[dict[str, Any]]:
    """Every BIOS file under the firmware volume, including subdirectories.

    This used to be a flat ``os.listdir`` that skipped directories, so a
    firmware set organised the way they almost always ship — ``bios/psx/``,
    ``bios/saturn/`` — was invisible. The operator saw "no BIOS loaded" having
    just copied a hundred files in, with nothing explaining why.

    Subdirectories are walked so those files are *found*, but each row carries
    ``subdir`` because being found is not the same as being usable: libretro
    cores look for firmware in the system root only. A file one level down is
    present on disk and still will not load, and the UI has to be able to say
    so rather than silently listing it as ready.
    """
    if has_request_context() and hasattr(g, '_bios_files_cache'):
        return g._bios_files_cache

    root = bios_root()
    os.makedirs(root, exist_ok=True)
    rows = []
    for dirpath, _dirs, files in os.walk(root):
        rel = os.path.relpath(dirpath, root)
        subdir = '' if rel == '.' else rel.replace(os.sep, '/')
        for name in sorted(files):
            path = os.path.join(dirpath, name)
            if not os.path.isfile(path):
                continue
            rows.append({
                'name': name,
                'size': os.path.getsize(path),
                'subdir': subdir,
                # Cores read the system root; anything nested needs moving.
                'loadable': subdir == '',
            })

    rows.sort(key=lambda row: (row['subdir'], row['name'].lower()))

    if has_request_context():
        g._bios_files_cache = rows
    return rows


def bios_status_for_cores() -> list[dict[str, Any]]:
    """Per-core readiness, distinguishing "absent" from "present but misplaced".

    Those are different problems with different fixes — download it, versus move
    it up a directory — and reporting both as "missing" is what made a populated
    firmware volume look empty.
    """
    files = list_bios_files()
    loadable = {row['name'].lower() for row in files if row['loadable']}
    misplaced = {
        row['name'].lower(): row['subdir'] for row in files if not row['loadable']
    }

    status = []
    for core, required in BIOS_REQUIREMENTS.items():
        found = [name for name in required if name.lower() in loadable]
        nested = [
            {'name': name, 'subdir': misplaced[name.lower()]}
            for name in required
            if name.lower() in misplaced and name.lower() not in loadable
        ]
        status.append({
            'core': core,
            'required': required,
            'present': found,
            'ready': len(found) > 0,
            # Named separately so the UI can say "move these" rather than
            # "missing" for a file the operator can plainly see on disk.
            'misplaced': nested,
        })
    return status


# Firmware is operator-supplied and lands on a mounted volume, so the upload
# path is treated as untrusted input: allowlist the shapes a libretro core can
# actually consume rather than accepting anything with a safe-looking name.
ALLOWED_BIOS_EXTENSIONS = frozenset({
    '.bin', '.rom', '.img', '.bios', '.sys', '.dat', '.zip',
    # PC Engine CD system card, and the Amiga Kickstart names puae expects
    # (`kick34005.A500`). Anything listed in BIOS_REQUIREMENTS has to be
    # uploadable, or the panel reports a missing file the operator cannot supply.
    '.pce', '.a500', '.a600', '.a1200', '.a4000',
})

# Retro system files are small; the cap exists to stop a mistaken ROM-set or
# disk-image upload filling the BIOS volume. Override with EMULATOR_BIOS_MAX_BYTES.
DEFAULT_BIOS_MAX_BYTES = 64 * 1024 * 1024


def _max_bios_bytes() -> int:
    try:
        value = int(current_app.config.get('EMULATOR_BIOS_MAX_BYTES') or 0)
    except (TypeError, ValueError):
        value = 0
    return value if value > 0 else DEFAULT_BIOS_MAX_BYTES


def _upload_size(file_storage) -> int:
    """Byte length of an upload without reading it into memory."""
    stream = getattr(file_storage, 'stream', None)
    if stream is None or not hasattr(stream, 'seek') or not hasattr(stream, 'tell'):
        return 0
    try:
        current = stream.tell()
        stream.seek(0, os.SEEK_END)
        size = stream.tell()
        stream.seek(current)
        return int(size)
    except (OSError, ValueError):
        return 0


def store_bios_file(file_storage) -> dict[str, Any]:
    """Persist one operator-supplied firmware file to the BIOS volume.

    BIOS/firmware is never bundled or downloaded by GameTheca — it is uploaded
    by the operator from media they own. This function is the only write path,
    so validation lives here rather than at the route.

    Raises ValueError with a user-safe message on every rejection.
    """
    root = bios_root()
    os.makedirs(root, exist_ok=True)

    original = secure_filename(getattr(file_storage, 'filename', None) or '')
    if not original:
        raise ValueError('Filename required')

    extension = os.path.splitext(original)[1].lower()
    if extension not in ALLOWED_BIOS_EXTENSIONS:
        allowed = ', '.join(sorted(ALLOWED_BIOS_EXTENSIONS))
        raise ValueError(f'Unsupported firmware file type "{extension or "none"}". Allowed: {allowed}')

    size = _upload_size(file_storage)
    limit = _max_bios_bytes()
    if size > limit:
        raise ValueError(
            f'Firmware file is {size // (1024 * 1024)}MB; limit is {limit // (1024 * 1024)}MB'
        )
    if size == 0:
        raise ValueError('Firmware file is empty')

    dest = os.path.join(root, original)
    # Defence in depth: secure_filename already strips separators, but the
    # destination must provably stay inside the BIOS volume before we write.
    if os.path.commonpath([os.path.realpath(root), os.path.realpath(dest)]) != os.path.realpath(root):
        raise ValueError('Invalid destination path')

    file_storage.save(dest)
    return {'name': original, 'size': os.path.getsize(dest)}
