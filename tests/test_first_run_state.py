"""UID-043 — telling "nothing has scanned yet" apart from "a scan found nothing".

Both render an empty catalog, and before this signal existed the empty state
said the same thing for each: an operator whose scan paths pointed at the wrong
folders got the same cheerful line as one who simply had not scanned yet.
"""

from datetime import datetime, timezone
from uuid import uuid4

import pytest

from oneirodex import db
from oneirodex.models import Library, ScanJob, UnmatchedFolder
from oneirodex.platform import LibraryPlatform
from oneirodex.utils.functions import get_first_run_state


@pytest.fixture(autouse=True)
def _clean_scan_state(db_session):
    """Both counts are global, so a row another test left behind is this test's
    answer. `db_session` does not roll these back between tests, so clear them
    explicitly rather than writing assertions loose enough to survive leakage —
    a `>= 1` here would pass whether or not the query worked."""
    db_session.query(UnmatchedFolder).delete()
    db_session.query(ScanJob).delete()
    db_session.commit()
    yield


def _library(db_session):
    library = Library(
        name=f'lib-{uuid4().hex[:8]}',
        platform=LibraryPlatform.PCWIN,
    )
    db_session.add(library)
    db_session.commit()
    return library


def _job(db_session, library, status):
    job = ScanJob(
        id=str(uuid4()),
        status=status,
        library_uuid=library.uuid,
        last_run=datetime.now(timezone.utc),
    )
    db_session.add(job)
    db_session.commit()
    return job


def _unmatched(db_session, library, job, status='Pending'):
    row = UnmatchedFolder(
        id=str(uuid4()),
        library_uuid=library.uuid,
        scan_job_id=job.id,
        folder_path=f'/games/{uuid4().hex[:6]}',
        failed_time=datetime.now(timezone.utc),
        status=status,
    )
    db_session.add(row)
    db_session.commit()
    return row


class TestScanHasRun:
    def test_no_jobs_means_nothing_has_scanned(self, db_session):
        assert get_first_run_state()['scan_has_run'] is False

    def test_a_completed_job_counts(self, db_session):
        _job(db_session, _library(db_session), 'Completed')
        assert get_first_run_state()['scan_has_run'] is True

    def test_a_failed_job_counts_too(self, db_session):
        """A scan that failed *did* run. Reporting first-run copy after a failed
        scan would be the same lie in a new place."""
        _job(db_session, _library(db_session), 'Failed')
        assert get_first_run_state()['scan_has_run'] is True

    def test_a_running_job_does_not_count(self, db_session):
        """`last_run` is stamped the moment a job is picked up, so keying off it
        would announce that a scan had run while it was still running."""
        _job(db_session, _library(db_session), 'Running')
        assert get_first_run_state()['scan_has_run'] is False

    def test_a_queued_or_scheduled_job_does_not_count(self, db_session):
        library = _library(db_session)
        _job(db_session, library, 'Queued')
        _job(db_session, library, 'Scheduled')
        assert get_first_run_state()['scan_has_run'] is False


class TestUnmatchedCount:
    def test_zero_when_nothing_was_left_behind(self, db_session):
        _job(db_session, _library(db_session), 'Completed')
        assert get_first_run_state()['unmatched_count'] == 0

    def test_counts_what_a_scan_could_not_place(self, db_session):
        library = _library(db_session)
        job = _job(db_session, library, 'Completed')
        for _ in range(3):
            _unmatched(db_session, library, job)
        assert get_first_run_state()['unmatched_count'] == 3

    def test_resolved_rows_are_not_counted(self, db_session):
        """Ignored and duplicate rows have been dealt with; counting them would
        point the operator at a screen where there is nothing left to do."""
        library = _library(db_session)
        job = _job(db_session, library, 'Completed')
        _unmatched(db_session, library, job, status='Pending')
        _unmatched(db_session, library, job, status='Ignore')
        _unmatched(db_session, library, job, status='Duplicate')
        assert get_first_run_state()['unmatched_count'] == 1
