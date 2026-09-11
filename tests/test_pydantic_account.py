"""422 contracts for stock-avatar and password-change JSON."""

from __future__ import annotations

from uuid import uuid4

import pytest
from flask_login import login_user

from oneirodex.models import User


@pytest.fixture
def member_user(db_session):
    uid = str(uuid4())
    user = User(
        name=f'pyd_acct_member_{uid[:8]}',
        email=f'pyd_acct_member_{uid[:8]}@example.com',
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


def test_stock_avatar_requires_id(client, app, member_user):
    _login(client, app, member_user)
    response = client.post('/api/account/avatar/stock', json={})
    _assert_unprocessable(response, 'id')


def test_password_change_requires_the_three_fields(client, app, member_user):
    _login(client, app, member_user)
    response = client.post('/api/account/password', json={})
    _assert_unprocessable(response, 'current_password')
    detail = response.get_json()['detail']
    assert 'new_password' in detail
    assert 'confirm_password' in detail
