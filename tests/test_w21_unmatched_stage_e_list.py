"""W21-BE-2b: Stage E fields flattened onto unmatched list + export JSON."""

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
        name=f'StageEAdmin_{uid[:8]}',
        email=f'stage_e_admin_{uid[:8]}@test.com',
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
        name=f'StageELib_{uuid4().hex[:8]}',
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


_STAGE_E_CANDIDATE = {
    'source': 'mobygames',
    'id': '123',
    'name': 'Doom',
    'url': 'https://www.mobygames.com/game/123',
    'cover_url': 'https://example.com/doom.jpg',
    'mobygames_id': 123,
    'match_mode': 'moby_exact',
    'propose_only': True,
    'identify_path': 'stage_e',
}

_STAGE_E_META = {
    'match_reason': 'stage_e_moby_exact',
    'identify_path': 'stage_e',
    'skipped': ['tgdb_pc_skipped'],
    'propose_only': True,
}


def test_hint_fields_from_proposal_extracts_stage_e():
    proposal = {
        'proposal': {
            'stage_e_candidates': [_STAGE_E_CANDIDATE],
            'stage_e': _STAGE_E_META,
            'suggested_candidate_name': 'Doom',
        }
    }
    hint = hint_fields_from_proposal(proposal)
    assert hint['suggested_candidate_name'] == 'Doom'
    assert hint['stage_e_candidates'] is not None
    assert len(hint['stage_e_candidates']) == 1
    assert hint['stage_e_candidates'][0]['name'] == 'Doom'
    assert hint['stage_e_candidates'][0]['match_mode'] == 'moby_exact'
    assert hint['stage_e_candidates'][0]['propose_only'] is True
    assert hint['stage_e']['match_reason'] == 'stage_e_moby_exact'
    assert hint['stage_e']['propose_only'] is True
    assert 'tgdb_pc_skipped' in hint['stage_e']['skipped']


def test_hint_fields_soft_omit_stage_e_when_absent():
    hint = hint_fields_from_proposal({'proposal': {'suggested_kind': 'tool'}})
    assert hint['stage_e_candidates'] is None
    assert hint['stage_e'] is None
    assert hint_fields_from_proposal(None)['stage_e_candidates'] is None


def test_unmatched_list_soft_omits_stage_e_when_absent(
    client, admin_user, db_session, sample_library, sample_scan_job,
):
    folder = UnmatchedFolder(
        library_uuid=sample_library.uuid,
        scan_job_id=sample_scan_job.id,
        folder_path=f'/test/unmatched/no-stage-e-{uuid4().hex[:8]}',
        failed_time=datetime.now(timezone.utc),
        content_type='Games',
        status='Unmatched',
        stage_e_candidates=None,
        stage_e=None,
    )
    db_session.add(folder)
    db_session.commit()

    _login_admin(client, admin_user)
    resp = client.get('/api/unmatched_folders')
    assert resp.status_code == 200
    match = next(r for r in resp.get_json() if r['id'] == folder.id)
    assert 'stage_e_candidates' not in match
    assert 'stage_e' not in match


def test_unmatched_list_includes_stage_e_when_present(
    client, admin_user, db_session, sample_library, sample_scan_job,
):
    folder = UnmatchedFolder(
        library_uuid=sample_library.uuid,
        scan_job_id=sample_scan_job.id,
        folder_path=f'/test/unmatched/with-stage-e-{uuid4().hex[:8]}',
        failed_time=datetime.now(timezone.utc),
        content_type='Games',
        status='Unmatched',
        suggested_candidate_name='Doom',
        stage_e_candidates=[_STAGE_E_CANDIDATE],
        stage_e=_STAGE_E_META,
    )
    db_session.add(folder)
    db_session.commit()

    _login_admin(client, admin_user)
    resp = client.get('/api/unmatched_folders')
    assert resp.status_code == 200
    match = next(r for r in resp.get_json() if r['id'] == folder.id)
    assert match['suggested_candidate_name'] == 'Doom'
    assert isinstance(match['stage_e_candidates'], list)
    assert len(match['stage_e_candidates']) == 1
    hit = match['stage_e_candidates'][0]
    assert hit['source'] == 'mobygames'
    assert hit['name'] == 'Doom'
    assert hit['match_mode'] == 'moby_exact'
    assert hit['propose_only'] is True
    assert hit['identify_path'] == 'stage_e'
    assert match['stage_e']['match_reason'] == 'stage_e_moby_exact'
    assert match['stage_e']['propose_only'] is True
    assert match['stage_e']['identify_path'] == 'stage_e'


def test_unmatched_export_json_includes_stage_e(
    client, admin_user, db_session, sample_library, sample_scan_job,
):
    folder = UnmatchedFolder(
        library_uuid=sample_library.uuid,
        scan_job_id=sample_scan_job.id,
        folder_path=f'/test/unmatched/export-stage-e-{uuid4().hex[:8]}',
        failed_time=datetime.now(timezone.utc),
        content_type='Games',
        status='Unmatched',
        stage_e_candidates=[_STAGE_E_CANDIDATE],
        stage_e=_STAGE_E_META,
    )
    db_session.add(folder)
    db_session.commit()

    _login_admin(client, admin_user)
    resp = client.get('/api/unmatched_folders/export?format=json')
    assert resp.status_code == 200
    match = next(r for r in resp.get_json() if r['id'] == folder.id)
    assert match['stage_e_candidates'][0]['name'] == 'Doom'
    assert match['stage_e']['match_reason'] == 'stage_e_moby_exact'

    absent = UnmatchedFolder(
        library_uuid=sample_library.uuid,
        scan_job_id=sample_scan_job.id,
        folder_path=f'/test/unmatched/export-no-stage-e-{uuid4().hex[:8]}',
        failed_time=datetime.now(timezone.utc),
        content_type='Games',
        status='Unmatched',
    )
    db_session.add(absent)
    db_session.commit()
    resp2 = client.get('/api/unmatched_folders/export?format=json')
    assert resp2.status_code == 200
    soft = next(r for r in resp2.get_json() if r['id'] == absent.id)
    assert 'stage_e_candidates' not in soft
    assert 'stage_e' not in soft


def test_sync_unmatched_kind_hint_denormalizes_stage_e(
    db_session, sample_library, sample_scan_job, tmp_path,
):
    path = str(tmp_path / 'doom-folder')
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

    proposal = build_match_proposal('Doom', [])
    proposal['proposal']['stage_e_candidates'] = [_STAGE_E_CANDIDATE]
    proposal['proposal']['stage_e'] = _STAGE_E_META
    proposal['proposal']['suggested_candidate_name'] = 'Doom'
    assert sync_unmatched_kind_hint(path, proposal) is True
    db_session.refresh(folder)
    assert folder.suggested_candidate_name == 'Doom'
    assert folder.stage_e_candidates[0]['name'] == 'Doom'
    assert folder.stage_e['match_reason'] == 'stage_e_moby_exact'
