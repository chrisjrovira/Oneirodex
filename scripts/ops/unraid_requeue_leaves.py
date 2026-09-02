"""Ensure each household leaf has a Queued ScanJob after app recreate.

Never starts a scan in this short-lived process — that marks the job Failed when
we exit. Insert Queued rows only; the live app's scan_scheduler drains FIFO.
"""
from __future__ import annotations

from sqlalchemy import select

from oneirodex import create_app, db
from oneirodex.models import Library, ScanJob
from oneirodex.utils.scan_queue import create_scan_job_row, find_queued_for_library

LEAVES = ('NES', 'SNES', 'GB', 'GBC', 'GBA', 'PCE')


def _mode_for(plat: str, folder: str) -> str:
    if plat in ('GB', 'GBC', 'GBA', 'PCE'):
        return 'files'
    return 'folders'


def main() -> None:
    app = create_app()
    with app.app_context():
        libs = {
            lib.platform.name: lib
            for lib in db.session.execute(select(Library)).scalars().all()
            if lib.platform is not None
        }
        for plat in LEAVES:
            lib = libs.get(plat)
            if not lib or not lib.last_scan_folder:
                print(f'skip {plat}: no library/folder')
                continue
            folder = lib.last_scan_folder
            active = db.session.execute(
                select(ScanJob).filter(
                    ScanJob.library_uuid == lib.uuid,
                    ScanJob.status.in_(('Queued', 'Running', 'Stopping')),
                )
            ).scalars().first()
            if active:
                print(f'{plat} already {active.status} job={active.id}')
                continue
            existing_q = find_queued_for_library(lib.uuid, folder)
            if existing_q:
                print(f'{plat} coalesced Queued job={existing_q.id}')
                continue
            mode = _mode_for(plat, folder)
            job = create_scan_job_row(
                folder_path=folder,
                library_uuid=lib.uuid,
                scan_mode=mode,
                status='Queued',
            )
            print(f'{plat} Queued job={job.id} mode={mode}')
        print('done — live scan_scheduler will promote FIFO (do not start here)')


if __name__ == '__main__':
    main()
