"""422 contracts for check-username and layout-preset create JSON."""

from __future__ import annotations

from uuid import uuid4

import pytest
from flask_login import login_user

from oneirodex.models import User


@pytest.fixture
def member_user(db_session):
    uid = str(uuid4())
    user = User(
        name=f'pyd_user_member_{uid[:8]}',
        email=f'pyd_user_member_{uid[:8]}@example.com',
        role='user',
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


def test_check_username_requires_username(client, app, member_user):
    _login(client, app, member_user)
    response = client.post('/api/check_username', json={})
    _assert_unprocessable(response, 'username')


def test_layout_preset_requires_name_and_layout(client, app, member_user):
    _login(client, app, member_user)
    response = client.post('/api/layouts/detail/presets', json={})
    _assert_unprocessable(response, 'name')
    assert 'layout' in response.get_json()['detail']


def test_layout_preset_blank_name_is_unprocessable(client, app, member_user):
    _login(client, app, member_user)
    response = client.post(
        '/api/layouts/detail/presets',
        json={'name': '  ', 'layout': {'sections': []}},
    )
    _assert_unprocessable(response, 'name')
