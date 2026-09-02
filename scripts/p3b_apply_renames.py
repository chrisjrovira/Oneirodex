#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""P3b mechanical renames: oneirodex->oneirodex and gt-->od- identifier prefix.

Run on the Unraid host (preferably via docker python:3.12-slim).
Safe identifier replace: (?<![A-Za-z0-9_])gt-(?=[A-Za-z]) -> od-
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SKIP_DIR_NAMES = {
    '.git',
    'node_modules',
    'dist',
    '__pycache__',
    '.venv',
    'venv',
    '.pytest_cache',
    '.mypy_cache',
    'coverage',
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
    '.example', '.env', '.svg', '.xml', '.csv', '.dockerfile',
}

SPECIAL_NAMES = {
    'Dockerfile', 'Dockerfile.review', 'entrypoint.sh',
    'startweb.sh', 'startweb-docker.sh', 'startweb_windows.cmd',
    'VERSION', 'LICENSE', 'CHANGELOG.md', 'README.md', 'NAS-DEPLOY.md',
    '.dockerignore', '.gitignore', '.cbignore', '.gitattributes',
    'pytest.ini', 'conftest.py', 'asgi.py', 'config.py', 'product_env.py',
}

GT_IDENT = re.compile(r'(?<![A-Za-z0-9_])gt-(?=[A-Za-z])')

PACKAGE_REPLACEMENTS = [
    (re.compile(r'Oneirodex'), 'Oneirodex'),
    (re.compile(r'ONEIRODEX'), 'ONEIRODEX'),
    (re.compile(r'oneirodextest'), 'oneirodextest'),
    (re.compile(r'oneirodex'), 'oneirodex'),
]


def should_skip_dir(name: str) -> bool:
    return name in SKIP_DIR_NAMES or name.endswith('.egg-info')


def is_text_file(path: Path) -> bool:
    if path.name in SPECIAL_NAMES or path.name.startswith('.env'):
        return True
    if path.suffix.lower() in SKIP_SUFFIXES:
        return False
    if path.suffix.lower() in TEXT_SUFFIXES:
        return True
    if path.suffix == '' and path.parent.name in {'scripts', 'docker'}:
        return True
    return False


def transform_text(text: str) -> str:
    text = text.replace(
        '/* P3b: --od-* is canonical. */',
        '/* P3b: --od-* is canonical. */',
    )
    text = re.sub(
        r'^[ \t]*--od-[a-z0-9-]+:\s*var\(--gt-[a-z0-9-]+\);\s*\n',
        '',
        text,
        flags=re.MULTILINE,
    )
    for pattern, repl in PACKAGE_REPLACEMENTS:
        text = pattern.sub(repl, text)
    text = GT_IDENT.sub('od-', text)
    return text


def rename_package_dir() -> None:
    old = ROOT / 'oneirodex'
    new = ROOT / 'oneirodex'
    if new.exists() and old.exists():
        raise SystemExit('both oneirodex/ and oneirodex/ exist - resolve manually')
    if old.exists() and not new.exists():
        print('renaming %s -> %s' % (old, new))
        old.rename(new)
    elif new.exists():
        print('package dir already oneirodex/')
    else:
        raise SystemExit('neither oneirodex/ nor oneirodex/ found')


def rename_prefixed_files() -> int:
    moved = 0
    for path in list(ROOT.rglob('*')):
        if not path.is_file():
            continue
        if any(should_skip_dir(p) for p in path.parts):
            continue
        name = path.name
        new_name = None
        if name.startswith('gt-') and name.endswith(('.css', '.js', '.mjs')):
            new_name = 'od-' + name[3:]
        elif name.startswith('gt_') and name.endswith(('.js', '.mjs')):
            new_name = 'od_' + name[3:]
        if not new_name or new_name == name:
            continue
        dest = path.with_name(new_name)
        if dest.exists():
            print('skip rename (exists): %s' % path)
            continue
        print('rename file %s -> %s' % (path.relative_to(ROOT), new_name))
        path.rename(dest)
        moved += 1
    return moved


def rewrite_files() -> tuple:
    changed = 0
    scanned = 0
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if not should_skip_dir(d)]
        rel = Path(dirpath).relative_to(ROOT)
        if 'node_modules' in rel.parts or '.git' in rel.parts:
            continue
        if 'static' in rel.parts and 'library' in rel.parts:
            if 'themes' not in rel.parts and 'system-marks' not in rel.parts:
                continue
        for filename in filenames:
            path = Path(dirpath) / filename
            if not is_text_file(path):
                continue
            if 'static' in path.parts and 'dist' in path.parts:
                continue
            scanned += 1
            try:
                raw = path.read_text(encoding='utf-8')
            except (UnicodeDecodeError, OSError):
                continue
            new = transform_text(raw)
            if new != raw:
                path.write_text(new, encoding='utf-8', newline='\n')
                changed += 1
                print('updated %s' % path.relative_to(ROOT))
    return scanned, changed


def main() -> int:
    print('P3b mechanical rename already applied 2026-08-31. Do not re-run.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
