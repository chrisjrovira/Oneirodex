"""Tests for per-game mod registry API (MOD-1/2)."""

from uuid import uuid4

import pytest

from gametheca.models import Game, Library, User
from gametheca.platform import LibraryPlatform


@pytest.fixture
def librarian_user(db_session):
    uid = str(uuid4())
    user = User(
        user_id=uid,
        name=f'lib_{uid[:8]}',
        email=f'lib_{uid[:8]}@test.com',
        role='librarian',
        is_email_verified=True,
    )
    user.set_password('testpass123')
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def child_user(db_session):
    uid = str(uuid4())
    user = User(
        user_id=uid,
        name=f'child_{uid[:8]}',
        email=f'child_{uid[:8]}@test.com',
        role='child',
        is_email_verified=True,
    )
    user.set_password('testpass123')
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def admin_user(db_session):
    uid = str(uuid4())
    user = User(
        user_id=uid,
        name=f'admin_{uid[:8]}',
        email=f'admin_{uid[:8]}@test.com',
        role='admin',
        is_email_verified=True,
    )
    user.set_password('testpass123')
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def regular_user(db_session):
    uid = str(uuid4())
    user = User(
        user_id=uid,
        name=f'user_{uid[:8]}',
        email=f'user_{uid[:8]}@test.com',
        role='user',
        is_email_verified=True,
    )
    user.set_password('testpass123')
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def sample_game(db_session):
    library = Library(name=f'ModLib_{uuid4().hex[:6]}', platform=LibraryPlatform.PCWIN)
    db_session.add(library)
    db_session.commit()
    game = Game(
        name='Mod Test Game',
        library_uuid=library.uuid,
        full_disk_path=f'/tmp/{uuid4().hex}',
    )
    db_session.add(game)
    db_session.commit()
    return game


def _login(client, user):
    with client.session_transaction() as sess:
        sess['_user_id'] = str(user.id)
        sess['_fresh'] = True


class TestGameModsApi:
    def test_get_mods_requires_login(self, client, sample_game):
        response = client.get(f'/api/games/{sample_game.uuid}/mods')
        assert response.status_code in (302, 401)

    def test_create_and_crud_mod(self, client, librarian_user, sample_game, app, tmp_path):
        app.config['GAME_MODS_PATH'] = str(tmp_path)
        _login(client, librarian_user)
        create = client.post(
            f'/api/games/{sample_game.uuid}/mods',
            json={
                'name': 'HD Texture Pack',
                'version': '1.2',
                'source_url': 'https://example.com/mod.zip',
                'enabled': True,
                'load_order': 0,
            },
        )
        assert create.status_code == 201
        mod_id = create.get_json()['mod']['id']

        listing = client.get(f'/api/games/{sample_game.uuid}/mods')
        assert listing.status_code == 200
        body = listing.get_json()
        assert body['enabled'] is True
        assert len(body['mods']) == 1
        assert body['mods'][0]['source_url'] == 'https://example.com/mod.zip'
        assert body['mods'][0]['load_order'] == 0

        patch = client.put(
            f'/api/games/{sample_game.uuid}/mods/{mod_id}',
            json={'enabled': False, 'load_order': 3},
        )
        assert patch.status_code == 200
        assert patch.get_json()['mod']['enabled'] is False

        delete = client.delete(f'/api/games/{sample_game.uuid}/mods/{mod_id}')
        assert delete.status_code == 200
        assert client.get(f'/api/games/{sample_game.uuid}/mods').get_json()['mods'] == []

    def test_child_cannot_create_mod(self, client, child_user, sample_game, app, tmp_path):
        app.config['GAME_MODS_PATH'] = str(tmp_path)
        _login(client, child_user)
        response = client.post(
            f'/api/games/{sample_game.uuid}/mods',
            json={'name': 'Blocked'},
        )
        assert response.status_code == 403

    def test_regular_user_cannot_create_mod(self, client, regular_user, sample_game, app, tmp_path):
        app.config['GAME_MODS_PATH'] = str(tmp_path)
        _login(client, regular_user)
        response = client.post(
            f'/api/games/{sample_game.uuid}/mods',
            json={'name': 'Blocked'},
        )
        assert response.status_code == 403

    def test_mods_disabled_returns_403_on_write(self, client, admin_user, sample_game, app, tmp_path):
        app.config['GAME_MODS_PATH'] = str(tmp_path)
        app.config['ENABLE_MOD_TRACKING'] = False
        _login(client, admin_user)
        response = client.post(
            f'/api/games/{sample_game.uuid}/mods',
            json={'name': 'Off'},
        )
        assert response.status_code == 403

    def test_mods_summary_lists_accessible_games(
        self, client, librarian_user, sample_game, app, tmp_path
    ):
        app.config['GAME_MODS_PATH'] = str(tmp_path)
        _login(client, librarian_user)
        client.post(
            f'/api/games/{sample_game.uuid}/mods',
            json={'name': 'Summary Mod', 'enabled': True},
        )
        response = client.get('/api/mods/summary')
        assert response.status_code == 200
        body = response.get_json()
        assert body['enabled'] is True
        assert any(row['game_uuid'] == sample_game.uuid for row in body['games'])
