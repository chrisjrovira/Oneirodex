"""422 contracts for acquire-download and announcement-create JSON."""

from __future__ import annotations

from uuid import uuid4

import pytest
from flask_login import login_user

from oneirodex.models import User


@pytest.fixture
def member_user(db_session):
    uid = str(uuid4())
    user = User(
        name=f'pyd_acq_member_{uid[:8]}',
        email=f'pyd_acq_member_{uid[:8]}@example.com',
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
        name=f'pyd_acq_admin_{uid[:8]}',
        email=f'pyd_acq_admin_{uid[:8]}@example.com',
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


def test_acquire_download_requires_url_or_magnet(client, app, admin_user):
    _login(client, app, admin_user)
    response = client.post('/api/acquire/download', json={})
    _assert_unprocessable(response, '__root__')


def test_acquire_download_blank_url_is_unprocessable(client, app, admin_user):
    _login(client, app, admin_user)
    response = client.post('/api/acquire/download', json={'url': '   '})
    _assert_unprocessable(response, '__root__')


def test_announcement_create_requires_title_and_body(client, app, admin_user):
    _login(client, app, admin_user)
    response = client.post('/api/announcements', json={})
    _assert_unprocessable(response, 'title')
    assert 'body' in response.get_json()['detail']


def test_announcement_create_blank_title_is_unprocessable(client, app, admin_user):
    _login(client, app, admin_user)
    response = client.post(
        '/api/announcements',
        json={'title': '  ', 'body': 'Welcome'},
    )
    _assert_unprocessable(response, 'title')
