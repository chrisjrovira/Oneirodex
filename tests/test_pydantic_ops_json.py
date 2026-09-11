"""422 contracts for wanted, hardlink, game-server create, and malware-scan JSON."""

from __future__ import annotations

from uuid import uuid4

import pytest
from flask_login import login_user

from oneirodex.models import User


@pytest.fixture
def member_user(db_session):
    uid = str(uuid4())
    user = User(
        name=f'pyd_ops_member_{uid[:8]}',
        email=f'pyd_ops_member_{uid[:8]}@example.com',
        role='user',
        user_id=uid,
        state=True,
    )
    user.set_password('password123')
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def admin_user(db_session):
    uid = str(uuid4())
    user = User(
        name=f'pyd_ops_admin_{uid[:8]}',
        email=f'pyd_ops_admin_{uid[:8]}@example.com',
        role='admin',
        user_id=uid,
        state=True,
    )
    user.set_password('password123')
    db_session.add(user)
    db_session.commit()
    return user


def _login(client, app, account):
    with client.session_transaction() as sess:
        sess['_user_id'] = str(account.id)
        sess['_fresh'] = True
    with app.test_request_context():
        login_user(account)


def _assert_unprocessable(response, field: str) -> None:
    assert response.status_code == 422, response.get_data(as_text=True)
    body = response.get_json()
    assert body['ok'] is False
    assert body['error'] == 'Invalid request.'
    assert body['error_code'] == 'unprocessable'
    assert field in body['detail']


def test_wanted_add_requires_game_uuid(client, app, member_user):
    _login(client, app, member_user)
    response = client.post('/api/updates/wanted', json={})
    _assert_unprocessable(response, 'game_uuid')


def test_wanted_fulfill_requires_game_uuid(client, app, member_user):
    _login(client, app, member_user)
    response = client.post('/api/updates/wanted/fulfill', json={})
    _assert_unprocessable(response, 'game_uuid')


def test_hardlink_preview_requires_source_and_dest(client, app, admin_user):
    _login(client, app, admin_user)
    response = client.post('/api/storage/hardlink/preview', json={})
    _assert_unprocessable(response, 'source')
    assert 'dest' in response.get_json()['detail']


def test_hardlink_apply_requires_source_and_dest(client, app, admin_user):
    _login(client, app, admin_user)
    response = client.post('/api/storage/hardlink/apply', json={})
    _assert_unprocessable(response, 'source')
    assert 'dest' in response.get_json()['detail']


def test_game_server_create_requires_name_and_connect(client, app, admin_user):
    _login(client, app, admin_user)
    response = client.post('/api/game-servers', json={})
    _assert_unprocessable(response, 'display_name')
    assert 'connect_string' in response.get_json()['detail']


def test_malware_scan_requires_path(client, app, admin_user):
    _login(client, app, admin_user)
    response = client.post('/api/admin/malware-scan', json={})
    _assert_unprocessable(response, 'path')
