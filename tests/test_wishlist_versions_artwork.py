"""Tests for SteamGridDB cover apply, game versions, and wishlist depth."""

from __future__ import annotations

from unittest.mock import patch
from uuid import uuid4

import pytest
from flask_login import login_user
from sqlalchemy import select

from gametheca.models import Game, GameUpdate, Image, Library, User
from gametheca.platform import LibraryPlatform
from gametheca.utils.game_versions import list_game_versions, resolve_version_file


@pytest.fixture
def lib(db_session):
    library = Library(name=f'VerLib_{uuid4().hex[:6]}', platform=LibraryPlatform.PCWIN)
    db_session.add(library)
    db_session.commit()
    return library


@pytest.fixture
def user(db_session):
    uid = str(uuid4())
    row = User(
        name=f'wuser_{uid[:8]}',
        email=f'wuser_{uid[:8]}@example.com',
        role='user',
        user_id=uid,
        state=True,
    )
    row.set_password('password123')
    db_session.add(row)
    db_session.commit()
    return row


@pytest.fixture
def admin(db_session):
    uid = str(uuid4())
    row = User(
        name=f'wadmin_{uid[:8]}',
        email=f'wadmin_{uid[:8]}@example.com',
        role='admin',
        user_id=uid,
        state=True,
    )
    row.set_password('password123')
    db_session.add(row)
    db_session.commit()
    return row


def _login(client, app, account):
    with client.session_transaction() as sess:
        sess['_user_id'] = str(account.get_id())
        sess['_fresh'] = True
    with app.test_request_context():
        login_user(account)


def test_list_game_versions_includes_updates(db_session, lib):
    game = Game(
        uuid=str(uuid4()),
        name=f'Versioned {uuid4().hex[:6]}',
        library_uuid=lib.uuid,
        full_disk_path=f'/games/{uuid4().hex}',
        size=123,
    )
    db_session.add(game)
    db_session.flush()
    update = GameUpdate(
        uuid=str(uuid4()),
        game_uuid=game.uuid,
        file_path=f'/games/{game.uuid}/updates/patch.zip',
    )
    db_session.add(update)
    db_session.commit()

    versions = list_game_versions(game)
    assert versions[0]['kind'] == 'base'
    assert versions[0]['is_default'] is True
    assert any(v['kind'] == 'update' and v['uuid'] == update.uuid for v in versions)

    path, _, ver = resolve_version_file(game, kind='update', version_uuid=update.uuid)
    assert path == update.file_path
    assert ver == update.uuid


def test_wishlist_create_cancel_and_admin_fulfill(client, app, db_session, user, admin, lib):
    _login(client, app, user)
    create = client.post('/api/requests', json={'title': f'Title {uuid4().hex[:6]}', 'notes': 'want'})
    assert create.status_code == 201
    req_id = create.get_json()['id']

    listed = client.get('/api/requests')
    assert listed.status_code == 200
    assert any(r['id'] == req_id for r in listed.get_json()['requests'])

    game = Game(
        uuid=str(uuid4()),
        name=f'Linked {uuid4().hex[:6]}',
        library_uuid=lib.uuid,
        full_disk_path=f'/games/{uuid4().hex}',
    )
    db_session.add(game)
    db_session.commit()

    _login(client, app, admin)
    with patch('gametheca.routes_apis.wishlist.notify_admins') as notify:
        fulfill = client.patch(
            f'/api/requests/{req_id}',
            json={'status': 'fulfilled', 'linked_game_uuid': game.uuid, 'notes': 'added'},
        )
        assert fulfill.status_code == 200
        notify.assert_called_once()
        assert notify.call_args.kwargs['payload']['linked_game_uuid'] == game.uuid
    body = fulfill.get_json()
    assert body['status'] == 'fulfilled'
    assert body['linked_game_uuid'] == game.uuid

    _login(client, app, user)
    create2 = client.post('/api/requests', json={'title': f'Cancel me {uuid4().hex[:6]}'})
    cancel_id = create2.get_json()['id']
    cancel = client.delete(f'/api/requests/{cancel_id}')
    assert cancel.status_code == 200
    remaining = client.get('/api/requests').get_json()['requests']
    assert all(r['id'] != cancel_id for r in remaining)


@patch('gametheca.utils.artwork_apply.get_provider')
def test_apply_steamgriddb_cover(mock_get_provider, client, app, db_session, admin, lib, tmp_path):
    game = Game(
        uuid=str(uuid4()),
        name=f'Art Game {uuid4().hex[:6]}',
        library_uuid=lib.uuid,
        full_disk_path=f'/games/{uuid4().hex}',
    )
    db_session.add(game)
    db_session.commit()

    class FakeProvider:
        id = 'steamgriddb'

        def is_enabled(self):
            return True

        def fetch_image(self, url):
            assert url.startswith('https://')
            return b'fake-image-bytes', 'image/png'

    mock_get_provider.return_value = FakeProvider()
    app.config['IMAGE_SAVE_PATH'] = str(tmp_path)

    _login(client, app, admin)
    resp = client.post(
        f'/api/games/{game.uuid}/artwork/steamgriddb',
        json={'url': 'https://cdn.example.com/cover.png', 'image_type': 'cover'},
    )
    assert resp.status_code == 200, resp.get_json()
    payload = resp.get_json()
    assert payload['image_id']
    assert payload['filename'].endswith('.png')

    images = db_session.execute(
        select(Image).filter_by(game_uuid=game.uuid, image_type='cover')
    ).scalars().all()
    assert len(images) == 1
    assert images[0].is_downloaded is True
    assert (tmp_path / images[0].url).is_file()
