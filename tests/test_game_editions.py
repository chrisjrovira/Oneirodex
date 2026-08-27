"""Preview editions payload: systems plus store and trailer links browse cannot carry.

GOG / Epic live on Game.urls and the trailer on Game.video_urls, which the grid
never sends per tile. The preview already asks for editions once; wrapping those
links there is how the popup shows the same marks the details page does.
"""

from types import SimpleNamespace
from uuid import uuid4

from gametheca.models import Game, GameURL, Library, User
from gametheca.platform import LibraryPlatform
from gametheca.utils.game_editions import (
    editions_preview_payload,
    store_links_for_games,
)
from gametheca.utils.library_acl import set_user_library_allowlist


class _Url(SimpleNamespace):
    pass


def test_store_links_merge_gog_and_epic_across_copies():
    pc = SimpleNamespace(
        steam_url='https://store.steampowered.com/app/504230',
        steam_app_id=504230,
        url_igdb=None,
        url=None,
        urls=[_Url(url_type='gog', url='https://www.gog.com/game/celeste')],
    )
    console = SimpleNamespace(
        steam_url=None,
        steam_app_id=None,
        url_igdb='https://www.igdb.com/games/celeste',
        url=None,
        urls=[_Url(url_type='epic', url='https://store.epicgames.com/p/celeste')],
    )
    links = store_links_for_games([pc, console])
    by_type = {row['type']: row['url'] for row in links}
    assert by_type['steam'] == 'https://store.steampowered.com/app/504230'
    assert by_type['gog'] == 'https://www.gog.com/game/celeste'
    assert by_type['epic'] == 'https://store.epicgames.com/p/celeste'
    assert by_type['igdb'] == 'https://www.igdb.com/games/celeste'


def test_store_links_skip_javascript_and_dedupe():
    copy = SimpleNamespace(
        steam_url='https://store.steampowered.com/app/1',
        steam_app_id=1,
        url_igdb=None,
        url=None,
        urls=[
            _Url(url_type='steam', url='https://store.steampowered.com/app/1'),
            _Url(url_type='gog', url='javascript:alert(1)'),
            _Url(url_type='gog', url='https://www.gog.com/game/a'),
        ],
    )
    links = store_links_for_games([copy])
    assert [row['url'] for row in links] == [
        'https://store.steampowered.com/app/1',
        'https://www.gog.com/game/a',
    ]


def test_store_links_build_steam_from_app_id_when_url_missing():
    copy = SimpleNamespace(
        steam_url='Not available',
        steam_app_id=620,
        url_igdb=None,
        url=None,
        urls=[],
    )
    links = store_links_for_games([copy])
    assert links == [{
        'type': 'steam',
        'url': 'https://store.steampowered.com/app/620',
    }]


def test_store_links_include_one_youtube_from_video_urls():
    copy = SimpleNamespace(
        steam_url=None,
        steam_app_id=None,
        url_igdb=None,
        url=None,
        urls=[],
        video_urls=(
            'https://www.youtube.com/watch?v=70N5mY4iNAw,'
            'https://www.youtube.com/watch?v=second'
        ),
    )
    links = store_links_for_games([copy])
    assert links == [{
        'type': 'youtube',
        'url': 'https://www.youtube.com/watch?v=70N5mY4iNAw',
    }]


def _library(db_session, platform):
    library = Library(
        name=f'{platform.name} {uuid4().hex[:8]}',
        platform=platform,
        display_order=1,
    )
    db_session.add(library)
    db_session.commit()
    return library


def _game(db_session, library, name):
    game = Game(
        uuid=str(uuid4()),
        name=name,
        library_uuid=library.uuid,
        full_disk_path=f'/test/editions/{uuid4().hex}',
    )
    db_session.add(game)
    db_session.commit()
    return game


def _user(db_session, role='user'):
    tag = uuid4().hex[:8]
    user = User(
        name=f'editions-{role}-{tag}',
        email=f'editions-{role}-{tag}@example.com',
        password_hash='unused',
        role=role,
        user_id=str(uuid4()),
        state=True,
    )
    user.set_password('password123')
    db_session.add(user)
    db_session.commit()
    return user


def _login(client, user):
    with client.session_transaction() as sess:
        sess['_user_id'] = str(user.id)
        sess['_fresh'] = True


def test_editions_api_requires_login(client, db_session, configured_install):
    library = _library(db_session, LibraryPlatform.PCWIN)
    game = _game(db_session, library, f'Login probe {uuid4().hex[:8]}')
    response = client.get(f'/api/games/{game.uuid}/editions')
    assert response.status_code == 302


def test_editions_api_merges_store_links_from_sibling_copy(
    client, db_session,
):
    user = _user(db_session)
    title = f'Celeste {uuid4().hex[:8]}'
    pc = _library(db_session, LibraryPlatform.PCWIN)
    nes = _library(db_session, LibraryPlatform.NES)
    pc_copy = _game(db_session, pc, title)
    nes_copy = _game(db_session, nes, title)
    pc_copy.steam_url = 'https://store.steampowered.com/app/504230'
    db_session.add(GameURL(
        game_uuid=pc_copy.uuid,
        url_type='gog',
        url='https://www.gog.com/game/celeste',
    ))
    db_session.add(GameURL(
        game_uuid=nes_copy.uuid,
        url_type='epic',
        url='https://store.epicgames.com/p/celeste',
    ))
    db_session.commit()

    _login(client, user)
    response = client.get(f'/api/games/{nes_copy.uuid}/editions')
    assert response.status_code == 200
    body = response.get_json()
    assert body['ok'] is True
    assert body['system_count'] == 2
    types = {row['type'] for row in body['urls']}
    assert 'gog' in types
    assert 'epic' in types
    assert 'steam' in types
    assert {row['uuid'] for row in body['editions']} == {
        pc_copy.uuid, nes_copy.uuid,
    }


def test_editions_payload_does_not_leak_restricted_copy_urls(db_session):
    adult = _user(db_session, role='user')
    child = _user(db_session, role='child')
    title = f'Celeste {uuid4().hex[:8]}'
    pc = _library(db_session, LibraryPlatform.PCWIN)
    nes = _library(db_session, LibraryPlatform.NES)
    pc_copy = _game(db_session, pc, title)
    nes_copy = _game(db_session, nes, title)
    db_session.add(GameURL(
        game_uuid=pc_copy.uuid,
        url_type='gog',
        url='https://www.gog.com/game/celeste',
    ))
    db_session.add(GameURL(
        game_uuid=nes_copy.uuid,
        url_type='epic',
        url='https://store.epicgames.com/p/celeste',
    ))
    db_session.commit()
    set_user_library_allowlist(child.id, [pc.uuid])
    db_session.commit()

    adult_body = editions_preview_payload(pc_copy, adult)
    child_body = editions_preview_payload(pc_copy, child)

    adult_types = {row['type'] for row in adult_body['urls']}
    child_types = {row['type'] for row in child_body['urls']}
    assert adult_types == {'gog', 'epic'}
    assert child_types == {'gog'}
    assert {row['uuid'] for row in child_body['editions']} == {pc_copy.uuid}
