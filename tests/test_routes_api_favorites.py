from uuid import uuid4

import pytest

from oneirodex.models import (
    Game,
    Image,
    Library,
    LibraryPlatform,
    User,
    user_game_status,
)


@pytest.fixture
def favorite_user(db_session):
    unique = str(uuid4())
    user = User(
        name=f'favorite-user-{unique[:8]}',
        email=f'favorite-{unique[:8]}@example.com',
        password_hash='unused',
        role='user',
        user_id=unique,
        avatarpath='newstyle/avatar_default.jpg',
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def favorite_game(db_session, favorite_user):
    library = Library(name=f'Favorites {uuid4()}', platform=LibraryPlatform.PCWIN)
    game = Game(
        name='Favorite API Game',
        full_disk_path='/tmp/favorite-api-game',
        library=library,
    )
    favorite_user.favorites.append(game)
    db_session.add(
        Image(game=game, image_type='cover', url='favorite-cover.jpg')
    )
    db_session.flush()
    db_session.execute(
        user_game_status.insert().values(
            user_id=favorite_user.id,
            game_uuid=game.uuid,
            status='beaten',
        )
    )
    db_session.commit()
    return game


def test_favorites_api_returns_browse_card_shape(
    client, favorite_user, favorite_game
):
    with client.session_transaction() as session:
        session['_user_id'] = str(favorite_user.id)
        session['_fresh'] = True

    response = client.get('/api/favorites')

    assert response.status_code == 200
    payload = response.get_json()
    assert payload['total'] == 1
    assert payload['pages'] == 1
    assert payload['current_page'] == 1
    assert len(payload['games']) == 1
    game = payload['games'][0]
    assert game['uuid'] == favorite_game.uuid
    assert game['name'] == 'Favorite API Game'
    assert game['is_favorite'] is True
    assert game['user_status'] == 'beaten'
    assert isinstance(game['cover_url'], str) and game['cover_url']


def test_favorites_api_pagination(client, favorite_user, db_session):
    library = Library(name=f'Favorites page {uuid4()}', platform=LibraryPlatform.PCWIN)
    db_session.add(library)
    db_session.flush()
    for i in range(3):
        game = Game(
            name=f'Fav Page Game {i}',
            full_disk_path=f'/tmp/fav-page-{uuid4()}',
            library_uuid=library.uuid,
        )
        db_session.add(game)
        db_session.flush()
        favorite_user.favorites.append(game)
    db_session.commit()

    with client.session_transaction() as session:
        session['_user_id'] = str(favorite_user.id)
        session['_fresh'] = True

    page1 = client.get('/api/favorites?page=1&per_page=2')
    assert page1.status_code == 200
    data1 = page1.get_json()
    assert data1['total'] == 3
    assert data1['pages'] == 2
    assert len(data1['games']) == 2

    page2 = client.get('/api/favorites?page=2&per_page=2')
    data2 = page2.get_json()
    assert data2['current_page'] == 2
    assert len(data2['games']) == 1
