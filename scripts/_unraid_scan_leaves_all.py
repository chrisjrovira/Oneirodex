"""Create every proposed leaf library under /storage and queue first scans.

Unlike ``_unraid_scan_leaves.py`` (small WANTED set), this walks
``propose_leaf_libraries('/storage')`` and creates each candidate whose path
and name are not already a Library row.

CRITICAL: never call start_or_queue_scan from this short-lived docker-exec
process when it would *start* work — the job is reclaimed as Failed when we
exit. Always insert Queued rows via create_scan_job_row; the live app's
scan_scheduler promotes FIFO.

Run: docker exec -i oneirodex-app python - < scripts/_unraid_scan_leaves_all.py
"""
from __future__ import annotations

from uuid import uuid4

from sqlalchemy import select

from oneirodex import create_app, db
from oneirodex.models import Library, ScanJob
from oneirodex.platform import LibraryPlatform
from oneirodex.utils.propose_leaf_libraries import propose_leaf_libraries
from oneirodex.utils.scan_queue import create_scan_job_row, find_queued_for_library

ROOT = '/storage'


def _norm(path: str) -> str:
    return path.replace('\\', '/').rstrip('/').casefold()


def main() -> None:
    app = create_app()
    with app.app_context():
        existing = db.session.execute(select(Library)).scalars().all()
        existing_paths = {
            _norm(row.last_scan_folder or '')
            for row in existing
            if row.last_scan_folder
        }
        existing_names = {(row.name or '').strip().casefold() for row in existing}
        print(f'existing libraries: {len(existing)}')

        candidates = propose_leaf_libraries(ROOT)
        print(f'propose count: {len(candidates)} auto_create=false')

        created = 0
        queued = 0
        skipped = 0
        for row in candidates:
            plat = str(row.get('platform') or '')
            path = row.get('path') or ''
            name = (row.get('suggested_name') or '').strip()
            if not plat or not path or not name:
                print(f'skip incomplete candidate: {row!r}')
                skipped += 1
                continue
            if _norm(path) in existing_paths:
                print(f'skip {plat}: path already a library ({path})')
                skipped += 1
                continue
            if name.casefold() in existing_names:
                print(f'skip {plat}: name already used ({name})')
                skipped += 1
                continue
            try:
                platform = LibraryPlatform[plat]
            except KeyError:
                print(f'skip {plat}: unknown enum')
                skipped += 1
                continue

            library = Library(
                uuid=str(uuid4()),
                name=name,
                platform=platform,
                scan_depth=int(row.get('scan_depth') or 1),
                last_scan_folder=path,
            )
            db.session.add(library)
            db.session.commit()
            created += 1
            existing_paths.add(_norm(path))
            existing_names.add(name.casefold())

            mode = row.get('scan_mode') or 'folders'
            active = db.session.execute(
                select(ScanJob).filter(
                    ScanJob.library_uuid == library.uuid,
                    ScanJob.status.in_(('Queued', 'Running', 'Stopping')),
                )
            ).scalars().first()
            if active:
                print(
                    f'created {plat} {name!r} uuid={library.uuid} '
                    f'(scan already {active.status})'
                )
                continue
            if find_queued_for_library(library.uuid, path):
                print(
                    f'created {plat} {name!r} uuid={library.uuid} '
                    '(queued coalesce)'
                )
                continue
            job = create_scan_job_row(
                folder_path=path,
                library_uuid=library.uuid,
                scan_mode=mode,
                status='Queued',
            )
            queued += 1
            print(
                f'created {plat} {name!r} uuid={library.uuid} '
                f'mode={mode} Queued job={job.id}'
            )

        print(
            f'done created={created} queued={queued} skipped={skipped} '
            f'total_libraries={len(existing) + created}'
        )


if __name__ == '__main__':
    main()
