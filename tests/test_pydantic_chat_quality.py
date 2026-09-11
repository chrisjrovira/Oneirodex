"""422 contracts for chat mute, space-member add, and quality-score JSON."""

from __future__ import annotations

from uuid import uuid4

import pytest
from flask_login import login_user

from oneirodex.models import User


@pytest.fixture
def member_user(db_session):
    uid = str(uuid4())
    user = User(
        name=f'pyd_cq_member_{uid[:8]}',
        email=f'pyd_cq_member_{uid[:8]}@example.com',
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
        name=f'pyd_cq_admin_{uid[:8]}',
        email=f'pyd_cq_admin_{uid[:8]}@example.com',
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


def test_chat_mute_requires_muted_before_channel_lookup(client, app, member_user):
    """Validation runs before the opaque 404, so a missing body is 422 even for id 1."""
    _login(client, app, member_user)
    response = client.post('/api/chat/channels/1/mute', json={})
    _assert_unprocessable(response, 'muted')


def test_space_member_add_requires_user_id_before_space_lookup(client, app, admin_user):
    _login(client, app, admin_user)
    response = client.post('/api/chat/spaces/1/members', json={})
    _assert_unprocessable(response, 'user_id')


def test_quality_score_requires_title(client, app, admin_user):
    _login(client, app, admin_user)
    response = client.post('/api/quality-profiles/score', json={})
    _assert_unprocessable(response, 'title')
