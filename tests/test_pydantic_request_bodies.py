"""422 contracts for the next `@validate_body` surfaces.

Playtime start, wishlist create/resolve, API-token create, and related-media
create now reject a missing required field as ``422 unprocessable`` with
``detail`` naming the field — not the old ad-hoc ``400 bad_request`` sentence.

Semantic refusals stay in the view (unknown wishlist status, unknown token
preset, unknown related-media kind / relation / non-numeric year). Those are
covered by the existing per-surface tests.
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
        name=f'pyd_member_{uid[:8]}',
        email=f'pyd_member_{uid[:8]}@example.com',
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
        name=f'pyd_admin_{uid[:8]}',
        email=f'pyd_admin_{uid[:8]}@example.com',
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


def test_playtime_start_requires_game_uuid(client, app, member_user):
    _login(client, app, member_user)
    response = client.post('/api/playtime/sessions', json={})
    _assert_unprocessable(response, 'game_uuid')


def test_wishlist_create_requires_title(client, app, member_user):
    _login(client, app, member_user)
    response = client.post('/api/requests', json={})
    _assert_unprocessable(response, 'title')


def test_wishlist_resolve_requires_status_before_lookup(client, app, admin_user):
    """Validation runs before the row 404, so a missing body is 422 even for id 1."""
    _login(client, app, admin_user)
    response = client.patch('/api/requests/1', json={})
    _assert_unprocessable(response, 'status')


def test_token_create_requires_name(client, app, member_user):
    _login(client, app, member_user)
    response = client.post('/api/tokens', json={})
    _assert_unprocessable(response, 'name')


def test_related_media_create_requires_title_before_game_lookup(client, app, admin_user):
    """Librarian auth still runs first; body validation then runs before game 404."""
    _login(client, app, admin_user)
    response = client.post(f'/api/games/{uuid4()}/related_media', json={})
    _assert_unprocessable(response, 'title')
