"""Store ownership sync: matching logic and browse payload tests."""

from unittest.mock import patch
from uuid import uuid4

import pytest
from flask_login import login_user
from sqlalchemy import select

from gametheca.models import Game, GlobalSettings, Library, StoreAccount, User, UserOwnedTitle
from gametheca.platform import LibraryPlatform
from gametheca.utils.store_ownership import (
    connect_gog_account,
    disconnect_epic_account,
    disconnect_gog_account,
    import_epic_csv,
    import_gog_csv,
    import_meta_quest_csv,
    import_steam_csv,
    match_title_to_library_game,
    ownership_flags,
    upsert_owned_title,
)


@pytest.fixture
def lib(db_session):
    library = Library(name=f'OwnLib_{uuid4().hex[:6]}', platform=LibraryPlatform.PCWIN)
    db_session.add(library)
    db_session.commit()
    return library


@pytest.fixture
def user(db_session):
    uid = str(uuid4())
    row = User(
        name=f'ownuser_{uid[:8]}',
        email=f'ownuser_{uid[:8]}@example.com',
        role='user',
        user_id=uid,
        state=True,
    )
    row.set_password('password123')
    db_session.add(row)
    db_session.commit()
    return row


def _login(client, app, user):
    with client.session_transaction() as sess:
        sess['_user_id'] = str(user.get_id())
        sess['_fresh'] = True
    with app.test_request_context():
        login_user(user)


def _unique_steam_app_id() -> int:
    """Avoid collisions with leftover rows in the shared test DB."""
    return 700_000_000 + (uuid4().int % 99_000_000)


def test_match_steam_app_id(db_session, lib):
    game_uuid = str(uuid4())
    app_id = _unique_steam_app_id()
    game = Game(
        uuid=game_uuid,
        name='Portal 2',
        library_uuid=lib.uuid,
        steam_app_id=app_id,
    )
    db_session.add(game)
    db_session.commit()

    assert match_title_to_library_game('steam', str(app_id)) == game_uuid
    assert match_title_to_library_game('steam', '999999999') is None
    assert match_title_to_library_game('gog', '1207658924', 'The Witcher 3') is None


def test_match_gog_epic_by_unique_name(db_session, lib):
    game_uuid = str(uuid4())
    title = f'Cyberpunk Test {uuid4().hex[:8]}'
    game = Game(
        uuid=game_uuid,
        name=title,
        library_uuid=lib.uuid,
    )
    db_session.add(game)
    db_session.commit()

    assert match_title_to_library_game('gog', '1096317825', title) == game_uuid
    assert match_title_to_library_game('epic', 'fn', title) == game_uuid
    assert match_title_to_library_game('gog', '1096317825', title.upper()) == game_uuid
    assert match_title_to_library_game('gog', '1096317825') is None


def test_match_gog_ambiguous_name_returns_none(db_session, lib):
    name = f'Ambiguous Title {uuid4().hex[:6]}'
    db_session.add_all([
        Game(uuid=str(uuid4()), name=name, library_uuid=lib.uuid),
        Game(uuid=str(uuid4()), name=name, library_uuid=lib.uuid),
    ])
    db_session.commit()

    assert match_title_to_library_game('gog', '999', name) is None


def test_ownership_flags():
    owned = ownership_flags('abc', {'abc', 'def'})
    assert owned == {'owned': True, 'store_owned': True}
    not_owned = ownership_flags('xyz', {'abc'})
    assert not_owned == {'owned': False, 'store_owned': False}


def test_upsert_owned_title_matches_library(db_session, lib, user):
    game_uuid = str(uuid4())
    app_id = _unique_steam_app_id()
    game = Game(
        uuid=game_uuid,
        name='Half-Life 2',
        library_uuid=lib.uuid,
        steam_app_id=app_id,
    )
    db_session.add(game)
    db_session.commit()

    row = upsert_owned_title(user.id, 'steam', str(app_id), 'Half-Life 2')
    db_session.commit()
    assert row.matched_game_uuid == game_uuid


