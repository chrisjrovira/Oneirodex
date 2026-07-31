"""Unmatched list suggested_kind hint (denormalized on UnmatchedFolder)."""

from datetime import datetime, timezone
from uuid import uuid4

import pytest

from gametheca.models import Library, ScanJob, UnmatchedFolder, User
from gametheca.platform import LibraryPlatform
from gametheca.utils.match_proposal import (
    build_match_proposal,
    hint_fields_from_proposal,
    sync_unmatched_kind_hint,
)


@pytest.fixture
def admin_user(db_session):
    uid = str(uuid4())
    user = User(
        user_id=uid,
        name=f'KindAdmin_{uid[:8]}',
        email=f'kind_admin_{uid[:8]}@test.com',
        role='admin',
        is_email_verified=True,
        state=True,
    )
    user.set_password('testpass123')
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def sample_library(db_session):
    library = Library(
        name=f'KindLib_{uuid4().hex[:8]}',
        platform=LibraryPlatform.PCWIN,
    )
    db_session.add(library)
    db_session.flush()
    return library


@pytest.fixture
def sample_scan_job(db_session, sample_library):
    job = ScanJob(
        library_uuid=sample_library.uuid,
        folders={'test': 'folder'},
        content_type='Games',
        schedule='24_hours',
        is_enabled=True,
        status='Completed',
        scan_folder='/test/scan/folder',
    )
    db_session.add(job)
    db_session.flush()
    return job


def _login_admin(client, admin_user):
    with client.session_transaction() as sess:
        sess['_user_id'] = str(admin_user.id)
        sess['_fresh'] = True


def test_hint_fields_from_proposal_extracts_software_top():
    proposal = {
        'proposal': {
            'suggested_kind': 'emulator',
            'software_candidates': [
                {'name': '3DSen VR', 'item_kind': 'emulator'},
                {'name': 'Other', 'item_kind': 'tool'},
            ],
        }
    }
    hint = hint_fields_from_proposal(proposal)
    assert hint['suggested_kind'] == 'emulator'
    assert hint['suggested_kind_label'] == 'Emulator'
    assert hint['suggested_candidate_name'] == '3DSen VR'


def test_hint_fields_empty_without_proposal():
    assert hint_fields_from_proposal(None)['suggested_kind'] is None
    assert hint_fields_from_proposal({})['suggested_kind'] is None


def test_unmatched_list_without_suggestion(
    client, admin_user, db_session, sample_library, sample_scan_job,
):
    folder = UnmatchedFolder(
        library_uuid=sample_library.uuid,
        scan_job_id=sample_scan_job.id,
        folder_path=f'/test/unmatched/no-hint-{uuid4().hex[:8]}',
        failed_time=datetime.now(timezone.utc),
        content_type='Games',
        status='Unmatched',
        suggested_kind=None,
        suggested_candidate_name=None,
    )
    db_session.add(folder)
    db_session.commit()

    _login_admin(client, admin_user)
    resp = client.get('/api/unmatched_folders')
    assert resp.status_code == 200
    rows = resp.get_json()
    match = next(r for r in rows if r['id'] == folder.id)
    assert match['suggested_kind'] is None
    assert match['suggested_kind_label'] is None
    assert match['suggested_candidate_name'] is None


def test_unmatched_list_with_suggestion(
    client, admin_user, db_session, sample_library, sample_scan_job,
):
    folder = UnmatchedFolder(
        library_uuid=sample_library.uuid,
        scan_job_id=sample_scan_job.id,
        folder_path=f'/test/unmatched/with-hint-{uuid4().hex[:8]}',
        failed_time=datetime.now(timezone.utc),
        content_type='Games',
        status='Unmatched',
        suggested_kind='tool',
        suggested_candidate_name='Save Editor Utility',
    )
    db_session.add(folder)
    db_session.commit()

    _login_admin(client, admin_user)
    resp = client.get('/api/unmatched_folders')
    assert resp.status_code == 200
    match = next(r for r in resp.get_json() if r['id'] == folder.id)
    assert match['suggested_kind'] == 'tool'
    assert match['suggested_kind_label'] == 'Tool'
    assert match['suggested_candidate_name'] == 'Save Editor Utility'


def test_unmatched_export_includes_suggested_kind(
    client, admin_user, db_session, sample_library, sample_scan_job,
):
    folder = UnmatchedFolder(
        library_uuid=sample_library.uuid,
        scan_job_id=sample_scan_job.id,
        folder_path=f'/test/unmatched/export-hint-{uuid4().hex[:8]}',
        failed_time=datetime.now(timezone.utc),
        content_type='Games',
        status='Unmatched',
        suggested_kind='experience',
        suggested_candidate_name='VR Painter',
    )
    db_session.add(folder)
    db_session.commit()

    _login_admin(client, admin_user)
    resp = client.get('/api/unmatched_folders/export?format=json')
    assert resp.status_code == 200
    match = next(r for r in resp.get_json() if r['id'] == folder.id)
    assert match['suggested_kind'] == 'experience'
    assert match['suggested_kind_label'] == 'Experience'
    assert match['suggested_candidate_name'] == 'VR Painter'

    csv_resp = client.get('/api/unmatched_folders/export?format=csv')
    assert csv_resp.status_code == 200
    text = csv_resp.get_data(as_text=True)
    assert 'suggested_kind' in text
    assert 'experience' in text


