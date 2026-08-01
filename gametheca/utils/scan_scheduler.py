"""Background poller for scheduled library scans."""

from __future__ import annotations

import threading
import time
from datetime import datetime, timezone

from sqlalchemy import select

_scheduler_started = False
_POLL_SECONDS = 60


def start_scan_scheduler(app):
    """Start a daemon that runs due ScanJobs (idempotent)."""
    global _scheduler_started
    if _scheduler_started:
        return
    _scheduler_started = True

    def _loop():
        while True:
            try:
                with app.app_context():
                    _run_due_jobs(app)
            except Exception as exc:
                print(f"[SCAN SCHEDULER] Error: {exc}")
            time.sleep(_POLL_SECONDS)

    thread = threading.Thread(target=_loop, name='gametheca-scan-scheduler', daemon=True)
    thread.start()
    print('[SCAN SCHEDULER] Started (poll every 60s)')


def _run_due_jobs(app):
    from gametheca import db
    from gametheca.models import ScanJob
    from gametheca.utilities import scan_and_add_games
    from gametheca.utils.scan_queue import drain_scan_queue, is_scan_busy

    # Prefer explicit FIFO Queued requests over recurring Scheduled jobs.
    # Also reclaim stale Stopping/Running so idle+Queued cannot stick forever.
    promoted = drain_scan_queue(app)
    if promoted:
        return

    if is_scan_busy():
        return

    now = datetime.now(timezone.utc)
    jobs = db.session.execute(
        select(ScanJob).filter(
            ScanJob.is_enabled.is_(True),
            ScanJob.status == 'Scheduled',
            ScanJob.next_run.isnot(None),
        )
    ).scalars().all()

    due = []
    for job in jobs:
        next_run = job.next_run
        if next_run is None:
            continue
        if next_run.tzinfo is None:
            next_run = next_run.replace(tzinfo=timezone.utc)
        if next_run <= now:
            due.append(job)

    if not due:
        return

    job = due[0]
    folder = job.scan_folder
    if not folder:
        print(f'[SCAN SCHEDULER] Job {job.id} has no scan_folder; skipping')
        return

    print(f'[SCAN SCHEDULER] Starting due job {job.id} for {folder}')
    scan_mode = 'files' if job.setting_filefolder else 'folders'
    # Mark running so UI reflects immediately; scan_and_add_games will use existing_job
    job.status = 'Running'
    job.last_run = datetime.now(timezone.utc)
    db.session.commit()
    try:
        from gametheca.utils.event_bus import publish_scan_event
        publish_scan_event(job.id, 'Running')
    except Exception:
        pass

    scan_and_add_games(
        folder,
        scan_mode=scan_mode,
        library_uuid=job.library_uuid,
        remove_missing=bool(job.setting_remove),
        existing_job=job,
        download_missing_images=bool(job.setting_download_missing_images),
        force_updates_extras_scan=bool(job.setting_force_updates_extras),
        schedule=job.schedule,
    )
