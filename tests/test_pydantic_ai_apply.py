"""422 contracts for AI apply-triage JSON."""

from __future__ import annotations

from uuid import uuid4

import pytest
from flask_login import login_user

from oneirodex.models import User


@pytest.fixture
def admin_user(db_session):
    uid = str(uuid4())
    user = User(
        name=f'pyd_ai_admin_{uid[:8]}',
        email=f'pyd_ai_admin_{uid[:8]}@example.com',
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


def test_ai_apply_triage_requires_game_uuid(client, app, admin_user):
    _login(client, app, admin_user)
    response = client.post('/api/ai/apply-triage', json={})
    _assert_unprocessable(response, 'game_uuid')


def test_ai_apply_triage_requires_title_or_name(client, app, admin_user):
    _login(client, app, admin_user)
    response = client.post(
        '/api/ai/apply-triage',
        json={'game_uuid': str(uuid4())},
    )
    _assert_unprocessable(response, '__root__')