def test_import_steam_csv(db_session, lib, user):
    _ensure_global_settings(db_session, enable_store_ownership_sync=True)
    game_uuid = str(uuid4())
    app_id = _unique_steam_app_id()
    orphan_app_id = _unique_steam_app_id()
    game = Game(
        uuid=game_uuid,
        name='Dota 2',
        library_uuid=lib.uuid,
        steam_app_id=app_id,
    )
    db_session.add(game)
    db_session.commit()

    result = import_steam_csv(user.id, f'appid\n{app_id}\n{orphan_app_id}\n')
    assert result['imported'] == 2
    assert result['matched'] == 1

    rows = db_session.execute(
        select(UserOwnedTitle).filter_by(user_id=user.id, store='steam')
    ).scalars().all()
    assert len(rows) == 2


def test_import_gog_csv_matches_by_name(db_session, lib, user):
    _ensure_global_settings(db_session, enable_store_ownership_sync=True)
    game_uuid = str(uuid4())
    title = f'Divinity Test {uuid4().hex[:8]}'
    game = Game(
        uuid=game_uuid,
        name=title,
        library_uuid=lib.uuid,
    )
    db_session.add(game)
    db_session.commit()

    result = import_gog_csv(
        user.id,
        f'product_id,name\n1207658924,{title}\n9999999999,Unknown Game\n',
    )
    assert result['imported'] == 2
    assert result['matched'] == 1

    matched = db_session.execute(
        select(UserOwnedTitle).filter_by(
            user_id=user.id,
            store='gog',
            external_app_id='1207658924',
        )
    ).scalars().first()
    assert matched is not None
    assert matched.matched_game_uuid == game_uuid


def test_import_meta_quest_csv_matches_by_name(db_session, lib, user):
    _ensure_global_settings(db_session, enable_store_ownership_sync=True)
    game_uuid = str(uuid4())
    title = f'Quest Exclusive {uuid4().hex[:8]}'
    game = Game(uuid=game_uuid, name=title, library_uuid=lib.uuid)
    db_session.add(game)
    db_session.commit()

    result = import_meta_quest_csv(
        user.id,
        f'meta_id,name\nquest-app-1,{title}\nquest-app-2,Unknown Quest Title\n',
    )
    assert result['imported'] == 2
    assert result['matched'] == 1
    assert result['store'] == 'meta_quest'

    matched = db_session.execute(
        select(UserOwnedTitle).filter_by(
            user_id=user.id,
            store='meta_quest',
            external_app_id='quest-app-1',
        )
    ).scalars().first()
    assert matched is not None
    assert matched.matched_game_uuid == game_uuid


def test_match_meta_quest_by_game_url(db_session, lib):
    from gametheca.models import GameURL

    game_uuid = str(uuid4())
    quest_id = f'oculus-{uuid4().hex[:12]}'
    game = Game(uuid=game_uuid, name='URL Linked Quest', library_uuid=lib.uuid)
    db_session.add(game)
    db_session.flush()
    db_session.add(GameURL(game_uuid=game_uuid, url_type='meta_quest', url=quest_id))
    db_session.commit()

    assert match_title_to_library_game('meta_quest', quest_id) == game_uuid
    assert match_title_to_library_game('meta_quest', 'other-id', 'No Match Name') is None


def test_import_epic_csv_matches_by_name(db_session, lib, user):
    _ensure_global_settings(db_session, enable_store_ownership_sync=True)
    game_uuid = str(uuid4())
    title = f'Hades Test {uuid4().hex[:8]}'
    game = Game(
        uuid=game_uuid,
        name=title,
        library_uuid=lib.uuid,
    )
    db_session.add(game)
    db_session.commit()

    result = import_epic_csv(
        user.id,
        f'catalog_item_id,name\nhades,{title}\norphan,Missing Game\n',
    )
    assert result['imported'] == 2
    assert result['matched'] == 1

    matched = db_session.execute(
        select(UserOwnedTitle).filter_by(
            user_id=user.id,
            store='epic',
            external_app_id='hades',
        )
    ).scalars().first()
    assert matched is not None
    assert matched.matched_game_uuid == game_uuid


