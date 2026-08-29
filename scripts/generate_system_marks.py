#!/usr/bin/env python3
"""Generate AI system marks for Systems tiles (platform × theme).

Requires ENABLE_AI_ARTWORK and AI_ARTWORK_URL (SD.Next / A1111).

Examples:

  python scripts/generate_system_marks.py --theme default --platform nes
  python scripts/generate_system_marks.py --all --limit 8
  python scripts/generate_system_marks.py --theme aurora --force
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--theme', action='append', dest='themes', help='Theme slug (repeatable)')
    parser.add_argument('--platform', action='append', dest='platforms', help='Platform id (repeatable)')
    parser.add_argument('--all', action='store_true', help='All themes × all platforms')
    parser.add_argument('--force', action='store_true', help='Overwrite existing marks')
    parser.add_argument('--limit', type=int, default=None, help='Stop after N new generations')
    parser.add_argument(
        '--package-root',
        default=str(ROOT / 'gametheca'),
        help='Package root containing static/ (default: gametheca/)',
    )
    parser.add_argument('--json', action='store_true', help='Print machine-readable summary')
    args = parser.parse_args(argv)

    # Load .env loosely so local review can pick ENABLE_AI_ARTWORK without Flask.
    env_path = ROOT / '.env'
    if env_path.is_file():
        for line in env_path.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, _, value = line.partition('=')
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            os.environ.setdefault(key, value)

    from gametheca.utils.system_marks import generate_system_marks, theme_slugs

    themes = args.themes
    if args.all:
        themes = theme_slugs()
    if not themes:
        themes = ['default']

    result = generate_system_marks(
        themes=themes,
        platforms=args.platforms,
        package_root=args.package_root,
        force=args.force,
        limit=args.limit,
    )

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(
            f"generated={result['generated']} skipped={result['skipped']} "
            f"errors={len(result['errors'])}"
        )
        for err in result['errors'][:20]:
            print(f"  ! {err['theme']}/{err['platform']}: {err['error']}", file=sys.stderr)
    return 1 if result['errors'] and result['generated'] == 0 and result['skipped'] == 0 else 0


if __name__ == '__main__':
    raise SystemExit(main())
