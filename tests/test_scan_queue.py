"""Tests for scan queue / force-parallel start policy."""

from datetime import datetime, timezone
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import select, text

from gametheca.models import Library, ScanJob, User
from gametheca.platform import LibraryPlatform
from gametheca.utils.scan_queue import (
    count_queued_jobs,
    create_scan_job_row,
    parse_force_parallel,
    parse_queue_policy,
    promote_next_queued_scan,
    queue_position,
    start_or_queue_scan,
)


@pytest.fixture(autouse=True)
def _clean_scan_jobs(db_session):
    try:
        db_session.execute(text('TRUNCATE TABLE scan_jobs RESTART IDENTITY CASCADE'))
        db_session.commit()
    except Exception:
        db_session.rollback()
    yield
    try:
        db_session.execute(text('TRUNCATE TABLE scan_jobs RESTART IDENTITY CASCADE'))
        db_session.commit()
    except Exception:
        db_session.rollback()


@pytest.fixture
def sample_library(db_session):
    library = Library(
        name=f'QueueLib_{uuid4().hex[:8]}',
        platform=LibraryPlatform.PCWIN,
    )
    db_session.add(library)
    db_session.commit()
    return library


@pytest.fixture
def running_job(db_session, sample_library):
    job = ScanJob(
        folders={'/games': True},
        content_type='Games',
        status='Running',
        is_enabled=True,
        last_run=datetime.now(timezone.utc),
        library_uuid=sample_library.uuid,
        scan_folder='/games',
        total_folders=10,
        folders_success=1,
        folders_failed=0,
    )
    db_session.add(job)
    db_session.commit()
    return job


class TestParsePolicy:
    def test_force_parallel_truthy(self):
        assert parse_force_parallel(True) is True
        assert parse_force_parallel('true') is True
        assert parse_force_parallel('1') is True
        assert parse_force_parallel('force') is False
        assert parse_force_parallel(None) is False

    def test_queue_policy_force(self):
        assert parse_queue_policy('force') == 'force'
        assert parse_queue_policy(None, force_parallel=True) == 'force'
        assert parse_queue_policy('queue') == 'queue'
        assert parse_queue_policy(None) == 'queue'


class TestStartOrQueueScan:
    def test_queues_when_busy_by_default(self, app, db_session, sample_library, running_job):
        with app.app_context():
            result = start_or_queue_scan(
                folder_path='/games/pc',
                library_uuid=sample_library.uuid,
                queue_policy='queue',
                allow_force=True,
                app=app,
            )
            assert result['status'] == 'queued'
            assert result['job_id']
            assert result['position'] == 1
            assert 'queued' in result['message'].lower()
            job = db_session.get(ScanJob, result['job_id'])
            assert job is not None
            assert job.status == 'Queued'
            assert count_queued_jobs() == 1
            still = db_session.get(ScanJob, running_job.id)
            assert still.status == 'Running'

    def test_force_parallel_starts_second_running(
        self, app, db_session, sample_library, running_job
    ):
        with app.app_context():
            with patch('gametheca.utils.scan_queue.Thread') as mock_thread:
                mock_thread.return_value.start = lambda: None
                result = start_or_queue_scan(
                    folder_path='/games/pc2',
                    library_uuid=sample_library.uuid,
                    queue_policy='force',
                    allow_force=True,
                    app=app,
                )
            assert result['status'] == 'started'
            assert result['job_id']
            assert result['position'] is None
            assert 'parallel' in result['message'].lower() or 'Force' in result['message']
            job = db_session.get(ScanJob, result['job_id'])
            assert job.status == 'Running'
            running = db_session.execute(
                select(ScanJob).where(ScanJob.status == 'Running')
            ).scalars().all()
            assert len(running) >= 2

    def test_non_admin_cannot_force(self, app, db_session, sample_library, running_job):
        with app.app_context():
            result = start_or_queue_scan(
                folder_path='/games/pc3',
                library_uuid=sample_library.uuid,
                queue_policy='force',
                allow_force=False,
                app=app,
            )
            assert result['status'] == 'rejected'
            assert result['job_id'] is None
            assert 'admin' in result['message'].lower()
            assert count_queued_jobs() == 0

    def test_promote_queued_after_running_clears(
        self, app, db_session, sample_library, running_job
    ):
        with app.app_context():
            queued = create_scan_job_row(
                folder_path='/games/next',
                library_uuid=sample_library.uuid,
                status='Queued',
            )
            assert queue_position(queued.id) == 1

            job = db_session.get(ScanJob, running_job.id)
            job.status = 'Completed'
            db_session.commit()
            db_session.expire_all()

            with patch('gametheca.utils.scan_queue.Thread') as mock_thread:
                mock_thread.return_value.start = lambda: None
                promoted = promote_next_queued_scan(app)

            assert promoted is not None
            assert promoted.id == queued.id
            refreshed = db_session.get(ScanJob, queued.id)
            assert refreshed.status == 'Running'
            assert count_queued_jobs() == 0


class TestLibraryScanApi:
    @pytest.fixture
    def admin_user(self, db_session):
        unique = uuid4().hex[:8]
        admin = User(
            user_id=str(uuid4()),
            name=f'Admin_{unique}',
            email=f'admin_{unique}@test.com',
            role='admin',
            is_email_verified=True,
        )
        admin.set_password('testpass123')
        db_session.add(admin)
        db_session.commit()
        return admin

    @pytest.fixture
    def regular_user(self, db_session):
        unique = uuid4().hex[:8]
        user = User(
            user_id=str(uuid4()),
            name=f'User_{unique}',
            email=f'user_{unique}@test.com',
            role='user',
            is_email_verified=True,
        )
        user.set_password('testpass123')
        db_session.add(user)
        db_session.commit()
        return user

    def test_api_queues_when_busy(
        self, client, admin_user, sample_library, running_job, db_session
    ):
        sample_library.last_scan_folder = '/games/pc'
        db_session.commit()
        with client.session_transaction() as sess:
            sess['_user_id'] = str(admin_user.id)
            sess['_fresh'] = True

        resp = client.post(
            '/api/admin/libraries/scan',
            json={
                'library_uuid': sample_library.uuid,
                'folder': '/games/pc',
            },
        )
        assert resp.status_code == 200
        body = resp.get_json()
        assert body['status'] == 'queued'
        assert body['job_id']
        assert body['position'] >= 1

    def test_api_force_parallel_admin(
        self, client, admin_user, sample_library, running_job, db_session
    ):
        with client.session_transaction() as sess:
            sess['_user_id'] = str(admin_user.id)
            sess['_fresh'] = True
        with patch('gametheca.utils.scan_queue.Thread') as mock_thread:
            mock_thread.return_value.start = lambda: None
            resp = client.post(
                '/api/admin/libraries/scan',
                json={
                    'library_uuid': sample_library.uuid,
                    'folder': '/games/pc',
                    'force_parallel': True,
                },
            )
        assert resp.status_code == 200
        body = resp.get_json()
        assert body['status'] == 'started'
        assert 'risk' in body or 'parallel' in body['message'].lower()

    def test_non_admin_forbidden_on_scan_api(self, client, regular_user, sample_library):
        with client.session_transaction() as sess:
            sess['_user_id'] = str(regular_user.id)
            sess['_fresh'] = True
        resp = client.post(
            '/api/admin/libraries/scan',
            json={
                'library_uuid': sample_library.uuid,
                'folder': '/games/pc',
                'force_parallel': True,
            },
        )
        assert resp.status_code in (401, 403, 302)
