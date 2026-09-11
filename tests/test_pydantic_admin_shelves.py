"""422 contracts for discovery-shelf create/update JSON."""

from __future__ import annotations

from uuid import uuid4

import pytest
from flask_login import login_user

from oneirodex.models import User


@pytest.fixture
def admin_user(db_session):
    uid = str(uuid4())
    user = User(
        name=f'pyd_shelf_admin_{uid[:8]}',
        email=f'pyd_shelf_admin_{uid[:8]}@example.com',
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


def test_create_shelf_requires_name(client, app, admin_user):
    _login(client, app, admin_user)
    response = client.post('/admin/api/discovery_sections', json={})
    _assert_unprocessable(response, 'name')


def test_create_shelf_rejects_blank_name(client, app, admin_user):
    _login(client, app, admin_user)
    response = client.post(
        '/admin/api/discovery_sections',
        json={'name': '  ', 'mode': 'manual', 'game_uuids': ['abc']},
    )
    _assert_unprocessable(response, 'name')


def test_update_shelf_requires_name_before_404(client, app, admin_user):
    """Validation runs before the shelf lookup, so `{}` is 422 not 404."""
    _login(client, app, admin_user)
    response = client.put('/admin/api/discovery_sections/999999', json={})
    _assert_unprocessable(response, 'name')


def test_create_shelf_accepts_textarea_game_uuids(client, app, admin_user):
    """Admin theme JS posts the textarea string; that must not 422 as a type error."""
    _login(client, app, admin_user)
    response = client.post(
        '/admin/api/discovery_sections',
        json={'name': 'Staff Picks', 'mode': 'manual', 'game_uuids': 'not-a-real-uuid'},
    )
    assert response.status_code == 400, response.get_data(as_text=True)
    assert 'were found' in response.get_json()['error']