def test_sync_unmatched_kind_hint_from_proposal(db_session, sample_library, sample_scan_job, tmp_path):
    path = str(tmp_path / 'emu-folder')
    folder = UnmatchedFolder(
        library_uuid=sample_library.uuid,
        scan_job_id=sample_scan_job.id,
        folder_path=path,
        failed_time=datetime.now(timezone.utc),
        content_type='Games',
        status='Unmatched',
    )
    db_session.add(folder)
    db_session.commit()

    proposal = build_match_proposal('3DSenVR', [])
    proposal['proposal']['suggested_kind'] = 'emulator'
    proposal['proposal']['software_candidates'] = [
        {'name': '3DSen VR', 'item_kind': 'emulator'},
    ]
    assert sync_unmatched_kind_hint(path, proposal) is True
    db_session.refresh(folder)
    assert folder.suggested_kind == 'emulator'
    assert folder.suggested_candidate_name == '3DSen VR'


def test_format_why_unmatched_deterministic():
    from gametheca.utils.match_proposal import format_why_unmatched

    text = format_why_unmatched(
        status='Unmatched',
        match_reason=None,
        match_score=None,
        suggested_kind='emulator',
        suggested_kind_label='Emulator',
        suggested_candidate_name='3DSen VR',
        folder_name='3DSenVR',
    )
    assert text.startswith('3DSenVR — ')
    assert 'Could not auto-match to IGDB' in text
    assert 'suggested Emulator: 3DSen VR' in text

    dup = format_why_unmatched(
        status='Duplicate',
        match_reason='title_vs_library_name',
        match_score=0.91,
        folder_name='Some Game',
    )
    assert 'Folder title matches an existing library game name (score 0.91)' in dup


def test_unmatched_list_exposes_why_unmatched(
    client, admin_user, db_session, sample_library, sample_scan_job,
):
    folder = UnmatchedFolder(
        library_uuid=sample_library.uuid,
        scan_job_id=sample_scan_job.id,
        folder_path=f'/test/unmatched/why-{uuid4().hex[:8]}/CoolTitle',
        failed_time=datetime.now(timezone.utc),
        content_type='Games',
        status='Unmatched',
        match_reason='title_below_threshold',
        match_score=0.42,
        suggested_kind='tool',
        suggested_candidate_name='Save Editor',
    )
    db_session.add(folder)
    db_session.commit()

    _login_admin(client, admin_user)
    resp = client.get('/api/unmatched_folders')
    assert resp.status_code == 200
    match = next(r for r in resp.get_json() if r['id'] == folder.id)
    assert match['folder_name'] == 'CoolTitle'
    assert match['match_reason'] == 'title_below_threshold'
    assert match['match_score'] == 0.42
    assert match['suggested_kind'] == 'tool'
    assert match['why_unmatched'] == match['unmatched_reason']
    assert 'CoolTitle' in match['why_unmatched']
    assert 'differently titled' in match['why_unmatched']
    assert 'suggested Tool: Save Editor' in match['why_unmatched']


def test_backfill_suggested_kind_from_sidecar(
    client, admin_user, db_session, sample_library, sample_scan_job, tmp_path,
):
    from gametheca.utils.match_proposal import (
        PROPOSAL_FILENAME,
        backfill_unmatched_suggested_kind,
        write_match_proposal,
    )

    folder_dir = tmp_path / 'legacy-emu'
    folder_dir.mkdir()
    path = str(folder_dir)
    folder = UnmatchedFolder(
        library_uuid=sample_library.uuid,
        scan_job_id=sample_scan_job.id,
        folder_path=path,
        failed_time=datetime.now(timezone.utc),
        content_type='Games',
        status='Unmatched',
        suggested_kind=None,
        suggested_candidate_name=None,
    )
    # Already-hinted row must be skipped (idempotent / no N+1 on known rows).
    hinted = UnmatchedFolder(
        library_uuid=sample_library.uuid,
        scan_job_id=sample_scan_job.id,
        folder_path=str(tmp_path / 'already-hinted'),
        failed_time=datetime.now(timezone.utc),
        content_type='Games',
        status='Unmatched',
        suggested_kind='game',
        suggested_candidate_name=None,
    )
    db_session.add_all([folder, hinted])
    db_session.commit()

    proposal = build_match_proposal('LegacyEmu', [])
    proposal['proposal']['suggested_kind'] = 'emulator'
    proposal['proposal']['software_candidates'] = [
        {'name': 'Legacy Emulator', 'item_kind': 'emulator'},
    ]
    assert write_match_proposal(path, proposal, filename=PROPOSAL_FILENAME)

    dry = backfill_unmatched_suggested_kind(dry_run=True)
    assert dry['ok'] is True
    assert dry['dry_run'] is True
    assert dry['updated'] >= 1
    db_session.refresh(folder)
    assert folder.suggested_kind is None

    result = backfill_unmatched_suggested_kind()
    assert result['ok'] is True
    assert result['committed'] is True
    assert result['updated'] >= 1
    db_session.refresh(folder)
    assert folder.suggested_kind == 'emulator'
    assert folder.suggested_candidate_name == 'Legacy Emulator'

    # Second pass: this row is skipped (already has suggested_kind) — idempotent.
    again = backfill_unmatched_suggested_kind()
    assert again['ok'] is True
    db_session.refresh(folder)
    assert folder.suggested_kind == 'emulator'
    assert folder.suggested_candidate_name == 'Legacy Emulator'

    _login_admin(client, admin_user)
    api = client.post('/api/unmatched_folders/backfill_suggested_kind', json={'dry_run': True})
    assert api.status_code == 200
    body = api.get_json()
    assert body['status'] == 'ok'
    assert 'scanned' in body
    assert body['dry_run'] is True


def test_backfill_endpoint_requires_admin(client, db_session):
    resp = client.post('/api/unmatched_folders/backfill_suggested_kind', json={})
    assert resp.status_code in (401, 302, 403)
