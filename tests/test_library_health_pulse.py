"""Library health Ops pulse — deterministic counts → known score."""

from __future__ import annotations

from uuid import uuid4

import pytest

from oneirodex.models import Game, Image, Library, UnmatchedFolder, User
from oneirodex.platform import LibraryPlatform
from oneirodex.utils.library_health import (
    HEALTH_FACTOR_SPECS,
    PATH_STATUS_MISSING,
    PATH_STATUS_OK,
    build_library_health_pulse,
    clear_restored_missing_path_status,
    collect_library_health_counts,
    grade_from_score,
    refresh_game_path_status,
    score_game,
    score_library_health_from_counts,
)
from oneirodex.utils.software_identify import CUSTOM_IGDB_BASE


def test_health_factor_weights_sum_100():
    assert sum(s['weight'] for s in HEALTH_FACTOR_SPECS) == 100


def test_grade_from_score_bands():
    assert grade_from_score(100) == 'good'
    assert grade_from_score(80) == 'good'
    assert grade_from_score(79) == 'fair'
    assert grade_from_score(50) == 'fair'
    assert grade_from_score(49) == 'poor'
    assert grade_from_score(0) == 'poor'
    assert grade_from_score(None) is None


def test_score_from_counts_perfect_library():
    result = score_library_health_from_counts(games=100)
    assert result['score'] == 100
    assert result['grade'] == 'good'
    assert result['thin'] is False
    assert result['note'] is None
    assert {f['id'] for f in result['factors']} == {
        'missing_cover',
        'missing_path',
        'no_igdb',
        'stale_freshness',
        'unmatched',
    }
    assert all(f['count'] == 0 and f['deduction'] == 0 for f in result['factors'])


def test_score_from_counts_known_fixture():
    """Fixture counts → known score (documented formula).

    games=100
    missing_cover=40 → 25 * 0.40 = 10
    missing_path=10  → 20 * 0.10 = 2
    no_igdb=25       → 20 * 0.25 = 5
    stale=20         → 15 * 0.20 = 3
    unmatched=25     → 20 * 25/125 = 4
    deduction = 24 → score 76 → fair
    """
    result = score_library_health_from_counts(
        games=100,
        missing_cover=40,
        missing_path=10,
        no_igdb=25,
        stale_freshness=20,
        unmatched=25,
    )
    assert result['score'] == 76
    assert result['grade'] == 'fair'
    assert result['thin'] is False
    by_id = {f['id']: f for f in result['factors']}
    assert by_id['missing_cover']['deduction'] == 10.0
    assert by_id['missing_path']['deduction'] == 2.0
    assert by_id['no_igdb']['deduction'] == 5.0
    assert by_id['stale_freshness']['deduction'] == 3.0
    assert by_id['unmatched']['deduction'] == 4.0


def test_score_from_counts_thin_when_no_games():
    empty = score_library_health_from_counts(games=0)
    assert empty['score'] is None
    assert empty['grade'] is None
    assert empty['thin'] is True
    assert 'withheld' in (empty['note'] or '').lower()

    unmatched_only = score_library_health_from_counts(games=0, unmatched=12)
    assert unmatched_only['score'] is None
    assert unmatched_only['thin'] is True
    assert unmatched_only['factors'][-1]['id'] == 'unmatched'
    assert unmatched_only['factors'][-1]['count'] == 12


def test_score_from_counts_poor_band():
    # 100% of every game factor + unmatched half of pool → score 10 → poor
    result = score_library_health_from_counts(
        games=10,
        missing_cover=10,
        missing_path=10,
        no_igdb=10,
        stale_freshness=10,
        unmatched=10,
    )
    assert result['score'] == 10
    assert result['grade'] == 'poor'


def test_score_from_counts_scan_flagged_missing_path_deducts():
    """Scan-flagged broken paths feed the same missing_path factor → score."""
    # 5 of 10 games missing_path → 20 * 0.5 = 10 → score 90 → good
    result = score_library_health_from_counts(games=10, missing_path=5)
    assert result['score'] == 90
    assert result['grade'] == 'good'
    by_id = {f['id']: f for f in result['factors']}
    assert by_id['missing_path']['count'] == 5
    assert by_id['missing_path']['deduction'] == 10.0
    assert 'scan-flagged' in by_id['missing_path']['label']


@pytest.fixture
def health_library(db_session):
    lib = Library(name=f'HealthLib_{uuid4().hex[:6]}', platform=LibraryPlatform.PCWIN)
    db_session.add(lib)
    db_session.commit()
    return lib


@pytest.fixture
def health_admin(db_session):
    uid = str(uuid4())
    user = User(
        user_id=uid,
        name=f'HealthAdmin_{uid[:8]}',
        email=f'health_admin_{uid[:8]}@test.com',
        role='admin',
        is_email_verified=True,
        state=True,
    )
    user.set_password('testpass123')
    db_session.add(user)
    db_session.commit()
    return user


def _login(client, user):
    with client.session_transaction() as sess:
        sess['_user_id'] = str(user.id)
        sess['_fresh'] = True


