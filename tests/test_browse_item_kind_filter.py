"""Tests for item_kind query filter on /browse_games (and parse helpers)."""

from uuid import uuid4

import pytest
from sqlalchemy import delete, select

from gametheca.models import Game, GlobalSettings, Library, User
from gametheca.platform import LibraryPlatform
from gametheca.utils.browse_filters import apply_item_kind_filter
from gametheca.utils.item_kind import parse_item_kinds_param


@pytest.fixture
def kind_user(db_session):
    tag = uuid4().hex[:8]
    user = User(
        name=f'kind-{tag}',
        email=f'kind-{tag}@example.com',
        password_hash='unused',
        role='user',
        user_id=str(uuid4()),
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def kind_library(db_session):
    # browse_games uses scalar_one_or_none(GlobalSettings); dirty test DBs may
    # have duplicates from other suites — keep a single row for route smoke.
    rows = db_session.execute(select(GlobalSettings).order_by(GlobalSettings.id)).scalars().all()
    if len(rows) > 1:
        keep_id = rows[0].id
        db_session.execute(delete(GlobalSettings).where(GlobalSettings.id != keep_id))
        db_session.commit()
    elif not rows:
        db_session.add(GlobalSettings())
        db_session.commit()

    library = Library(
        name=f'Kind Lib {uuid4().hex[:8]}',
        platform=LibraryPlatform.PCWIN,
        display_order=1,
    )
    db_session.add(library)
    db_session.commit()
    return library


def _login(client, user):
    with client.session_transaction() as sess:
        sess['_user_id'] = str(user.id)
        sess['_fresh'] = True


def _names(response):
    return {g['name'] for g in response.get_json()['games']}


def _seed_kinds(db_session, library):
    rows = [
        ('Kind Game', 'game'),
        ('Kind Experience', 'experience'),
        ('Kind Emulator', 'emulator'),
        ('Kind Tool', 'tool'),
    ]
    for name, kind in rows:
        db_session.add(
            Game(
                uuid=str(uuid4()),
                name=name,
                library_uuid=library.uuid,
                full_disk_path=f'/test/kind/{uuid4().hex}',
                item_kind=kind,
            )
        )
    db_session.commit()
    return {name for name, _ in rows}


def test_parse_item_kinds_param_omit_and_list():
    assert parse_item_kinds_param(None) is None
    assert parse_item_kinds_param('') is None
    assert parse_item_kinds_param('   ') is None
    assert parse_item_kinds_param('emulator') == frozenset({'emulator'})
    assert parse_item_kinds_param('game,tool') == frozenset({'game', 'tool'})
    assert parse_item_kinds_param('Experience;EMU') == frozenset({'experience', 'emulator'})
    assert parse_item_kinds_param('utility,software') == frozenset({'tool'})
    assert parse_item_kinds_param('nope') == frozenset()


def test_browse_games_item_kind_omit_returns_all_kinds(
    client, db_session, kind_user, kind_library,
):
    _login(client, kind_user)
    expected = _seed_kinds(db_session, kind_library)

    response = client.get(
        f'/browse_games?library_uuid={kind_library.uuid}&per_page=100'
    )
    assert response.status_code == 200
    names = _names(response)
    assert expected.issubset(names)


def test_browse_games_item_kind_single(
    client, db_session, kind_user, kind_library,
):
    _login(client, kind_user)
    _seed_kinds(db_session, kind_library)

    response = client.get(
        f'/browse_games?library_uuid={kind_library.uuid}&per_page=100&item_kind=emulator'
    )
    assert response.status_code == 200
    names = _names(response)
    assert names == {'Kind Emulator'}


def test_browse_games_item_kind_comma_list(
    client, db_session, kind_user, kind_library,
):
    _login(client, kind_user)
    _seed_kinds(db_session, kind_library)

    response = client.get(
        f'/browse_games?library_uuid={kind_library.uuid}'
        f'&per_page=100&item_kind=experience,tool'
    )
    assert response.status_code == 200
    names = _names(response)
    assert names == {'Kind Experience', 'Kind Tool'}


def test_browse_games_content_kind_alias(
    client, db_session, kind_user, kind_library,
):
    _login(client, kind_user)
    _seed_kinds(db_session, kind_library)

    response = client.get(
        f'/browse_games?library_uuid={kind_library.uuid}&per_page=100&content_kind=tool'
    )
    assert response.status_code == 200
    assert _names(response) == {'Kind Tool'}


def test_browse_games_item_kind_unknown_only_empty(
    client, db_session, kind_user, kind_library,
):
    _login(client, kind_user)
    _seed_kinds(db_session, kind_library)

    response = client.get(
        f'/browse_games?library_uuid={kind_library.uuid}&per_page=100&item_kind=nope'
    )
    assert response.status_code == 200
    assert _names(response) == set()


def test_apply_item_kind_filter_unit(db_session, kind_library):
    _seed_kinds(db_session, kind_library)
    base = select(Game).where(Game.library_uuid == kind_library.uuid)

    all_q = apply_item_kind_filter(base, {})
    assert {g.name for g in db_session.execute(all_q).scalars()} == {
        'Kind Game', 'Kind Experience', 'Kind Emulator', 'Kind Tool',
    }

    emu_q = apply_item_kind_filter(base, {'item_kind': 'emulator'})
    assert {g.name for g in db_session.execute(emu_q).scalars()} == {'Kind Emulator'}
