"""Title substring filter on /browse_games and /api/favorites (name= / q=)."""

from uuid import uuid4

import pytest
from sqlalchemy import delete, select

from gametheca.models import Game, GlobalSettings, Library, User
from gametheca.platform import LibraryPlatform
from gametheca.utils.browse_filters import apply_name_filter


@pytest.fixture
def name_user(db_session):
    tag = uuid4().hex[:8]
    user = User(
        name=f'name-{tag}',
        email=f'name-{tag}@example.com',
        password_hash='unused',
        role='user',
        user_id=str(uuid4()),
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def name_library(db_session):
    rows = db_session.execute(select(GlobalSettings).order_by(GlobalSettings.id)).scalars().all()
    if len(rows) > 1:
        keep_id = rows[0].id
        db_session.execute(delete(GlobalSettings).where(GlobalSettings.id != keep_id))
        db_session.commit()
    elif not rows:
        db_session.add(GlobalSettings())
        db_session.commit()

    library = Library(
        name=f'Name Lib {uuid4().hex[:8]}',
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


def _seed_titles(db_session, library):
    titles = ('Alpha Quest', 'Beta Force', 'alpha raid')
    for title in titles:
        db_session.add(
            Game(
                uuid=str(uuid4()),
                name=title,
                library_uuid=library.uuid,
                full_disk_path=f'/test/name/{uuid4().hex}',
            )
        )
    db_session.commit()
    return set(titles)


def test_apply_name_filter_unit(db_session, name_library):
    _seed_titles(db_session, name_library)
    query = select(Game).where(Game.library_uuid == name_library.uuid)
    filtered = apply_name_filter(query, {'name': 'alpha'})
    names = {g.name for g in db_session.execute(filtered).scalars().all()}
    assert names == {'Alpha Quest', 'alpha raid'}


def test_browse_games_name_filter_matches(client, db_session, name_user, name_library):
    _login(client, name_user)
    _seed_titles(db_session, name_library)

    response = client.get('/browse_games?name=Quest&per_page=50')
    assert response.status_code == 200
    names = _names(response)
    assert 'Alpha Quest' in names
    assert 'Beta Force' not in names
    assert 'alpha raid' not in names


def test_browse_games_q_alias(client, db_session, name_user, name_library):
    _login(client, name_user)
    _seed_titles(db_session, name_library)

    response = client.get('/browse_games?q=Force&per_page=50')
    assert response.status_code == 200
    names = _names(response)
    assert names == {'Beta Force'}


def test_browse_games_empty_name_ignored(client, db_session, name_user, name_library):
    _login(client, name_user)
    seeded = _seed_titles(db_session, name_library)

    response = client.get('/browse_games?name=&per_page=50')
    assert response.status_code == 200
    names = _names(response)
    assert seeded.issubset(names)

    response_ws = client.get('/browse_games?name=%20%20&per_page=50')
    assert response_ws.status_code == 200
    assert seeded.issubset(_names(response_ws))


def test_browse_games_name_case_insensitive(client, db_session, name_user, name_library):
    _login(client, name_user)
    _seed_titles(db_session, name_library)

    response = client.get('/browse_games?name=ALPHA&per_page=50')
    assert response.status_code == 200
    names = _names(response)
    assert names == {'Alpha Quest', 'alpha raid'}


def test_browse_games_name_wins_over_q(client, db_session, name_user, name_library):
    _login(client, name_user)
    _seed_titles(db_session, name_library)

    response = client.get('/browse_games?name=Quest&q=Force&per_page=50')
    assert response.status_code == 200
    assert _names(response) == {'Alpha Quest'}


def test_favorites_name_filter(client, db_session, name_user, name_library):
    _login(client, name_user)
    games = []
    for title in ('Fav Alpha', 'Fav Beta'):
        game = Game(
            uuid=str(uuid4()),
            name=title,
            library_uuid=name_library.uuid,
            full_disk_path=f'/test/fav-name/{uuid4().hex}',
        )
        db_session.add(game)
        name_user.favorites.append(game)
        games.append(game)
    db_session.commit()

    response = client.get('/api/favorites?name=alpha&per_page=50')
    assert response.status_code == 200
    assert _names(response) == {'Fav Alpha'}

    response_q = client.get('/api/favorites?q=beta&per_page=50')
    assert response_q.status_code == 200
    assert _names(response_q) == {'Fav Beta'}
