"""W25-STORE-2 — admin shelf layout + event window API."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from flask import json
from sqlalchemy import text

from gametheca import db
from gametheca.models import DiscoverySection, User


@pytest.fixture(scope='function', autouse=True)
def clean_sections(db_session):
    db_session.execute(text('DELETE FROM discovery_sections'))
    db_session.commit()


@pytest.fixture
def admin_user(db_session):
    uid = str(uuid4())
    user = User(
        name=f'admin_{uid[:8]}',
        email=f'admin_{uid[:8]}@example.com',
        password_hash='hashed_password',
        role='admin',
        user_id=uid,
        avatarpath='newstyle/avatar_default.jpg',
        invite_quota=10,
        is_email_verified=True,
    )
    user.set_password('adminpassword123')
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def shelf(db_session):
    section = DiscoverySection(
        name='Upcoming',
        identifier='upcoming',
        is_visible=True,
        display_order=7,
        section_type='seed',
    )
    db_session.add(section)
    db_session.commit()
    return section


def _login(client, admin_user):
    with client.session_transaction() as sess:
        sess['_user_id'] = str(admin_user.id)
        sess['_fresh'] = True


def test_sets_layout_and_window_on_a_seed_shelf(client, app, db_session, admin_user, shelf):
    """Seed shelves must be schedulable too — that is what makes them events."""
    _login(client, admin_user)
    starts = datetime.now(timezone.utc) - timedelta(hours=1)
    ends = datetime.now(timezone.utc) + timedelta(days=3)

    response = client.put(
        f'/admin/api/discovery_sections/{shelf.id}/schedule',
        json={
            'layout': 'hero',
            'starts_at': starts.isoformat(),
            'ends_at': ends.isoformat(),
        },
    )
    assert response.status_code == 200
    body = json.loads(response.data)
    assert body['success'] is True
    assert body['section']['layout'] == 'hero'
    assert body['section']['is_live'] is True

    refreshed = db.session.get(DiscoverySection, shelf.id)
    assert refreshed.layout == 'hero'
    assert refreshed.ends_at is not None


def test_rejects_unknown_layout(client, app, db_session, admin_user, shelf):
    _login(client, admin_user)
    response = client.put(
        f'/admin/api/discovery_sections/{shelf.id}/schedule',
        json={'layout': 'billboard'},
    )
    assert response.status_code == 400
    assert 'layout must be' in json.loads(response.data)['error']


def test_rejects_window_that_closes_before_it_opens(client, app, db_session, admin_user, shelf):
    """Otherwise the shelf would silently never render."""
    _login(client, admin_user)
    now = datetime.now(timezone.utc)
    response = client.put(
        f'/admin/api/discovery_sections/{shelf.id}/schedule',
        json={
            'starts_at': (now + timedelta(days=2)).isoformat(),
            'ends_at': (now + timedelta(days=1)).isoformat(),
        },
    )
    assert response.status_code == 400
    assert 'after starts_at' in json.loads(response.data)['error']


def test_rejects_unparseable_timestamp(client, app, db_session, admin_user, shelf):
    _login(client, admin_user)
    response = client.put(
        f'/admin/api/discovery_sections/{shelf.id}/schedule',
        json={'ends_at': 'next tuesday'},
    )
    assert response.status_code == 400


def test_clears_the_window_with_null(client, app, db_session, admin_user, shelf):
    _login(client, admin_user)
    client.put(
        f'/admin/api/discovery_sections/{shelf.id}/schedule',
        json={'ends_at': (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()},
    )
    response = client.put(
        f'/admin/api/discovery_sections/{shelf.id}/schedule',
        json={'ends_at': None},
    )
    assert response.status_code == 200
    assert db.session.get(DiscoverySection, shelf.id).ends_at is None


def test_missing_shelf_is_404(client, app, db_session, admin_user):
    _login(client, admin_user)
    response = client.put(
        '/admin/api/discovery_sections/999999/schedule',
        json={'layout': 'hero'},
    )
    assert response.status_code == 404
