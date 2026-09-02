"""Dump propose_leaf_libraries(/storage) grouped by platform (ops diagnostic)."""

from __future__ import annotations

from oneirodex import create_app
from oneirodex.utils.propose_leaf_libraries import propose_leaf_libraries


def main() -> None:
    app = create_app()
    with app.app_context():
        rows = propose_leaf_libraries('/storage')
        by: dict[str, list] = {}
        for r in rows:
            by.setdefault(str(r.get('platform') or '?'), []).append(r)
        print(f'platforms={len(by)} candidates={len(rows)}')
        for plat in sorted(by):
            print(f'== {plat} ({len(by[plat])})')
            for r in by[plat][:5]:
                print(
                    ' ',
                    r.get('suggested_name'),
                    '|',
                    r.get('path'),
                    '|',
                    r.get('scan_mode'),
                    r.get('scan_depth'),
                    '|',
                    (r.get('reason') or '')[:60],
                )
            if len(by[plat]) > 5:
                print('  ...', len(by[plat]) - 5, 'more')


if __name__ == '__main__':
    main()
