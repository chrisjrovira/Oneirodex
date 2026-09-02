"""Tests for companion client heartbeat and client_connected wiring."""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

import pytest
from flask_login import login_user
from sqlalchemy import select

from oneirodex.models import ClientDevice, Game, Library, User
from oneirodex.platform import LibraryPlatform
from oneirodex.utils.client_presence import CLIENT_HEARTBEAT_TTL_SECONDS, user_client_connected
from oneirodex.utils.lifecycle import web_lifecycle_fields


@pytest.fixture
def lib(db_session):
    library = Library(name=f'HeartbeatLib_{uuid4().hex[:6]}', platform=LibraryPlatform.PCWIN)
    db_session.add(library)
    db_session.commit()
    return library


@pytest.fixture
def user(db_session):
    uid = str(uuid4())
    row = User(
        name=f'clientuser_{uid[:8]}',
        email=f'clientuser_{uid[:8]}@example.com',
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


def test_user_client_connected_false_without_devices(db_session, user):
    assert user_client_connected(user.id) is False
    assert user_client_connected(None) is False


def test_user_client_connected_true_within_ttl(db_session, user):
    device = ClientDevice(
        user_id=user.id,
        device_id='desktop-1',
        last_seen_at=datetime.now(timezone.utc),
    )
    db_session.add(device)
    db_session.commit()
    assert user_client_connected(user.id) is True


def test_user_client_connected_false_after_ttl(db_session, user):
    stale = datetime.now(timezone.utc) - timedelta(seconds=CLIENT_HEARTBEAT_TTL_SECONDS + 30)
    device = ClientDevice(
        user_id=user.id,
        device_id='desktop-stale',
        last_seen_at=stale,
    )
    db_session.add(device)
    db_session.commit()
    assert user_client_connected(user.id) is False


def test_web_lifecycle_fields_client_connected_override():
    game = SimpleNamespace(freshness_status=None, updates=[])
    fields = web_lifecycle_fields(game, client_connected=True)
    assert fields['client_connected'] is True
    assert fields['lifecycle_state'] == 'not_downloaded'


def test_web_lifecycle_fields_uses_user_id_lookup(db_session, user):
    game = SimpleNamespace(freshness_status=None, updates=[])
    device = ClientDevice(
        user_id=user.id,
        device_id='lookup-device',
        last_seen_at=datetime.now(timezone.utc),
    )
    db_session.add(device)
    db_session.commit()

    fields = web_lifecycle_fields(game, user_id=user.id)
    assert fields['client_connected'] is True


def test_client_heartbeat_endpoint(client, app, db_session, user):
    _login(client, app, user)

    response = client.post(
        '/api/client/heartbeat',
        json={'device_name': 'Test Desktop', 'client_version': '0.0.1'},
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload['device_id']
    assert payload['device_name'] == 'Test Desktop'
    assert payload['client_version'] == '0.0.1'
    assert payload['last_seen_at']

    rows = db_session.execute(
        select(ClientDevice).filter_by(user_id=user.id)
    ).scalars().all()
    assert len(rows) == 1
    assert rows[0].device_name == 'Test Desktop'


def test_client_heartbeat_updates_existing_device(client, app, db_session, user):
    _login(client, app, user)
    device_id = 'persistent-device'

    first = client.post(
        '/api/client/heartbeat',
        json={'device_id': device_id, 'client_version': '0.0.1'},
    )
    assert first.status_code == 200

    second = client.post(
        '/api/client/heartbeat',
        json={'device_id': device_id, 'client_version': '0.0.2'},
    )
    assert second.status_code == 200
    assert second.get_json()['client_version'] == '0.0.2'

    rows = db_session.execute(
        select(ClientDevice).filter_by(user_id=user.id, device_id=device_id)
    ).scalars().all()
    assert len(rows) == 1
    assert rows[0].client_version == '0.0.2'


def test_browse_games_sets_client_connected_with_recent_heartbeat(client, app, db_session, lib, user):
    _login(client, app, user)

    game = Game(
        uuid=str(uuid4()),
        name='Heartbeat Game',
        library_uuid=lib.uuid,
    )
    db_session.add(game)
    db_session.add(
        ClientDevice(
            user_id=user.id,
            device_id='browse-device',
            last_seen_at=datetime.now(timezone.utc),
        )
    )
    db_session.commit()

    with patch('oneirodex.routes.get_matched_owned_game_uuids', return_value=set()):
        response = client.get(f'/browse_games?page=1&per_page=10&library_uuid={lib.uuid}')

    assert response.status_code == 200
    payload = response.get_json()
    matched = next(item for item in payload['games'] if item['uuid'] == game.uuid)
    assert matched['client_connected'] is True