def test_collect_counts_and_pulse_from_db(db_session, health_library):
    lib = health_library
    good = Game(
        uuid=str(uuid4()),
        name=f'Good_{uuid4().hex[:6]}',
        library_uuid=lib.uuid,
        full_disk_path='/tmp/health-good',
        path_status=PATH_STATUS_OK,
        igdb_id=100001 + (uuid4().int % 100000),
        cover='https://example.test/cover.jpg',
        freshness_status='current',
    )
    bad = Game(
        uuid=str(uuid4()),
        name=f'Bad_{uuid4().hex[:6]}',
        library_uuid=lib.uuid,
        full_disk_path='',
        igdb_id=None,
        cover='',
        freshness_status='behind',
    )
    custom = Game(
        uuid=str(uuid4()),
        name=f'Custom_{uuid4().hex[:6]}',
        library_uuid=lib.uuid,
        full_disk_path='/tmp/health-custom',
        igdb_id=CUSTOM_IGDB_BASE + (uuid4().int % 1000),
        cover='https://example.test/custom.jpg',
    )
    db_session.add_all([good, bad, custom])
    db_session.flush()
    db_session.add(
        Image(
            game_uuid=good.uuid,
            image_type='cover',
            url='https://example.test/cover.jpg',
            is_downloaded=True,
        )
    )
    db_session.add(
        UnmatchedFolder(
            library_uuid=lib.uuid,
            folder_path=f'/tmp/unmatched-{uuid4().hex[:8]}',
            status='Unmatched',
        )
    )
    db_session.commit()

    counts = collect_library_health_counts()
    assert counts['games'] >= 3
    assert counts['missing_path'] >= 1
    assert counts['no_igdb'] >= 2  # bad (null) + custom
    assert counts['stale_freshness'] >= 1
    assert counts['unmatched'] >= 1
    assert counts['missing_cover'] >= 1

    pulse = build_library_health_pulse()
    assert set(pulse.keys()) >= {
        'score',
        'grade',
        'factors',
        'games',
        'thin',
        'note',
        'checked_at',
    }
    assert pulse['games'] == counts['games']
    assert pulse['thin'] is False
    assert isinstance(pulse['score'], int)
    assert 0 <= pulse['score'] <= 100
    assert pulse['grade'] in ('good', 'fair', 'poor')
    expected = score_library_health_from_counts(**counts)
    assert pulse['score'] == expected['score']
    assert pulse['grade'] == expected['grade']


def test_collect_counts_includes_scan_flagged_broken_path(db_session, health_library):
    """path_status=missing with a non-empty full_disk_path counts as missing_path."""
    lib = health_library
    flagged = Game(
        uuid=str(uuid4()),
        name=f'FlaggedMissing_{uuid4().hex[:6]}',
        library_uuid=lib.uuid,
        full_disk_path=f'/tmp/was-here-{uuid4().hex}',
        path_status=PATH_STATUS_MISSING,
        igdb_id=100001 + (uuid4().int % 100000),
        cover='https://example.test/cover.jpg',
        freshness_status='current',
    )
    db_session.add(flagged)
    db_session.flush()
    db_session.add(
        Image(
            game_uuid=flagged.uuid,
            image_type='cover',
            url='https://example.test/cover.jpg',
            is_downloaded=True,
        )
    )
    db_session.commit()

    counts = collect_library_health_counts()
    assert counts['missing_path'] >= 1

    # Prefer tracked signal — no filesystem check required for score_game.
    result = score_game(flagged)
    codes = {i['code'] for i in result['issues']}
    assert 'broken_path' in codes

    pulse = build_library_health_pulse()
    expected = score_library_health_from_counts(**counts)
    assert pulse['score'] == expected['score']


def test_refresh_game_path_status_persists(tmp_path, db_session, health_library):
    present = tmp_path / 'present_game'
    present.mkdir()
    gone = Game(
        uuid=str(uuid4()),
        name=f'Gone_{uuid4().hex[:6]}',
        library_uuid=health_library.uuid,
        full_disk_path=str(tmp_path / 'does-not-exist'),
    )
    ok = Game(
        uuid=str(uuid4()),
        name=f'Ok_{uuid4().hex[:6]}',
        library_uuid=health_library.uuid,
        full_disk_path=str(present),
    )
    empty = Game(
        uuid=str(uuid4()),
        name=f'Empty_{uuid4().hex[:6]}',
        library_uuid=health_library.uuid,
        full_disk_path='',
    )
    db_session.add_all([gone, ok, empty])
    db_session.commit()

    assert refresh_game_path_status(gone) == PATH_STATUS_MISSING
    assert gone.path_status == PATH_STATUS_MISSING
    assert refresh_game_path_status(ok) == PATH_STATUS_OK
    assert ok.path_status == PATH_STATUS_OK
    assert refresh_game_path_status(empty) == 'empty'
    assert empty.path_status == 'empty'
    db_session.commit()


def test_clear_restored_missing_path_status_missing_to_ok(
    tmp_path, db_session, health_library
):
    """Restored folder clears path_status missing→ok without a full rescan."""
    restored = tmp_path / 'restored_game'
    restored.mkdir()
    still_gone = tmp_path / 'still_gone'
    game = Game(
        uuid=str(uuid4()),
        name=f'Restored_{uuid4().hex[:6]}',
        library_uuid=health_library.uuid,
        full_disk_path=str(restored),
        path_status=PATH_STATUS_MISSING,
    )
    other = Game(
        uuid=str(uuid4()),
        name=f'StillGone_{uuid4().hex[:6]}',
        library_uuid=health_library.uuid,
        full_disk_path=str(still_gone),
        path_status=PATH_STATUS_MISSING,
    )
    db_session.add_all([game, other])
    db_session.commit()

    cleared = clear_restored_missing_path_status(
        [str(restored)],
        library_uuid=health_library.uuid,
    )
    db_session.commit()

    assert cleared == 1
    assert game.path_status == PATH_STATUS_OK
    assert other.path_status == PATH_STATUS_MISSING


def test_admin_library_health_endpoint(client, health_admin):
    _login(client, health_admin)
    resp = client.get('/admin/api/library/health')
    assert resp.status_code == 200
    body = resp.get_json()
    assert 'score' in body
    assert 'grade' in body
    assert isinstance(body['factors'], list)
    assert body['thin'] in (True, False)