def test_disconnect_gog_clears_account_and_titles(db_session, user):
    connect_gog_account(user.id, gog_user_id='gog-user-1')
    upsert_owned_title(user.id, 'gog', '1207658924', 'Some Game')
    db_session.commit()

    disconnect_gog_account(user.id)

    account = db_session.execute(
        select(StoreAccount).filter_by(user_id=user.id, store='gog')
    ).scalars().first()
    titles = db_session.execute(
        select(UserOwnedTitle).filter_by(user_id=user.id, store='gog')
    ).scalars().all()
    assert account is None
    assert titles == []


def test_disconnect_epic_clears_account_and_titles(db_session, user):
    upsert_owned_title(user.id, 'epic', 'fn', 'Fortnite')
    db_session.commit()

    disconnect_epic_account(user.id)

    account = db_session.execute(
        select(StoreAccount).filter_by(user_id=user.id, store='epic')
    ).scalars().first()
    titles = db_session.execute(
        select(UserOwnedTitle).filter_by(user_id=user.id, store='epic')
    ).scalars().all()
    assert account is None
    assert titles == []


def test_browse_includes_gog_owned_when_matched(client, app, db_session, lib, user):
    game_uuid = str(uuid4())
    title = f'Stardew Test {uuid4().hex[:8]}'
    game = Game(
        uuid=game_uuid,
        name=title,
        library_uuid=lib.uuid,
    )
    db_session.add(game)
    upsert_owned_title(user.id, 'gog', '1456460669', title)
    db_session.commit()

    _login(client, app, user)
    resp = client.get(f'/browse_games?per_page=50&library_uuid={lib.uuid}')
    assert resp.status_code == 200
    payload = resp.get_json()
    matched = next(g for g in payload['games'] if g['uuid'] == game_uuid)
    assert matched['owned'] is True
    assert matched['store_owned'] is True


def test_ownership_gog_api_disabled(client, app, db_session, user):
    _ensure_global_settings(db_session, enable_store_ownership_sync=False)

    _login(client, app, user)
    resp = client.post('/api/ownership/gog/csv', json={'csv': '123,Game\n'})
    assert resp.status_code == 403


def test_browse_includes_owned_when_matched(client, app, db_session, lib, user):
    game_uuid = str(uuid4())
    app_id = _unique_steam_app_id()
    game = Game(
        uuid=game_uuid,
        name='Counter-Strike 2',
        library_uuid=lib.uuid,
        steam_app_id=app_id,
    )
    db_session.add(game)
    upsert_owned_title(user.id, 'steam', str(app_id), 'Counter-Strike 2')
    db_session.commit()

    _login(client, app, user)
    resp = client.get(f'/browse_games?per_page=50&library_uuid={lib.uuid}')
    assert resp.status_code == 200
    payload = resp.get_json()
    matched = next(g for g in payload['games'] if g['uuid'] == game_uuid)
    assert matched['owned'] is True
    assert matched['store_owned'] is True


def test_browse_owned_false_without_match(client, app, db_session, lib, user):
    game_uuid = str(uuid4())
    game = Game(
        uuid=game_uuid,
        name='Unowned Game',
        library_uuid=lib.uuid,
        steam_app_id=_unique_steam_app_id(),
    )
    db_session.add(game)
    db_session.commit()

    _login(client, app, user)
    resp = client.get(f'/browse_games?per_page=50&library_uuid={lib.uuid}')
    assert resp.status_code == 200
    payload = resp.get_json()
    row = next(g for g in payload['games'] if g['uuid'] == game_uuid)
    assert row['owned'] is False
    assert row['store_owned'] is False


def _ensure_global_settings(db_session, **kwargs):
    settings = db_session.execute(select(GlobalSettings).order_by(GlobalSettings.id).limit(1)).scalars().first()
    if not settings:
        settings = GlobalSettings()
        db_session.add(settings)
    for key, value in kwargs.items():
        setattr(settings, key, value)
    db_session.commit()
    return settings


