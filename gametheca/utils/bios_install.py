"""Import emulator firmware from an operator-supplied folder.

``scripts/import_bios.py`` has always known how to find firmware in a local
collection and copy the files the cores ask for. Nothing called it from the
application, so an operator with a populated folder still saw an Emulators page
reporting no firmware — "bios we push for my local repo dont show as loaded or
on the system".

This is the importable half, so first boot can top up firmware when
``BIOS_IMPORT_SOURCE`` names a folder, and the script stays the interactive path
with its preview, overwrite flag and conflict reporting.

Deliberately conservative: existing files are never replaced. That makes it safe
to run on every boot — it fills gaps and leaves anything already installed, and
firmware an operator has deliberately swapped stays swapped.
"""

from __future__ import annotations

import os
import shutil


def wanted_firmware_names() -> dict[str, str]:
    """Lowercased filename -> canonical name a core looks up."""
    from gametheca.utils.emulator_bios import BIOS_REQUIREMENTS

    out: dict[str, str] = {}
    for names in BIOS_REQUIREMENTS.values():
        for name in names:
            out.setdefault(name.lower(), name)
    return out


def scan_for_firmware(source: str, wanted: dict[str, str] | None = None) -> dict[str, list[str]]:
    """Every path under *source* whose filename is one a core asks for.

    Walks subdirectories: collections arrive organised per system, and the flat
    listing that missed them is the same bug the BIOS *discovery* fix addressed
    on the serving side.
    """
    names = wanted if wanted is not None else wanted_firmware_names()
    found: dict[str, list[str]] = {}
    for dirpath, _dirnames, filenames in os.walk(source):
        for filename in filenames:
            canonical = names.get(filename.lower())
            if canonical:
                found.setdefault(canonical, []).append(os.path.join(dirpath, filename))
    return found


def import_bios_from(source: str, dest: str | None = None) -> int:
    """Copy missing firmware from *source* into the BIOS root. Returns count.

    When several files under *source* share a firmware name, the first the walk
    reaches wins. The script's `_choose_source` does better — it prefers the copy
    the most packs agree on and *reports* the disagreement — but that is a
    judgement worth showing an operator rather than making silently at boot. A
    boot import fills obvious gaps; resolving a conflict stays interactive.
    """
    if dest is None:
        from gametheca.utils.emulator_bios import bios_root

        dest = bios_root()

    os.makedirs(dest, exist_ok=True)
    present = {
        name.lower()
        for name in os.listdir(dest)
        if os.path.isfile(os.path.join(dest, name))
    }

    copied = 0
    for canonical, sources in sorted(scan_for_firmware(source).items()):
        if canonical.lower() in present:
            continue
        try:
            shutil.copy2(sources[0], os.path.join(dest, canonical))
            copied += 1
        except OSError:
            # One unreadable file should not abandon the rest of the import.
            continue

    return copied
