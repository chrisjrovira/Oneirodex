"""422 contracts for Arr download and hardlink-preview JSON."""

from __future__ import annotations

from uuid import uuid4

import pytest
from flask_login import login_user

from oneirodex.models import User


@pytest.fixture
def admin_user(db_session):
    uid = str(uuid4())
    user = User(
        name=f'pyd_arr_admin_{uid[:8]}',
        email=f'pyd_arr_admin_{uid[:8]}@example.com',
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


def test_arr_download_requires_url(client, app, admin_user):
    _login(client, app, admin_user)
    response = client.post('/api/arr/download', json={})
    _assert_unprocessable(response, '__root__')


def test_arr_hardlink_preview_requires_dest(client, app, admin_user):
    """Validation runs before the pipeline flag, so `{}` is 422 not 403."""
    _login(client, app, admin_user)
    response = client.post('/api/arr/hardlink/preview', json={})
    _assert_unprocessable(response, '__root__')
