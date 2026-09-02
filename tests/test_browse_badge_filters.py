"""Tests for badge chip filters on /browse_games (bug-triage O5)."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy import select

from oneirodex.models import Game, GameUpdate, Library, PlayerPerspective, User
from oneirodex.platform import LibraryPlatform
from oneirodex.utils.browse_filters import (
    NEW_IMPORT_WINDOW_DAYS,
    RELEASE_WINDOW_DAYS,
    apply_badge_filters,
)
from oneirodex.utils.secondary_scrapers import VR_PERSPECTIVE_NAME


@pytest.fixture
def badge_user(db_session):
    tag = uuid4().hex[:8]
    user = User(
        name=f'badge-{tag}',
        email=f'badge-{tag}@example.com',
        password_hash='unused',
        role='user',
        user_id=str(uuid4()),
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def badge_library(db_session):
    library = Library(
        name=f'Badge Lib {uuid4().hex[:8]}',
        platform=LibraryPlatform.PCWIN,
        display_order=1,
    )
    db_session.add(library)
    db_session.commit()
    return library


@pytest.fixture
def badge_game(db_session, badge_library):
    game = Game(
        uuid=str(uuid4()),
        name='Baseline Game',
        library_uuid=badge_library.uuid,
        full_disk_path=f'/test/badge/{uuid4().hex}',
        first_release_date=datetime(2020, 1, 1, tzinfo=timezone.utc),
        date_identified=datetime(2020, 1, 1, tzinfo=timezone.utc),
    )
    db_session.add(game)
    db_session.commit()
    return game


def _login(client, user):
    with client.session_transaction() as sess:
        sess['_user_id'] = str(user.id)
        sess['_fresh'] = True


def _names(response):
    return {g['name'] for g in response.get_json()['games']}


def test_browse_games_is_vr_filter(client, db_session, badge_user, badge_game, badge_library):
    _login(client, badge_user)
    vr = db_session.execute(
        select(PlayerPerspective).where(PlayerPerspective.name == VR_PERSPECTIVE_NAME)
    ).scalar_one_or_none()
    if vr is None:
        vr = PlayerPerspective(name=VR_PERSPECTIVE_NAME)
        db_session.add(vr)
        db_session.flush()
    vr_game = Game(
        uuid=str(uuid4()),
        name='VR Only Title',
        library_uuid=badge_library.uuid,
        full_disk_path=f'/test/vr/{uuid4().hex}',
    )
    vr_game.player_perspectives.append(vr)
    db_session.add(vr_game)
    db_session.commit()

    response = client.get('/browse_games?is_vr=1&per_page=50')
    assert response.status_code == 200
    names = _names(response)
    assert 'VR Only Title' in names
    assert badge_game.name not in names


def test_browse_games_freshness_behind_filter(
    client, db_session, badge_user, badge_game, badge_library,
):
    _login(client, badge_user)
    behind = Game(
        uuid=str(uuid4()),
        name='Behind Title',
        library_uuid=badge_library.uuid,
        full_disk_path=f'/test/behind/{uuid4().hex}',
        freshness_status='behind',
    )
    heuristic = Game(
        uuid=str(uuid4()),
        name='Heuristic Behind',
        library_uuid=badge_library.uuid,
        full_disk_path=f'/test/heur/{uuid4().hex}',
        freshness_status='heuristic_behind',
    )
    db_session.add_all([behind, heuristic])
    db_session.commit()

    response = client.get('/browse_games?freshness_behind=1&per_page=50')
    assert response.status_code == 200
    names = _names(response)
    assert 'Behind Title' in names
    assert 'Heuristic Behind' in names
    assert badge_game.name not in names


def test_browse_games_has_updates_includes_local_update_rows(
    client, db_session, badge_user, badge_game, badge_library,
):
    _login(client, badge_user)
    updated = Game(
        uuid=str(uuid4()),
        name='Local Update Title',
        library_uuid=badge_library.uuid,
        full_disk_path=f'/test/upd/{uuid4().hex}',
    )
    db_session.add(updated)
    db_session.flush()
    db_session.add(
        GameUpdate(
            game_uuid=updated.uuid,
            file_path=f'/test/upd/{uuid4().hex}/patch.zip',
        )
    )
    db_session.commit()

    response = client.get('/browse_games?has_updates=1&per_page=50')
    assert response.status_code == 200
    names = _names(response)
    assert 'Local Update Title' in names
    assert badge_game.name not in names


def test_browse_games_new_import_filter(
    client, db_session, badge_user, badge_game, badge_library,
):
    _login(client, badge_user)
    now = datetime.now(timezone.utc)
    fresh = Game(
        uuid=str(uuid4()),
        name='Fresh Import',
        library_uuid=badge_library.uuid,
        full_disk_path=f'/test/new/{uuid4().hex}',
        date_identified=now - timedelta(days=2),
    )
    old = Game(
        uuid=str(uuid4()),
        name='Old Import',
        library_uuid=badge_library.uuid,
        full_disk_path=f'/test/old/{uuid4().hex}',
        date_identified=now - timedelta(days=NEW_IMPORT_WINDOW_DAYS + 5),
    )
    db_session.add_all([fresh, old])
    db_session.commit()

    response = client.get('/browse_games?new_import=1&per_page=50')
    assert response.status_code == 200
    names = _names(response)
    assert 'Fresh Import' in names
    assert 'Old Import' not in names
    assert badge_game.name not in names


def test_browse_games_recent_release_filter(
    client, db_session, badge_user, badge_game, badge_library,
):
    _login(client, badge_user)
    now = datetime.now(timezone.utc)
    recent = Game(
        uuid=str(uuid4()),
        name='Recent Release',
        library_uuid=badge_library.uuid,
        full_disk_path=f'/test/rel/{uuid4().hex}',
        first_release_date=now - timedelta(days=5),
    )
    stale = Game(
        uuid=str(uuid4()),
        name='Stale Release',
        library_uuid=badge_library.uuid,
        full_disk_path=f'/test/stale/{uuid4().hex}',
        first_release_date=now - timedelta(days=RELEASE_WINDOW_DAYS + 10),
    )
    db_session.add_all([recent, stale])
    db_session.commit()

    response = client.get('/browse_games?recent_release=1&per_page=50')
    assert response.status_code == 200
    names = _names(response)
    assert 'Recent Release' in names
    assert 'Stale Release' not in names
    assert badge_game.name not in names


def test_apply_badge_filters_helper_noop(db_session, badge_game):
    query = select(Game)
    same = apply_badge_filters(query, {})
    assert same is not None
    rows = db_session.execute(same).scalars().all()
    assert any(g.uuid == badge_game.uuid for g in rows)


def test_browse_games_needs_translation_filter(
    client, db_session, badge_user, badge_game, badge_library,
):
    from oneirodex.models import UserPreference

    _login(client, badge_user)
    prefs = UserPreference(user_id=badge_user.id, preferred_game_locale='en-US')
    db_session.add(prefs)

    jp = Game(
        uuid=str(uuid4()),
        name='Japan Only ROM',
        library_uuid=badge_library.uuid,
        full_disk_path=f'/test/jp/{uuid4().hex}',
        rom_region='JPN',
        rom_languages='ja',
        has_english=False,
    )
    usa = Game(
        uuid=str(uuid4()),
        name='USA English ROM',
        library_uuid=badge_library.uuid,
        full_disk_path=f'/test/usa/{uuid4().hex}',
        rom_region='USA',
        rom_languages='en',
        has_english=True,
    )
    unknown = Game(
        uuid=str(uuid4()),
        name='Unknown Lang ROM',
        library_uuid=badge_library.uuid,
        full_disk_path=f'/test/unk/{uuid4().hex}',
        rom_region='EUR',
        rom_languages=None,
    )
    db_session.add_all([jp, usa, unknown])
    db_session.commit()

    response = client.get('/browse_games?needs_translation=1&per_page=50')
    assert response.status_code == 200
    names = _names(response)
    assert 'Japan Only ROM' in names
    assert 'USA English ROM' not in names
    assert 'Unknown Lang ROM' not in names
    assert badge_game.name not in names

    payload = response.get_json()['games']
    jp_row = next(g for g in payload if g['name'] == 'Japan Only ROM')
    assert jp_row['needs_translation'] is True
    assert jp_row['rom_region'] == 'JPN'


def test_browse_games_includes_patch_flag(
    client, db_session, badge_user, badge_library,
):
    from oneirodex.models import GameExtra

    _login(client, badge_user)
    patched = Game(
        uuid=str(uuid4()),
        name='Patched Title',
        library_uuid=badge_library.uuid,
        full_disk_path=f'/test/patch/{uuid4().hex}',
        rom_region='JPN',
        rom_languages='ja',
    )
    db_session.add(patched)
    db_session.flush()
    db_session.add(
        GameExtra(
            game_uuid=patched.uuid,
            file_path=f'/test/patch/{uuid4().hex}/en.bps',
            extra_kind='translation_patch',
            patch_format='bps',
            target_language='en',
        )
    )
    db_session.commit()

    response = client.get(
        f'/browse_games?library_uuid={badge_library.uuid}&per_page=100&sort_by=name'
    )
    assert response.status_code == 200
    games = response.get_json()['games']
    row = next((g for g in games if g['name'] == 'Patched Title'), None)
    assert row is not None, f"Patched Title missing from {[g['name'] for g in games]}"
    assert row['has_translation_patch'] is True
    assert row['needs_translation'] is True
