#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""P3b leftover: camelCase odFoo identifiers -> odFoo.

The first pass only rewrote hyphen prefixes (gt-shell -> od-shell). IDs like
odLibrariesPanel and odScanFilterForm were left behind.
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAMEL = re.compile(r'(?<![A-Za-z0-9_])gt([A-Z])')
DUNDER = re.compile(r'__od')

SKIP_DIR_NAMES = {
    '.git',
    '.claude',
    'node_modules',
    'dist',
    '__pycache__',
    '.venv',
    'venv',
    '.pytest_cache',
    '.mypy_cache',
    'coverage',
    'cores',
}

SKIP_SUFFIXES = {
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico',
    '.woff', '.woff2', '.ttf', '.eot',
    '.mp4', '.webm', '.pdf', '.zip', '.7z', '.gz', '.bz2', '.xz',
    '.pyc', '.pyo', '.so', '.dll', '.exe', '.bin', '.sqlite', '.db',
}

TEXT_SUFFIXES = {
    '.py', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
    '.css', '.html', '.htm', '.md', '.yml', '.yaml', '.json',
    '.toml', '.ini', '.cfg', '.txt', '.sh', '.bash', '.ps1', '.cmd',
    '.example', '.env', '.svg', '.xml', '.csv',
}


def should_skip_dir(name: str) -> bool:
    return name in SKIP_DIR_NAMES or name.endswith('.egg-info')


def is_text_file(path: Path) -> bool:
    if path.suffix.lower() in SKIP_SUFFIXES:
        return False
    if path.suffix.lower() in TEXT_SUFFIXES:
        return True
    if path.name.startswith('.env') or path.name in {
        'Dockerfile', 'entrypoint.sh', 'startweb.sh', 'startweb-docker.sh',
    }:
        return True
    return False


def rewrite_files(dry_run: bool) -> tuple[int, int]:
    scanned = 0
    changed = 0
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if not should_skip_dir(d)]
        rel = Path(dirpath).relative_to(ROOT)
        if 'node_modules' in rel.parts or '.git' in rel.parts or '.claude' in rel.parts:
            continue
        if 'static' in rel.parts and 'vendor' in rel.parts and 'webretro' in rel.parts:
            if 'cores' in rel.parts:
                continue
        if 'static' in rel.parts and 'library' in rel.parts:
            if 'themes' not in rel.parts and 'system-marks' not in rel.parts:
                continue
        for filename in filenames:
            path = Path(dirpath) / filename
            if not is_text_file(path):
                continue
            scanned += 1
            try:
                raw = path.read_text(encoding='utf-8')
            except (UnicodeDecodeError, OSError):
                continue
            new = CAMEL.sub(r'od\1', raw)
            new = DUNDER.sub('__od', new)
            if new == raw:
                continue
            changed += 1
            print('updated %s' % path.relative_to(ROOT))
            if not dry_run:
                path.write_text(new, encoding='utf-8', newline='\n')
    return scanned, changed


def rename_brand_files() -> None:
    moves = [
        (
            ROOT / 'oneirodex' / 'static' / 'newstyle' / 'gametheca_mark.svg',
            ROOT / 'oneirodex' / 'static' / 'newstyle' / 'oneirodex_mark.svg',
        ),
        (
            ROOT / 'oneirodex' / 'static' / 'newstyle' / 'gametheca_glyph.svg',
            ROOT / 'oneirodex' / 'static' / 'newstyle' / 'oneirodex_glyph.svg',
        ),
        (
            ROOT / 'docs' / 'assets' / 'readme' / 'gametheca_mark.svg',
            ROOT / 'docs' / 'assets' / 'readme' / 'oneirodex_mark.svg',
        ),
        (
            ROOT / 'frontend' / 'api-client' / 'src' / 'gametheca-client.ts',
            ROOT / 'frontend' / 'api-client' / 'src' / 'oneirodex-client.ts',
        ),
        (
            ROOT / 'frontend' / 'admin-app' / 'src' / 'odSortableTable.test.js',
            ROOT / 'frontend' / 'admin-app' / 'src' / 'odSortableTable.test.js',
        ),
    ]
    for src, dest in moves:
        if dest.exists() and src.exists():
            print('skip (both exist): %s' % src.relative_to(ROOT))
            continue
        if src.exists() and not dest.exists():
            print('rename %s -> %s' % (src.relative_to(ROOT), dest.name))
            src.rename(dest)
        elif dest.exists():
            print('already named %s' % dest.relative_to(ROOT))
        else:
            print('missing %s' % src.relative_to(ROOT))


def main() -> int:
    print('P3b camelCase pass already applied 2026-08-31. Do not re-run.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
