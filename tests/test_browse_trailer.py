"""Browse tiles include a fill-only trailer_embed_url when the title has video."""

from types import SimpleNamespace
from uuid import uuid4

import pytest
from sqlalchemy import delete, select

from oneirodex.models import Game, GlobalSettings, Library, User
from oneirodex.platform import LibraryPlatform
from oneirodex.utils.game_details_payload import browse_trailer_fields


def test_browse_trailer_fields_youtube_watch_becomes_embed():
    game = SimpleNamespace(video_urls='https://www.youtube.com/watch?v=70N5mY4iNAw')
    assert browse_trailer_fields(game) == {
        'trailer_embed_url': 'https://www.youtube.com/embed/70N5mY4iNAw',
    }


def test_browse_trailer_fields_csv_takes_first_honest_url():
    game = SimpleNamespace(
        video_urls=(
            'https://youtu.be/70N5mY4iNAw,'
            'https://www.youtube.com/watch?v=secondVideo'
        ),
    )
    assert browse_trailer_fields(game)['trailer_embed_url'] == (
        'https://www.youtube.com/embed/70N5mY4iNAw'
    )


def test_browse_trailer_fields_omitted_when_empty():
    assert browse_trailer_fields(SimpleNamespace(video_urls=None)) == {}
    assert browse_trailer_fields(SimpleNamespace(video_urls='')) == {}
    assert browse_trailer_fields(SimpleNamespace()) == {}


def test_browse_trailer_fields_skips_steam_html():
    game = SimpleNamespace(
        video_urls='<iframe src="https://store.steampowered.com/widget/570"></iframe>',
    )
    assert browse_trailer_fields(game) == {}


def test_browse_trailer_fields_accepts_direct_mp4():
    game = SimpleNamespace(video_urls='https://cdn.example.com/trailers/a.mp4')
    assert browse_trailer_fields(game) == {
        'trailer_embed_url': 'https://cdn.example.com/trailers/a.mp4',
    }


def test_browse_trailer_fields_does_not_invent_from_steam_app_id():
    game = SimpleNamespace(video_urls=None, steam_app_id=570)
    assert browse_trailer_fields(game) == {}


@pytest.fixture
def trailer_user(db_session):
    tag = uuid4().hex[:8]
    user = User(
        name=f'trail-{tag}',
        email=f'trail-{tag}@example.com',
        password_hash='unused',
        role='user',
        user_id=str(uuid4()),
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def trailer_library(db_session):
    rows = db_session.execute(select(GlobalSettings).order_by(GlobalSettings.id)).scalars().all()
    if len(rows) > 1:
        db_session.execute(delete(GlobalSettings).where(GlobalSettings.id != rows[0].id))
        db_session.commit()
    elif not rows:
        db_session.add(GlobalSettings())
        db_session.commit()

    library = Library(
        name=f'Trailer Lib {uuid4().hex[:8]}',
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


def _game(db_session, library, name, video_urls=None):
    game = Game(
        uuid=str(uuid4()),
        name=name,
        library_uuid=library.uuid,
        full_disk_path=f'/test/trailer/{uuid4().hex}',
        video_urls=video_urls,
    )
    db_session.add(game)
    db_session.commit()
    return game


def _row_named(response, name):
    return [g for g in response.get_json()['games'] if g['name'] == name]


def test_browse_games_includes_trailer_embed_when_video_urls_present(
    client, db_session, trailer_user, trailer_library,
):
    with_trailer = _game(
        db_session,
        trailer_library,
        f'Has Trailer {uuid4().hex[:8]}',
        video_urls='https://www.youtube.com/watch?v=70N5mY4iNAw',
    )
    without = _game(
        db_session,
        trailer_library,
        f'No Trailer {uuid4().hex[:8]}',
        video_urls=None,
    )
    _login(client, trailer_user)
    response = client.get('/browse_games?per_page=50')
    assert response.status_code == 200
    with_row = _row_named(response, with_trailer.name)
    without_row = _row_named(response, without.name)
    assert len(with_row) == 1
    assert with_row[0]['trailer_embed_url'] == 'https://www.youtube.com/embed/70N5mY4iNAw'
    assert 'video_urls' not in with_row[0]
    assert len(without_row) == 1
    assert 'trailer_embed_url' not in without_row[0]


def test_browse_games_omits_trailer_for_steam_html(
    client, db_session, trailer_user, trailer_library,
):
    game = _game(
        db_session,
        trailer_library,
        f'Steam Html {uuid4().hex[:8]}',
        video_urls='<iframe src="https://store.steampowered.com/widget/570"></iframe>',
    )
    _login(client, trailer_user)
    response = client.get('/browse_games?per_page=50')
    assert response.status_code == 200
    rows = _row_named(response, game.name)
    assert len(rows) == 1
    assert 'trailer_embed_url' not in rows[0]