def test_ownership_api_disabled(client, app, db_session, user):
    _ensure_global_settings(db_session, enable_store_ownership_sync=False)

    _login(client, app, user)
    resp = client.post(
        '/api/ownership/steam',
        json={'steam_id': '76561198000000000'},
    )
    assert resp.status_code == 403


@patch('gametheca.utils.store_ownership._outbound')
def test_steam_sync_register_only(mock_out, db_session, user):
    from gametheca.utils.store_ownership import connect_steam_account, sync_steam_owned_games

    _ensure_global_settings(
        db_session,
        enable_store_ownership_sync=True,
        steam_web_api_key='test-key',
    )

    connect_steam_account(user.id, '76561198000000000')
    mock_out.return_value.status_code = 200
    mock_out.return_value.json.return_value = {
        'response': {
            'games': [
                {'appid': 570, 'name': 'Dota 2'},
                {'appid': 730, 'name': 'CS2'},
            ],
        },
    }

    result = sync_steam_owned_games(user.id)
    assert result['synced'] == 2
    assert mock_out.call_count == 1
    call_args = mock_out.call_args
    assert 'GetOwnedGames' in call_args[0][1]

    rows = db_session.execute(
        select(UserOwnedTitle).filter_by(user_id=user.id, store='steam')
    ).scalars().all()
    assert len(rows) == 2


@patch('gametheca.utils.store_ownership._outbound')
def test_gog_live_sync_register_only(mock_out, db_session, user):
    from gametheca.utils.store_ownership import connect_gog_account, sync_gog_owned_games

    _ensure_global_settings(db_session, enable_store_ownership_sync=True)
    connect_gog_account(user.id, refresh_token='refresh-abc')

    def fake_out(method, url, **kwargs):
        class Resp:
            status_code = 200
            content = b'{}'

            def json(self):
                if 'token' in url:
                    return {'access_token': 'acc', 'refresh_token': 'refresh-abc'}
                if 'user/data/games' in url:
                    return {'owned': [1207658924, 12]}
                if 'products' in url:
                    return [
                        {'id': 1207658924, 'title': 'The Witcher 3'},
                        {'id': 12, 'title': 'Demo'},
                    ]
                return {}

            def raise_for_status(self):
                return None

        return Resp()

    mock_out.side_effect = fake_out
    result = sync_gog_owned_games(user.id)
    assert result['synced'] == 2
    assert result['store'] == 'gog'
    rows = db_session.execute(
        select(UserOwnedTitle).filter_by(user_id=user.id, store='gog')
    ).scalars().all()
    assert {row.external_app_id for row in rows} == {'1207658924', '12'}
    account = db_session.execute(
        select(StoreAccount).filter_by(user_id=user.id, store='gog')
    ).scalars().one()
    assert 'refresh_token' in account.credential
    assert 'access_token' not in account.to_dict()


@patch('gametheca.utils.store_ownership._outbound')
def test_epic_live_sync_register_only(mock_out, db_session, user):
    from gametheca.utils.store_ownership import connect_epic_account, sync_epic_owned_games

    _ensure_global_settings(db_session, enable_store_ownership_sync=True)
    connect_epic_account(
        user.id,
        device_auth={
            'account_id': 'acc1',
            'device_id': 'dev1',
            'secret': 'sec1',
        },
    )

    def fake_out(method, url, **kwargs):
        class Resp:
            status_code = 200
            content = b'{}'

            def json(self):
                if 'oauth/token' in url:
                    return {'access_token': 'eg1', 'displayName': 'Player'}
                if 'library' in url:
                    return {
                        'records': [
                            {'catalogItemId': 'cat-a', 'title': 'Fortnite'},
                            {'catalogItemId': 'cat-b', 'appName': 'Other'},
                        ],
                        'responseMetadata': {},
                    }
                return {}

            def raise_for_status(self):
                return None

        return Resp()

    mock_out.side_effect = fake_out
    result = sync_epic_owned_games(user.id)
    assert result['synced'] == 2
    assert result['store'] == 'epic'
    rows = db_session.execute(
        select(UserOwnedTitle).filter_by(user_id=user.id, store='epic')
    ).scalars().all()
    assert {row.external_app_id for row in rows} == {'cat-a', 'cat-b'}


