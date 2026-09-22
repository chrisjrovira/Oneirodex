"""Can every system in this library actually be played? (his Human Queue ask)

    "We should run a test for each system that has games in our library can run."

For each platform that holds games, this answers four questions with the
product's own code, not a guess:

1. **What does the product promise?** ``play_mode_for_platform`` — browser,
   companion, or catalogue.
2. **Is the promise backed?** For browser play: is a mapped core actually
   vendored (``WEBRETR_INSTALLED_CORES``)? For companion: is there a core
   mapping at all?
3. **Can a real file be opened?** One game per platform is taken from the
   database and run through ``resolve_playable_rom_path`` — the same call the
   play route makes — so archives that list but cannot decompress (RAR5 with a
   codec-less 7-Zip) are caught here rather than by a member pressing Play.
4. **What is the verdict?** ``ok`` / ``catalogue`` / ``no core`` / the actual
   extraction error.

Read-only: it extracts into a temporary directory and deletes it. Nothing in
the library, the database or the caches is written.

    docker exec oneirodex-app python /app/scripts/ops/playability_report.py
    docker exec oneirodex-app python /app/scripts/ops/playability_report.py --json
    docker exec oneirodex-app python /app/scripts/ops/playability_report.py --platform NEOGEO_CD --samples 3
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


def _rows(session, platform_filter):
    from sqlalchemy import func, select

    from oneirodex.models import Game, Library

    query = (
        select(Library.platform, func.count(Game.id))
        .join(Game, Game.library_uuid == Library.uuid)
        .group_by(Library.platform)
        .order_by(func.count(Game.id).desc())
    )
    out = []
    for platform, count in session.execute(query).all():
        key = getattr(platform, 'name', str(platform))
        if platform_filter and key != platform_filter:
            continue
        out.append((key, int(count)))
    return out


def _samples(session, platform_key, limit):
    from sqlalchemy import select

    from oneirodex.models import Game, Library
    from oneirodex.platform import LibraryPlatform

    query = (
        select(Game.uuid, Game.name, Game.full_disk_path)
        .join(Library, Library.uuid == Game.library_uuid)
        .where(Library.platform == LibraryPlatform[platform_key])
        .where(Game.full_disk_path.isnot(None))
        .order_by(Game.name)
        .limit(limit)
    )
    return session.execute(query).all()


def _check_file(path, platform_key, mode):
    """Open one real file the way the play route does. Returns (verdict, detail).

    ``mode`` matters: the extractor answers the *browser* question. A companion
    title is often a folder of many files, and ``ambiguous_folder`` there is the
    correct answer, not a fault -- the companion launches the folder itself.
    """
    from oneirodex.utils.rom_archive import ArchiveRomError, resolve_playable_rom_path

    if not path:
        return 'no path', ''
    if not os.path.exists(path):
        return 'missing on disk', path
    if mode == 'companion' and os.path.isdir(path):
        entries = len(os.listdir(path)) if os.path.isdir(path) else 0
        return 'ok', f'folder for the companion · {entries} entries'
    started = time.time()
    with tempfile.TemporaryDirectory() as cache:
        try:
            resolved, name = resolve_playable_rom_path(path, cache_dir=cache, platform=platform_key)
        except ArchiveRomError as exc:
            if mode == 'companion' and exc.code in ('ambiguous_folder', 'no_playable_member'):
                return 'ok', f'companion launches this as-is ({exc.code})'
            return f'extract failed ({exc.code})', str(exc)[:120]
        except Exception as exc:  # noqa: BLE001 -- a report never crashes on one file
            return 'error', f'{type(exc).__name__}: {exc}'[:120]
        try:
            size = os.path.getsize(resolved)
        except OSError:
            size = 0
        if size <= 0:
            return 'empty result', name
        return 'ok', f'{name} · {size:,} bytes · {time.time() - started:.1f}s'


def main() -> int:
    parser = argparse.ArgumentParser(description='Per-platform playability report')
    parser.add_argument('--platform', help='only this platform key (e.g. NEOGEO_CD)')
    parser.add_argument('--samples', type=int, default=1, help='files to open per platform (default 1)')
    parser.add_argument('--json', action='store_true', help='machine-readable output')
    parser.add_argument('--no-files', action='store_true', help='skip opening files (promises only)')
    args = parser.parse_args()

    from oneirodex import create_app, db
    from oneirodex.platform import core_is_browser_playable, mapped_core_ids, play_mode_for_platform

    app = create_app()
    report = []
    with app.app_context():
        for platform_key, count in _rows(db.session, args.platform):
            mode = play_mode_for_platform(platform_key)
            cores = mapped_core_ids(platform_key)
            vendored = [c for c in cores if core_is_browser_playable(c)]
            entry = {
                'platform': platform_key,
                'games': count,
                'promise': mode,
                'cores': cores,
                'vendored_cores': vendored,
                'samples': [],
            }
            if mode == 'browser' and not vendored:
                entry['note'] = 'promises browser play but no mapped core is vendored'
            elif mode == 'companion' and not cores:
                entry['note'] = 'companion only, and no core is mapped'
            if not args.no_files and mode != 'catalog':
                for uuid, name, path in _samples(db.session, platform_key, args.samples):
                    verdict, detail = _check_file(path, platform_key, mode)
                    entry['samples'].append({'game': name, 'uuid': uuid, 'verdict': verdict, 'detail': detail})
            report.append(entry)

    if args.json:
        print(json.dumps(report, indent=2))
        return 0

    width = max((len(r['platform']) for r in report), default=8)
    print(f'{"PLATFORM".ljust(width)}  {"GAMES":>6}  {"PROMISE":<10}  VERDICT')
    print('-' * (width + 40))
    bad = 0
    for row in report:
        verdicts = [s['verdict'] for s in row['samples']] or ['(not opened)']
        worst = next((v for v in verdicts if v != 'ok'), verdicts[0])
        if worst not in ('ok', '(not opened)'):
            bad += 1
        note = f"  — {row['note']}" if row.get('note') else ''
        print(f'{row["platform"].ljust(width)}  {row["games"]:>6}  {row["promise"]:<10}  {worst}{note}')
        for sample in row['samples']:
            if sample['verdict'] != 'ok':
                print(f'{" " * width}          ↳ {sample["game"]}: {sample["detail"]}')
    print()
    print(f'{len(report)} platforms with games · {bad} with a file that would not open')
    return 1 if bad else 0


if __name__ == '__main__':
    raise SystemExit(main())
