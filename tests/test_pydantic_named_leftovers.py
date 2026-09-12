"""422 contracts for leftover named-field JSON (order, visibility, cover search, set-active)."""

from __future__ import annotations

from uuid import uuid4

import pytest
from flask_login import login_user

from oneirodex.models import User


@pytest.fixture
def admin_user(db_session):
    uid = str(uuid4())
    user = User(
        name=f'pyd_left_admin_{uid[:8]}',
        email=f'pyd_left_admin_{uid[:8]}@example.com',
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


def test_section_order_requires_sections(client, app, admin_user):
    _login(client, app, admin_user)
    response = client.post('/admin/api/discovery_sections/order', json={})
    _assert_unprocessable(response, 'sections')


def test_section_order_coerces_string_ids(client, app, admin_user, db_session):
    """Theme JS posts dataset strings; that must not 422."""
    from oneirodex.models import DiscoverySection

    _login(client, app, admin_user)
    section = DiscoverySection(
        identifier='pyd-order',
        name='Order Probe',
        is_visible=True,
        display_order=0,
    )
    db_session.add(section)
    db_session.commit()
    response = client.post(
        '/admin/api/discovery_sections/order',
        json={'sections': [{'id': str(section.id), 'order': 3}]},
    )
    assert response.status_code == 200, response.get_data(as_text=True)
    db_session.refresh(section)
    assert section.display_order == 3


def test_section_visibility_requires_fields(client, app, admin_user):
    _login(client, app, admin_user)
    response = client.post('/admin/api/discovery_sections/visibility', json={})
    _assert_unprocessable(response, 'section_id')
    assert 'is_visible' in response.get_json()['detail']


def test_section_visibility_rejects_string_bool(client, app, admin_user):
    _login(client, app, admin_user)
    response = client.post(
        '/admin/api/discovery_sections/visibility',
        json={'section_id': 1, 'is_visible': 'true'},
    )
    _assert_unprocessable(response, 'is_visible')


def test_cover_search_requires_query_or_game_uuid(client, app, admin_user):
    _login(client, app, admin_user)
    response = client.post('/admin/api/covers/search', json={})
    _assert_unprocessable(response, '__root__')


def test_cover_search_whitespace_query_does_not_fall_through(client, app, admin_user):
    _login(client, app, admin_user)
    response = client.post(
        '/admin/api/covers/search',
        json={'query': '  ', 'q': 'Doom'},
    )
    _assert_unprocessable(response, '__root__')


def test_set_active_profile_requires_id_alias(client, app, admin_user):
    _login(client, app, admin_user)
    response = client.put('/api/quality-profiles/active', json={})
    _assert_unprocessable(response, '__root__')


def test_set_active_whitespace_id_does_not_fall_through(client, app, admin_user):
    _login(client, app, admin_user)
    response = client.put(
        '/api/quality-profiles/active',
        json={'id': '  ', 'active_id': 'p1'},
    )
    _assert_unprocessable(response, '__root__')
