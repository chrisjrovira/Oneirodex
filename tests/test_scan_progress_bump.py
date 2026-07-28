"""Atomic scan progress bumps must not lose counts under concurrent updates."""
from datetime import datetime, timezone

from gametheca.models import ScanJob
from gametheca.utils.scanning import bump_scan_job_progress


def test_bump_scan_job_progress_increments_without_clobber(app, db_session):
    job = ScanJob(
        folders={'/games': True},
        content_type='Games',
        status='Running',
        is_enabled=True,
        last_run=datetime.now(timezone.utc),
        total_folders=10,
        folders_success=1,
        folders_failed=0,
        error_message='',
    )
    db_session.add(job)
    db_session.commit()
    job_id = job.id

    # Simulate a worker that only touches status-adjacent fields while the
    # coordinator is bumping counters (column-only UPDATE must win).
    bump_scan_job_progress(job_id, success=True, current_processing='Processing: A (2/10)')
    bump_scan_job_progress(job_id, success=True, current_processing='Processing: B (3/10)')
    bump_scan_job_progress(job_id, failed=True, current_processing='Processing: C (4/10)')

    db_session.expire_all()
    refreshed = db_session.get(ScanJob, job_id)
    assert refreshed.folders_success == 3
    assert refreshed.folders_failed == 1
    assert refreshed.current_processing.startswith('Processing: C')
    assert refreshed.last_progress_update is not None


def test_bump_scan_job_progress_noop_without_flags(app, db_session):
    job = ScanJob(
        folders={'/games': True},
        content_type='Games',
        status='Running',
        is_enabled=True,
        last_run=datetime.now(timezone.utc),
        total_folders=5,
        folders_success=2,
        folders_failed=1,
        error_message='',
    )
    db_session.add(job)
    db_session.commit()
    job_id = job.id

    bump_scan_job_progress(job_id)
    db_session.expire_all()
    refreshed = db_session.get(ScanJob, job_id)
    assert refreshed.folders_success == 2
    assert refreshed.folders_failed == 1
