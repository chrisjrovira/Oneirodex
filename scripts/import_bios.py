#!/usr/bin/env python3
"""Import operator-supplied BIOS files from a local collection into the volume.

GameTheca never downloads or bundles BIOS. This script does not fetch anything:
it looks through firmware *you already have* and copies the specific files the
libretro cores ask for into the BIOS volume, flattened, under the exact names
the cores look up.

That flattening is the point. `list_bios_files()` reads the top level of the
BIOS root only and skips directories, so a nested collection — a downloaded
BIOS pack, a per-console tree — is invisible to the admin panel no matter how
complete it is.

Preview by default, like the storage helpers and leaf-library proposer; nothing
is written until you pass --apply.

    python scripts/import_bios.py --source E:\\_bios
    python scripts/import_bios.py --source E:\\_bios --apply

The destination is `gametheca/static/library/bios` (gitignored) unless
EMULATOR_BIOS_PATH is set or --dest is given. Firmware stays out of git.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import os
import shutil

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _load_bios_module():
    """Load emulator_bios.py directly, without importing the app package.

    `import gametheca.utils.emulator_bios` runs `gametheca/__init__`, which
    imports config and refuses to load without SECRET_KEY — a real requirement
    for the server and a pointless one for a script that only needs a table of
    filenames. The module itself depends on nothing but flask/werkzeug names it
    does not call at import time, so loading it by path is safe and keeps
    BIOS_REQUIREMENTS a single source of truth.
    """
    path = os.path.join(REPO_ROOT, 'gametheca', 'utils', 'emulator_bios.py')
    spec = importlib.util.spec_from_file_location('_gt_emulator_bios', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


_bios = _load_bios_module()
BIOS_REQUIREMENTS = _bios.BIOS_REQUIREMENTS
BIOS_HARD_REQUIRED_CORES = _bios.BIOS_HARD_REQUIRED_CORES

DEFAULT_DEST = os.path.join(REPO_ROOT, 'gametheca', 'static', 'library', 'bios')


def wanted_names() -> dict[str, str]:
    """Lowercased filename -> canonical name the cores look up."""
    out: dict[str, str] = {}
    for names in BIOS_REQUIREMENTS.values():
        for name in names:
            out.setdefault(name.lower(), name)
    return out


def _digest(path: str) -> str:
    h = hashlib.sha1()
    with open(path, 'rb') as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def scan(source: str, wanted: dict[str, str]) -> dict[str, list[str]]:
    """Every path under *source* whose filename is one a core asks for."""
    found: dict[str, list[str]] = {}
    for dirpath, _dirnames, filenames in os.walk(source):
        for filename in filenames:
            canonical = wanted.get(filename.lower())
            if canonical:
                found.setdefault(canonical, []).append(os.path.join(dirpath, filename))
    return found


def cores_for(name: str) -> list[str]:
    return [core for core, names in BIOS_REQUIREMENTS.items() if name in names]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, help='Folder to search (searched recursively)')
    parser.add_argument('--dest', default=os.environ.get('EMULATOR_BIOS_PATH') or DEFAULT_DEST)
    parser.add_argument('--apply', action='store_true', help='Actually copy (default is preview)')
    parser.add_argument('--overwrite', action='store_true', help='Replace files already present')
    args = parser.parse_args()

    if not os.path.isdir(args.source):
        print(f'Source not found: {args.source}')
        return 1

    wanted = wanted_names()
    print(f'Searching {args.source} for {len(wanted)} known firmware filenames...')
    found = scan(args.source, wanted)

    present = set()
    if os.path.isdir(args.dest):
        present = {n.lower() for n in os.listdir(args.dest)
                   if os.path.isfile(os.path.join(args.dest, n))}

    to_copy: list[tuple[str, str]] = []
    for name in sorted(found):
        sources = found[name]
        already = name.lower() in present
        # Distinct contents under one name is worth saying out loud — regional
        # dumps and bad rips share filenames, and picking silently would make
        # the choice invisible.
        digests = {_digest(p) for p in sources} if len(sources) > 1 else None
        note = ''
        if digests and len(digests) > 1:
            note = f'  [{len(sources)} candidates differ — using the first]'
        elif len(sources) > 1:
            note = f'  [{len(sources)} identical copies]'

        if already and not args.overwrite:
            print(f'  = {name:<24} already present{note}')
            continue
        print(f'  + {name:<24} {sources[0]}{note}')
        to_copy.append((sources[0], os.path.join(args.dest, name)))

    missing = [n for n in sorted(wanted.values()) if n not in found and n.lower() not in present]
    if missing:
        print(f'\nNot found in the source ({len(missing)}):')
        for name in missing:
            cores = cores_for(name)
            hard = any(c in BIOS_HARD_REQUIRED_CORES for c in cores)
            flag = 'blocks play' if hard else 'optional'
            print(f'  - {name:<24} {", ".join(cores)} ({flag})')

    if not to_copy:
        print('\nNothing to copy.')
        return 0

    if not args.apply:
        print(f'\nPreview only — {len(to_copy)} file(s) would be copied to {args.dest}')
        print('Re-run with --apply to write them.')
        return 0

    os.makedirs(args.dest, exist_ok=True)
    for src, dest in to_copy:
        shutil.copy2(src, dest)
    print(f'\nCopied {len(to_copy)} file(s) to {args.dest}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
