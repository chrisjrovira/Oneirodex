"""422 contracts for ``@validate_batch_body`` batch favorite.

Missing ``favorite`` / ``uuids`` is now ``422 unprocessable`` with
``detail`` naming the field **and** the partial-success keys
(``updated`` / ``skipped`` / ``errors`` / ``limit``) the member SPA already
reads. Over-limit and per-item skips stay in the view (still 400 / 200) —
covered by ``tests/test_games_batch_actions.py``.
"""

from __future__ import annotations

from uuid import uuid4

import pytest
from flask_login import login_user

from oneirodex.models import User


@pytest.fixture
def member_user(db_session):
    uid = str(uuid4())
    user = User(
        name=f'pyd_batch_{uid[:8]}',
        email=f'pyd_batch_{uid[:8]}@example.com',
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


def _assert_batch_unprocessable(response, field: str, *, limit: int = 100) -> None:
    assert response.status_code == 422, response.get_data(as_text=True)
    body = response.get_json()
    assert body['ok'] is False
    assert body['error'] == 'Invalid request.'
    assert body['error_code'] == 'unprocessable'
    assert field in body['detail']
    assert body['updated'] == []
    assert body['skipped'] == []
    assert body['errors'] == []
    assert body['limit'] == limit


def test_batch_favorite_requires_favorite(client, app, member_user):
    _login(client, app, member_user)
    response = client.post('/api/games/batch/favorite', json={'uuids': []})
    _assert_batch_unprocessable(response, 'favorite')


def test_batch_favorite_requires_uuids_list(client, app, member_user):
    _login(client, app, member_user)
    response = client.post('/api/games/batch/favorite', json={'favorite': True})
    _assert_batch_unprocessable(response, 'uuids')


def test_batch_favorite_rejects_non_list_uuids(client, app, member_user):
    _login(client, app, member_user)
    response = client.post(
        '/api/games/batch/favorite',
        json={'uuids': 'nope', 'favorite': True},
    )
    _assert_batch_unprocessable(response, 'uuids')


def test_batch_favorite_empty_uuids_still_succeeds(client, app, member_user):
    _login(client, app, member_user)
    response = client.post(
        '/api/games/batch/favorite',
        json={'uuids': [], 'favorite': False},
    )
    assert response.status_code == 200, response.get_data(as_text=True)
    body = response.get_json()
    assert body['ok'] is True
    assert body['requested'] == 0
    assert body['updated'] == []
    assert body['limit'] == 100
    assert body['favorite'] is False
