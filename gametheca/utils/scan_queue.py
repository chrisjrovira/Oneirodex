"""Scan job queue vs force-parallel start policy.

Default policy when a scan is already Running/Stopping: **queue** (FIFO).
Admin may opt in to **force parallel** — starts alongside the running job,
still subject to per-job ``scan_thread_count`` / ``worker_caps``.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from threading import Thread

from flask import current_app
from sqlalchemy import func, select, update
from sqlalchemy.exc import SQLAlchemyError

from gametheca import db
from gametheca.models import ScanJob

FORCE_PARALLEL_RISK = (
    'Force parallel starts a second library scan while another is still '
    'Running/Stopping. On shared NAS/Unraid hosts this can spike CPU and '
    'freeze the UI. Each job still respects scan_thread_count / worker_caps.'
)

QUEUE_DEFAULT_MESSAGE = (
    'A scan is already running. This request was queued and will start '
    'when the current job finishes (FIFO).'
)

COALESCE_MESSAGE = (
    'A scan for this library folder is already queued. Reusing the existing '
    'Queued job instead of creating another (coalesced).'
)

# Stopping should finish quickly; Running without progress is likely orphaned.
STALE_STOPPING_SECONDS = 10 * 60
STALE_RUNNING_SECONDS = 6 * 60 * 60


def parse_force_parallel(raw) -> bool:
    """Truthy parse for form/JSON/query ``force_parallel`` flag."""
    if raw is True:
        return True
    if raw is False or raw is None:
        return False
    text = str(raw).strip().lower()
    return text in ('1', 'true', 'yes', 'on')


def parse_queue_policy(raw, force_parallel=None) -> str:
    """Return ``queue`` (default) or ``force``.

    Accepts explicit ``queue_policy`` or legacy ``force_parallel`` flag.
    """
    if force_parallel is True or parse_force_parallel(force_parallel):
        return 'force'
    if raw is None:
        return 'queue'
    text = str(raw).strip().lower()
    if text in ('force', 'force_parallel', 'parallel', 'concurrent'):
        return 'force'
    return 'queue'


def _norm_folder(path: str | None) -> str:
    if not path:
        return ''
    try:
        return os.path.normcase(os.path.normpath(str(path).strip()))
    except Exception:
        return str(path).strip().lower()


def is_scan_busy() -> bool:
    """True when a job is Running or Stopping (default queue gate)."""
    busy = db.session.execute(
        select(ScanJob.id).where(ScanJob.status.in_(('Running', 'Stopping'))).limit(1)
    ).first()
    return busy is not None


def count_queued_jobs() -> int:
    return int(
        db.session.execute(
            select(func.count(ScanJob.id)).where(ScanJob.status == 'Queued')
        ).scalar()
        or 0
    )


def list_queued_jobs():
    """FIFO Queued jobs (oldest request first)."""
    return db.session.execute(
        select(ScanJob)
        .where(ScanJob.status == 'Queued')
        .order_by(ScanJob.last_run.asc().nullsfirst(), ScanJob.id.asc())
    ).scalars().all()


def queue_position(job_id: str) -> int | None:
    """1-based FIFO position among Queued jobs, or None if not queued."""
    for idx, job in enumerate(list_queued_jobs(), start=1):
        if job.id == job_id:
            return idx
    return None


def find_queued_for_library(library_uuid: str, folder_path: str) -> ScanJob | None:
    """Return an existing Queued job for the same library root, if any."""
    folder_n = _norm_folder(folder_path)
    rows = db.session.execute(
        select(ScanJob)
        .where(
            ScanJob.library_uuid == library_uuid,
            ScanJob.status == 'Queued',
        )
        .order_by(ScanJob.last_run.asc().nullsfirst(), ScanJob.id.asc())
    ).scalars().all()
    for row in rows:
        if _norm_folder(row.scan_folder) == folder_n:
            return row
    return None


def create_scan_job_row(
    *,
    folder_path: str,
    library_uuid: str,
    scan_mode: str = 'folders',
    remove_missing: bool = False,
    download_missing_images: bool = False,
    force_updates_extras_scan: bool = False,
    schedule=None,
    status: str = 'Queued',
) -> ScanJob:
    """Persist a ScanJob row without starting work."""
    now = datetime.now(timezone.utc)
    job = ScanJob(
        folders={folder_path: True},
        content_type='Games',
        status=status,
        is_enabled=True,
        last_run=now,
        library_uuid=library_uuid,
        error_message='',
        total_folders=0,
        folders_success=0,
        folders_failed=0,
        removed_count=0,
        scan_folder=folder_path,
        setting_remove=bool(remove_missing),
        setting_filefolder=(scan_mode == 'files'),
        setting_download_missing_images=bool(download_missing_images),
        setting_force_updates_extras=bool(force_updates_extras_scan),
        schedule=schedule if schedule in ('8_hours', '24_hours', '48_hours') else None,
    )
    db.session.add(job)
    db.session.commit()
    return job


def _start_job_thread(job: ScanJob, app, *, force_parallel: bool = False):
    """Spawn daemon thread that runs ``scan_and_add_games`` for an existing job."""
    from gametheca.utilities import scan_and_add_games

    job_id = job.id
    folder = job.scan_folder
    library_uuid = job.library_uuid
    scan_mode = 'files' if job.setting_filefolder else 'folders'
    remove_missing = bool(job.setting_remove)
    download_missing_images = bool(job.setting_download_missing_images)
    force_updates_extras = bool(job.setting_force_updates_extras)
    schedule = job.schedule

    def _run():
        with app.app_context():
            existing = db.session.get(ScanJob, job_id)
            if not existing:
                return
            scan_and_add_games(
                folder,
                scan_mode=scan_mode,
                library_uuid=library_uuid,
                remove_missing=remove_missing,
                existing_job=existing,
                download_missing_images=download_missing_images,
                force_updates_extras_scan=force_updates_extras,
                schedule=schedule,
                force_parallel=force_parallel,
            )

    Thread(target=_run, daemon=True, name=f'gametheca-scan-{job_id[:8]}').start()


def start_or_queue_scan(
    *,
    folder_path: str,
    library_uuid: str,
    scan_mode: str = 'folders',
    remove_missing: bool = False,
    download_missing_images: bool = False,
    force_updates_extras_scan: bool = False,
    fetch_hltb: bool = False,
    force_hltb_refetch: bool = False,
    schedule=None,
    queue_policy: str = 'queue',
    allow_force: bool = False,
    app=None,
) -> dict:
    """Accept a scan request: start now, queue, force-parallel, or reject.

    Returns ``{status, job_id?, position?, message}`` where status is
    ``started`` | ``queued`` | ``rejected``.
    """
    policy = parse_queue_policy(queue_policy)
    force = policy == 'force'
    if force and not allow_force:
        return {
            'status': 'rejected',
            'job_id': None,
            'position': None,
            'message': (
                'force_parallel / queue_policy=force requires an admin session. '
                'Default policy queues the scan instead.'
            ),
        }

    flask_app = app or current_app._get_current_object()
    busy = is_scan_busy()

    if busy and not force:
        existing_queued = find_queued_for_library(library_uuid, folder_path)
        if existing_queued:
            position = queue_position(existing_queued.id) or 1
            return {
                'status': 'queued',
                'job_id': existing_queued.id,
                'position': position,
                'coalesced': True,
                'message': f'{COALESCE_MESSAGE} Position {position}.',
            }
        job = create_scan_job_row(
            folder_path=folder_path,
            library_uuid=library_uuid,
            scan_mode=scan_mode,
            remove_missing=remove_missing,
            download_missing_images=download_missing_images,
            force_updates_extras_scan=force_updates_extras_scan,
            schedule=schedule,
            status='Queued',
        )
        position = queue_position(job.id) or count_queued_jobs()
        return {
            'status': 'queued',
            'job_id': job.id,
            'position': position,
            'message': f'{QUEUE_DEFAULT_MESSAGE} Position {position}.',
        }

    # Start immediately (idle, or admin force parallel).
    job = create_scan_job_row(
        folder_path=folder_path,
        library_uuid=library_uuid,
        scan_mode=scan_mode,
        remove_missing=remove_missing,
        download_missing_images=download_missing_images,
        force_updates_extras_scan=force_updates_extras_scan,
        schedule=schedule,
        status='Running',
    )

    # is_scan_busy() above is not atomic with this insert: a concurrent starter
    # (second click, or the scheduler poll) can pass the same check and both go
    # Running, silently defeating the queue policy. Re-check now that our row is
    # visible and yield to the older job — same rollback the promote path does.
    if not force:
        other_busy = db.session.execute(
            select(ScanJob.id).where(
                ScanJob.status.in_(('Running', 'Stopping')),
                ScanJob.id != job.id,
            ).limit(1)
        ).first()
        if other_busy:
            job.status = 'Queued'
            try:
                db.session.commit()
            except SQLAlchemyError:
                db.session.rollback()
            else:
                position = queue_position(job.id) or count_queued_jobs()
                return {
                    'status': 'queued',
                    'job_id': job.id,
                    'position': position,
                    'message': f'{QUEUE_DEFAULT_MESSAGE} Position {position}.',
                }

    try:
        from gametheca.utils.event_bus import publish_scan_event
        publish_scan_event(job.id, 'Running')
    except Exception:
        pass

    # HLTB flags are request-scoped for the worker thread (not ScanJob columns).
    job_id = job.id

    def _run_with_hltb():
        with flask_app.app_context():
            from gametheca.utilities import scan_and_add_games

            existing = db.session.get(ScanJob, job_id)
            if not existing:
                return
            scan_and_add_games(
                folder_path,
                scan_mode=scan_mode,
                library_uuid=library_uuid,
                remove_missing=remove_missing,
                existing_job=existing,
                download_missing_images=download_missing_images,
                force_updates_extras_scan=force_updates_extras_scan,
                fetch_hltb=fetch_hltb,
                force_hltb_refetch=force_hltb_refetch,
                schedule=schedule,
                force_parallel=force,
            )

    Thread(
        target=_run_with_hltb,
        daemon=True,
        name=f'gametheca-scan-{job_id[:8]}',
    ).start()

    if force and busy:
        message = (
            f'Scan started in parallel with a running job (job {job.id[:8]}…). '
            f'{FORCE_PARALLEL_RISK}'
        )
    else:
        message = f'Scan started (job {job.id[:8]}…).'

    return {
        'status': 'started',
        'job_id': job.id,
        'position': None,
        'message': message,
    }


def reclaim_stale_busy_jobs(
    *,
    stopping_after_seconds: int = STALE_STOPPING_SECONDS,
    running_after_seconds: int = STALE_RUNNING_SECONDS,
) -> int:
    """Mark orphaned Running/Stopping jobs Failed so the FIFO queue can drain.

    Returns the number of jobs reclaimed.
    """
    now = datetime.now(timezone.utc)
    stopping_cutoff = now - timedelta(seconds=max(60, int(stopping_after_seconds)))
    running_cutoff = now - timedelta(seconds=max(60, int(running_after_seconds)))

    busy_jobs = db.session.execute(
        select(ScanJob).where(ScanJob.status.in_(('Running', 'Stopping')))
    ).scalars().all()

    reclaimed = 0
    for job in busy_jobs:
        anchor = job.last_progress_update or job.last_run
        if anchor is None:
            # Never progressed and no last_run — treat as immediately reclaimable Stopping,
            # but give Running a chance unless it has been Queued→Running without a worker.
            if job.status != 'Stopping':
                continue
            anchor = now - timedelta(seconds=stopping_after_seconds + 1)
        if anchor.tzinfo is None:
            anchor = anchor.replace(tzinfo=timezone.utc)

        if job.status == 'Stopping' and anchor <= stopping_cutoff:
            job.status = 'Failed'
            job.is_enabled = False
            job.current_processing = None
            job.error_message = (
                (job.error_message or '').strip()
                or 'Scan stuck in Stopping; reclaimed so queued scans can start.'
            )
            reclaimed += 1
        elif job.status == 'Running' and anchor <= running_cutoff:
            job.status = 'Failed'
            job.is_enabled = False
            job.current_processing = None
            job.error_message = (
                (job.error_message or '').strip()
                or 'Scan stuck in Running without progress; reclaimed so queued scans can start.'
            )
            reclaimed += 1

    if reclaimed:
        try:
            db.session.commit()
            print(f'[SCAN QUEUE] Reclaimed {reclaimed} stale Running/Stopping job(s)')
        except SQLAlchemyError as exc:
            db.session.rollback()
            print(f'[SCAN QUEUE] Failed to reclaim stale jobs: {exc}')
            return 0
    return reclaimed


def promote_next_queued_scan(app=None) -> ScanJob | None:
    """If no scan is busy, promote the oldest Queued job to Running and start it.

    Safe to call after a job reaches a terminal state. Returns the promoted job
    or None when nothing was started.
    """
    if is_scan_busy():
        return None

    next_job = db.session.execute(
        select(ScanJob)
        .where(ScanJob.status == 'Queued')
        .order_by(ScanJob.last_run.asc().nullsfirst(), ScanJob.id.asc())
        .limit(1)
    ).scalars().first()
    if not next_job:
        return None

    # Conditional claim: only promote if this row is still Queued.
    now = datetime.now(timezone.utc)
    claimed = db.session.execute(
        update(ScanJob)
        .where(
            ScanJob.id == next_job.id,
            ScanJob.status == 'Queued',
        )
        .values(
            status='Running',
            last_run=now,
            error_message='',
            is_enabled=True,
            current_processing=None,
        )
    )
    rowcount = claimed.rowcount or 0
    try:
        db.session.commit()
    except SQLAlchemyError as exc:
        db.session.rollback()
        print(f'[SCAN QUEUE] Failed to promote queued job: {exc}')
        return None

    if rowcount != 1:
        return None

    db.session.expire_all()
    promoted = db.session.get(ScanJob, next_job.id)
    if not promoted or promoted.status != 'Running':
        return None

    # Another worker may have started in parallel — roll back claim if so.
    other_busy = db.session.execute(
        select(ScanJob.id).where(
            ScanJob.status.in_(('Running', 'Stopping')),
            ScanJob.id != promoted.id,
        ).limit(1)
    ).first()
    if other_busy:
        promoted.status = 'Queued'
        try:
            db.session.commit()
        except SQLAlchemyError:
            db.session.rollback()
        print(
            f'[SCAN QUEUE] Rolled back promote of {promoted.id} — another job is busy'
        )
        return None

    try:
        from gametheca.utils.event_bus import publish_scan_event
        publish_scan_event(promoted.id, 'Running')
    except Exception:
        pass

    flask_app = app or current_app._get_current_object()
    print(f'[SCAN QUEUE] Promoting queued job {promoted.id} for {promoted.scan_folder}')
    _start_job_thread(promoted, flask_app, force_parallel=False)
    return promoted


def drain_scan_queue(app=None) -> ScanJob | None:
    """Reclaim stale busy jobs then promote the next Queued scan (safety drain)."""
    try:
        reclaim_stale_busy_jobs()
    except Exception as exc:
        print(f'[SCAN QUEUE] Stale reclaim failed: {exc}')
    try:
        return promote_next_queued_scan(app)
    except Exception as exc:
        print(f'[SCAN QUEUE] Promote failed: {exc}')
        return None


def enqueue_library_refresh_jobs(libraries_with_folders: list[dict]) -> dict:
    """Create Queued ScanJobs for refresh-all when a scan is already busy.

    ``libraries_with_folders`` items: ``{uuid, name, folder}``.
    Coalesces when the same library folder is already Queued.
    """
    created = []
    coalesced = 0
    for item in libraries_with_folders:
        existing = find_queued_for_library(item['uuid'], item['folder'])
        if existing:
            coalesced += 1
            created.append({
                'uuid': item['uuid'],
                'name': item.get('name'),
                'folder': item['folder'],
                'job_id': existing.id,
                'position': queue_position(existing.id),
                'coalesced': True,
            })
            continue
        job = create_scan_job_row(
            folder_path=item['folder'],
            library_uuid=item['uuid'],
            scan_mode='folders',
            status='Queued',
        )
        created.append({
            'uuid': item['uuid'],
            'name': item.get('name'),
            'folder': item['folder'],
            'job_id': job.id,
            'position': queue_position(job.id),
        })
    msg = (
        f'{len(created)} library refresh scan(s) queued (FIFO). '
        'They start when the current Running/Stopping job finishes.'
    )
    if coalesced:
        msg += f' {coalesced} already-queued library folder(s) coalesced.'
    return {
        'status': 'queued',
        'jobs': created,
        'count': len(created),
        'coalesced_count': coalesced,
        'message': msg,
    }
