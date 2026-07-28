"""WSGI SSE fallbacks must not block — ASGI serves the real streams."""

from uuid import uuid4

import pytest

from gametheca.models import User


@pytest.fixture
def member_user(db_session):
    uid = str(uuid4())
    user = User(
        name=f'ssemember_{uid[:8]}',
        email=f'ssemember_{uid[:8]}@example.com',
        role='user',
        user_id=uid,
        state=True,
    )
    user.set_password('password123')
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def child_user(db_session):
    uid = str(uuid4())
    user = User(
        name=f'ssechild_{uid[:8]}',
        email=f'ssechild_{uid[:8]}@example.com',
        role='child',
        user_id=uid,
        state=True,
    )
    user.set_password('password123')
    db_session.add(user)
    db_session.commit()
    return user


def _login(client, user):
    with client.session_transaction() as sess:
        sess['_user_id'] = str(user.get_id())
        sess['_fresh'] = True


def test_activity_stream_wsgi_returns_503(app, member_user):
    client = app.test_client()
    _login(client, member_user)
    response = client.get('/api/activity/stream')
    assert response.status_code == 503
    body = response.get_json()
    assert body['error'] == 'SSE requires ASGI'
    assert 'activity/stream' in body['detail']


def test_events_stream_wsgi_returns_503(app, member_user):
    client = app.test_client()
    _login(client, member_user)
    response = client.get('/api/events/stream')
    assert response.status_code == 503
    body = response.get_json()
    assert body['error'] == 'SSE requires ASGI'


def test_activity_stream_child_forbidden(app, child_user):
    client = app.test_client()
    _login(client, child_user)
    response = client.get('/api/activity/stream')
    assert response.status_code == 403


def test_discover_sections_json_for_member(app, member_user):
    client = app.test_client()
    _login(client, member_user)
    response = client.get('/api/discover/sections')
    assert response.status_code == 200
    assert response.content_type.startswith('application/json')
    payload = response.get_json()
    assert 'sections' in payload
    assert isinstance(payload['sections'], list)
