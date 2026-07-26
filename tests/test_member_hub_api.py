"""API + page smoke tests for collections, news, wishlist, updates."""

from uuid import uuid4

import pytest
from flask_login import login_user

from gametheca.models import Game, Library, User
from gametheca.platform import LibraryPlatform


@pytest.fixture
def admin_user(db_session):
    uid = str(uuid4())
    user = User(
        name=f'hubadmin_{uid[:8]}',
        email=f'hubadmin_{uid[:8]}@example.com',
        role='admin',
        user_id=uid,
        state=True,
    )
    user.set_password('password123')
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def member_user(db_session):
    uid = str(uuid4())
    user = User(
        name=f'hubuser_{uid[:8]}',
        email=f'hubuser_{uid[:8]}@example.com',
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
        name=f'hubchild_{uid[:8]}',
        email=f'hubchild_{uid[:8]}@example.com',
        role='child',
        user_id=uid,
        state=True,
    )
    user.set_password('password123')
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def library(db_session):
    lib = Library(name=f'HubLib_{uuid4().hex[:6]}', platform=LibraryPlatform.PCWIN)
    db_session.add(lib)
    db_session.commit()
    return lib


def _as_user(client, app, user):
    """Log in for subsequent client requests in this test."""
    with client:
        with client.session_transaction() as sess:
            sess['_user_id'] = str(user.get_id())
            sess['_fresh'] = True
        # Ensure flask-login user loader can resolve in app context
        with app.test_request_context():
            login_user(user)


def test_member_pages_require_login(client):
    for path in ('/collections', '/news', '/wishlist', '/updates', '/playtime', '/big-picture'):
        response = client.get(path)
        assert response.status_code in (302, 401)


def test_collections_create_and_list(client, app, db_session, admin_user):
    _as_user(client, app, admin_user)
    with client:
        create = client.post(
            '/api/collections',
            json={'name': 'Cozy Shelf', 'description': 'Warm vibes', 'is_public': True},
        )
        assert create.status_code == 201, create.get_data(as_text=True)
        body = create.get_json()
        assert body['name'] == 'Cozy Shelf'

        listed = client.get('/api/collections')
        assert listed.status_code == 200
        names = [c['name'] for c in listed.get_json()['collections']]
        assert 'Cozy Shelf' in names

        page = client.get('/collections')
        assert page.status_code == 200
        assert b'Collections' in page.data


def test_announcements_admin_create_member_read(client, app, db_session, admin_user, member_user):
    _as_user(client, app, admin_user)
    with client:
        created = client.post(
            '/api/announcements',
            json={'title': 'Hello', 'body': 'Welcome to GameTheca', 'published': True},
        )
        assert created.status_code == 201, created.get_data(as_text=True)

    _as_user(client, app, member_user)
    with client:
        listed = client.get('/api/announcements')
        assert listed.status_code == 200
        titles = [a['title'] for a in listed.get_json()['announcements']]
        assert 'Hello' in titles

        forbidden = client.post(
            '/api/announcements',
            json={'title': 'Nope', 'body': 'Member cannot post', 'published': True},
        )
        assert forbidden.status_code == 403


def test_wishlist_flow_and_child_blocked(client, app, db_session, member_user, child_user, admin_user):
    _as_user(client, app, member_user)
    with client:
        created = client.post('/api/requests', json={'title': 'Hades II', 'notes': 'please'})
        assert created.status_code == 201, created.get_data(as_text=True)
        req_id = created.get_json()['id']

        mine = client.get('/api/requests')
        assert mine.status_code == 200
        assert any(r['id'] == req_id for r in mine.get_json()['requests'])

    _as_user(client, app, child_user)
    with client:
        blocked = client.post('/api/requests', json={'title': 'Blocked Title'})
        assert blocked.status_code == 403

    _as_user(client, app, admin_user)
    with client:
        patched = client.patch(f'/api/requests/{req_id}', json={'status': 'approved'})
        assert patched.status_code == 200
        assert patched.get_json()['status'] == 'approved'


def test_updates_inbox_for_members(client, app, db_session, member_user, library):
    game = Game(
        name='Stale Game',
        full_disk_path='/definitely/not/a/real/path_' + uuid4().hex,
        library_uuid=library.uuid,
        freshness_status='behind',
    )
    db_session.add(game)
    db_session.commit()

    _as_user(client, app, member_user)
    with client:
        response = client.get('/api/updates/inbox')
        assert response.status_code == 200, response.get_data(as_text=True)
        payload = response.get_json()
        assert payload['count'] >= 1
        assert any(item['name'] == 'Stale Game' for item in payload['items'])

        page = client.get('/updates')
        assert page.status_code == 200


def test_playtime_profile_page_and_api(client, app, db_session, member_user, library):
    game = Game(
        name='Playtime Game',
        full_disk_path='/definitely/not/a/real/path_' + uuid4().hex,
        library_uuid=library.uuid,
    )
    db_session.add(game)
    db_session.commit()

    _as_user(client, app, member_user)
    with client:
        empty = client.get('/api/playtime/me')
        assert empty.status_code == 200, empty.get_data(as_text=True)
        payload = empty.get_json()
        assert payload['total_seconds'] == 0
        assert payload['games'] == []

        started = client.post(
            '/api/playtime/sessions',
            json={'game_uuid': game.uuid, 'client': 'web'},
        )
        assert started.status_code == 201, started.get_data(as_text=True)
        session_id = started.get_json()['id']

        stopped = client.post(f'/api/playtime/sessions/{session_id}/stop', json={})
        assert stopped.status_code == 200, stopped.get_data(as_text=True)

        profile = client.get('/api/playtime/me')
        assert profile.status_code == 200
        body = profile.get_json()
        assert body['total_seconds'] >= 0
        assert any(row['game_uuid'] == game.uuid for row in body['games'])

        page = client.get('/playtime')
        assert page.status_code == 200
        assert b'Playtime' in page.data
        assert b'member-app.js' in page.data
        assert b'member-app.css' in page.data


def test_big_picture_page(client, app, member_user):
    _as_user(client, app, member_user)
    with client:
        page = client.get('/big-picture')
        assert page.status_code == 200
        assert b'Big Picture' in page.data
        assert b'member-app.js' in page.data
        assert b'member-app.css' in page.data
