from uuid import uuid4

import pytest

from gametheca.models import (
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
    assert response.get_json() == {
        'games': [
            {
                'uuid': favorite_game.uuid,
                'name': 'Favorite API Game',
                'cover_url': '/static/library/images/favorite-cover.jpg',
                'is_favorite': True,
                'has_local_override': False,
                'is_vr': False,
                'genres': [],
                'user_status': 'beaten',
            }
        ]
    }
