"""Scan job queue vs force-parallel start policy.

Default policy when a scan is already Running/Stopping: **queue** (FIFO).
Admin may opt in to **force parallel** — starts alongside the running job,
still subject to per-job ``scan_thread_count`` / ``worker_caps``.
"""

from __future__ import annotations

from datetime import datetime, timezone
from threading import Thread

from flask import current_app
from sqlalchemy import func, select
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

    next_job.status = 'Running'
    next_job.last_run = datetime.now(timezone.utc)
    next_job.error_message = ''
    try:
        db.session.commit()
    except SQLAlchemyError as exc:
        db.session.rollback()
        print(f'[SCAN QUEUE] Failed to promote queued job: {exc}')
        return None

    try:
        from gametheca.utils.event_bus import publish_scan_event
        publish_scan_event(next_job.id, 'Running')
    except Exception:
        pass

    flask_app = app or current_app._get_current_object()
    print(f'[SCAN QUEUE] Promoting queued job {next_job.id} for {next_job.scan_folder}')
    _start_job_thread(next_job, flask_app, force_parallel=False)
    return next_job


def enqueue_library_refresh_jobs(libraries_with_folders: list[dict]) -> dict:
    """Create Queued ScanJobs for refresh-all when a scan is already busy.

    ``libraries_with_folders`` items: ``{uuid, name, folder}``.
    """
    created = []
    for item in libraries_with_folders:
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
    return {
        'status': 'queued',
        'jobs': created,
        'count': len(created),
        'message': (
            f'{len(created)} library refresh scan(s) queued (FIFO). '
            'They start when the current Running/Stopping job finishes.'
        ),
    }
