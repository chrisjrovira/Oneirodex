"""Content deny-list (genre/theme) unit + API tests for child accounts."""

from uuid import uuid4

import pytest
from flask_login import login_user
from sqlalchemy import select

from oneirodex.models import Game, Genre, Library, Theme, User
from oneirodex.models import Game as GameModel
from oneirodex.platform import LibraryPlatform
from oneirodex.utils.library_acl import (
    apply_game_access_filters,
    apply_game_content_filters,
    denied_genre_names,
    set_user_content_filters,
    set_user_library_allowlist,
    user_can_access_game,
)


def _get_or_create_genre(db_session, name: str) -> Genre:
    existing = db_session.execute(select(Genre).filter_by(name=name)).scalars().first()
    if existing:
        return existing
    genre = Genre(name=name)
    db_session.add(genre)
    db_session.flush()
    return genre


def _get_or_create_theme(db_session, name: str) -> Theme:
    existing = db_session.execute(select(Theme).filter_by(name=name)).scalars().first()
    if existing:
        return existing
    theme = Theme(name=name)
    db_session.add(theme)
    db_session.flush()
    return theme


@pytest.fixture
def lib(db_session):
    library = Library(name=f'FilterLib_{uuid4().hex[:6]}', platform=LibraryPlatform.PCWIN)
    db_session.add(library)
    db_session.commit()
    return library


@pytest.fixture
def child(db_session):
    uid = str(uuid4())
    user = User(
        name=f'filterchild_{uid[:8]}',
        email=f'filterchild_{uid[:8]}@example.com',
        role='child',
        user_id=uid,
        state=True,
    )
    user.set_password('password123')
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def adult(db_session):
    uid = str(uuid4())
    user = User(
        name=f'filteruser_{uid[:8]}',
        email=f'filteruser_{uid[:8]}@example.com',
        role='user',
        user_id=uid,
        state=True,
    )
    user.set_password('password123')
    db_session.add(user)
    db_session.commit()
    return user


def _login(client, app, user):
    with client.session_transaction() as sess:
        sess['_user_id'] = str(user.get_id())
        sess['_fresh'] = True
    with app.test_request_context():
        login_user(user)


def test_empty_denylist_has_no_effect(db_session, child, lib, adult):
    set_user_library_allowlist(child.id, [lib.uuid])
    db_session.commit()

    genre = _get_or_create_genre(db_session, f'Puzzle_{uuid4().hex[:4]}')
    game = Game(
        name=f'Puzzle Game {uuid4().hex[:6]}',
        library_uuid=lib.uuid,
        full_disk_path='/tmp/' + uuid4().hex,
    )
    game.genres.append(genre)
    db_session.add(game)
    db_session.commit()

    assert denied_genre_names(child) == set()
    assert user_can_access_game(child, game)
    assert user_can_access_game(adult, game)

    q = apply_game_content_filters(select(GameModel), child)
    names = {g.name for g in db_session.execute(q).scalars().all()}
    assert game.name in names


def test_denied_genre_filters_games_case_insensitive(db_session, child, lib, adult):
    set_user_library_allowlist(child.id, [lib.uuid])
    set_user_content_filters(child.id, ['Horror'], [])
    db_session.commit()

    horror = _get_or_create_genre(db_session, 'Horror')
    puzzle = _get_or_create_genre(db_session, 'Puzzle')

    blocked = Game(
        name=f'Scary Game {uuid4().hex[:6]}',
        library_uuid=lib.uuid,
        full_disk_path='/tmp/' + uuid4().hex,
    )
    blocked.genres.append(horror)
    allowed = Game(
        name=f'Calm Game {uuid4().hex[:6]}',
        library_uuid=lib.uuid,
        full_disk_path='/tmp/' + uuid4().hex,
    )
    allowed.genres.append(puzzle)
    db_session.add_all([blocked, allowed])
    db_session.commit()

    assert not user_can_access_game(child, blocked)
    assert user_can_access_game(child, allowed)
    assert user_can_access_game(adult, blocked)

    q = apply_game_access_filters(select(GameModel), child)
    names = {g.name for g in db_session.execute(q).scalars().all()}
    assert allowed.name in names
    assert blocked.name not in names


def test_denied_theme_filters_games(db_session, child, lib):
    set_user_library_allowlist(child.id, [lib.uuid])
    set_user_content_filters(child.id, [], ['Mature'])
    db_session.commit()

    mature = _get_or_create_theme(db_session, 'Mature')
    family = _get_or_create_theme(db_session, 'Family')

    blocked = Game(
        name=f'Adult Theme Game {uuid4().hex[:6]}',
        library_uuid=lib.uuid,
        full_disk_path='/tmp/' + uuid4().hex,
    )
    blocked.themes.append(mature)
    allowed = Game(
        name=f'Family Theme Game {uuid4().hex[:6]}',
        library_uuid=lib.uuid,
        full_disk_path='/tmp/' + uuid4().hex,
    )
    allowed.themes.append(family)
    db_session.add_all([blocked, allowed])
    db_session.commit()

    assert not user_can_access_game(child, blocked)
    assert user_can_access_game(child, allowed)


def test_search_hides_denied_genre_games(client, app, db_session, child, lib):
    set_user_library_allowlist(child.id, [lib.uuid])
    set_user_content_filters(child.id, ['Shooter'], [])
    db_session.commit()

    shooter = _get_or_create_genre(db_session, 'Shooter')
    hidden = Game(
        name=f'Hidden Shooter Title {uuid4().hex[:6]}',
        library_uuid=lib.uuid,
        full_disk_path='/tmp/' + uuid4().hex,
    )
    hidden.genres.append(shooter)
    db_session.add(hidden)
    db_session.commit()

    _login(client, app, child)
    with client:
        search = client.get(f'/api/search?query={hidden.name.split()[0]}')
        assert search.status_code == 200
        assert all(item.get('uuid') != hidden.uuid for item in search.get_json())

        details = client.get(f'/game_details/{hidden.uuid}')
        assert details.status_code == 403
