"""422 contracts for PC-cheat create and companion lifecycle JSON."""

from __future__ import annotations

from uuid import uuid4

import pytest
from flask_login import login_user

from oneirodex.models import User


@pytest.fixture
def member_user(db_session):
    uid = str(uuid4())
    user = User(
        name=f'pyd_cc_member_{uid[:8]}',
        email=f'pyd_cc_member_{uid[:8]}@example.com',
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
        name=f'pyd_cc_admin_{uid[:8]}',
        email=f'pyd_cc_admin_{uid[:8]}@example.com',
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


def test_pc_cheats_create_requires_label_before_game_lookup(client, app, admin_user):
    _login(client, app, admin_user)
    response = client.post(f'/api/games/{uuid4()}/pc_cheats', json={})
    _assert_unprocessable(response, 'label')


def test_client_lifecycle_requires_records_list(client, app, member_user):
    """Companion-token 403 runs after validation, so a session {} is 422."""
    _login(client, app, member_user)
    response = client.post('/api/client/lifecycle', json={})
    _assert_unprocessable(response, 'records')