@patch('gametheca.utils.store_ownership._outbound')
def test_gog_401_fails_honestly(mock_out, db_session, user):
    from gametheca.utils.store_ownership import connect_gog_account, sync_gog_owned_games

    _ensure_global_settings(db_session, enable_store_ownership_sync=True)
    connect_gog_account(user.id, refresh_token='dead-token')

    class Resp:
        status_code = 401
        content = b'{}'

        def json(self):
            return {}

        def raise_for_status(self):
            raise AssertionError('401 must not be treated as success')

    mock_out.return_value = Resp()
    with pytest.raises(ValueError, match='rejected'):
        sync_gog_owned_games(user.id)


def test_flatten_amazon_nile_user_json():
    from gametheca.utils.store_ownership import _flatten_amazon_credential

    nested = {
        'tokens': {
            'bearer': {
                'access_token': 'acc',
                'refresh_token': 'ref',
            }
        },
        'extensions': {
            'device_info': {'device_serial_number': 'SERIAL1'},
            'customer_info': {'user_id': 'amzn1.account.x'},
        },
    }
    flat = _flatten_amazon_credential(nested)
    assert flat['refresh_token'] == 'ref'
    assert flat['access_token'] == 'acc'
    assert flat['device_serial'] == 'SERIAL1'
    assert flat['user_id'] == 'amzn1.account.x'


@patch('gametheca.utils.store_ownership._outbound')
def test_amazon_live_sync_register_only(mock_out, db_session, user):
    from gametheca.utils.store_ownership import connect_amazon_account, sync_amazon_owned_games

    _ensure_global_settings(db_session, enable_store_ownership_sync=True)
    connect_amazon_account(
        user.id,
        credential={
            'refresh_token': 'amzn-refresh',
            'device_serial': 'DEVSERIAL',
        },
    )

    def fake_out(method, url, **kwargs):
        class Resp:
            status_code = 200
            content = b'{}'

            def json(self):
                if 'auth/token' in url:
                    return {'access_token': 'amzn-access', 'expires_in': 3600}
                if 'entitlements' in url:
                    return {
                        'entitlements': [
                            {'product': {'id': 'prod-a', 'title': 'Amazon Game A'}},
                            {'product': {'id': 'prod-b', 'title': 'Amazon Game B'}},
                        ]
                    }
                return {}

            def raise_for_status(self):
                return None

        return Resp()

    mock_out.side_effect = fake_out
    result = sync_amazon_owned_games(user.id)
    assert result['synced'] == 2
    assert result['store'] == 'amazon'
    called_urls = [call.args[1] for call in mock_out.call_args_list]
    assert any('auth/token' in url for url in called_urls)
    assert any('entitlements' in url for url in called_urls)
    assert all('GetGameDownload' not in url for url in called_urls)
    rows = db_session.execute(
        select(UserOwnedTitle).filter_by(user_id=user.id, store='amazon')
    ).scalars().all()
    assert {row.external_app_id for row in rows} == {'prod-a', 'prod-b'}
    account = db_session.execute(
        select(StoreAccount).filter_by(user_id=user.id, store='amazon')
    ).scalars().one()
    assert 'refresh_token' in account.credential
    assert 'access_token' not in account.to_dict()


@patch('gametheca.utils.store_ownership._outbound')
def test_amazon_401_fails_honestly(mock_out, db_session, user):
    from gametheca.utils.store_ownership import connect_amazon_account, sync_amazon_owned_games

    _ensure_global_settings(db_session, enable_store_ownership_sync=True)
    connect_amazon_account(
        user.id,
        credential={'refresh_token': 'dead-token', 'device_serial': 'DEVSERIAL'},
    )

    class Resp:
        status_code = 401
        content = b'{}'

        def json(self):
            return {}

        def raise_for_status(self):
            raise AssertionError('401 must not be treated as success')

    mock_out.return_value = Resp()
    with pytest.raises(ValueError, match='rejected'):
        sync_amazon_owned_games(user.id)
