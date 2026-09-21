"""Ops device list (TC-4, v11 H-T): ``list_client_devices`` + ``GET /admin/api/ops/devices``.

The Companions tile counts devices; this is the list behind it -- one row per
heartbeat-registered seat, newest first, with the owner's name and an
``online`` flag on the same window the tile uses.
"""
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from oneirodex.models import ClientDevice, User
from oneirodex.utils.ops_summary import _COMPANION_ONLINE_MINUTES, list_client_devices


@pytest.fixture
def admin_user(db_session):
    uid = str(uuid4())
    admin = User(
        user_id=uid,
        name=f'OpsAdmin_{uid[:8]}',
        email=f'opsadmin_{uid[:8]}@test.com',
        role='admin',
        is_email_verified=True,
        state=True,
    )
    admin.set_password('testpass123')
    db_session.add(admin)
    db_session.commit()
    return admin


@pytest.fixture
def member(db_session):
    uid = str(uuid4())
    row = User(
        user_id=uid,
        name=f'seatowner_{uid[:8]}',
        email=f'seatowner_{uid[:8]}@test.com',
        role='user',
        state=True,
    )
    row.set_password('password123')
    db_session.add(row)
    db_session.commit()
    return row


@pytest.fixture
def _admin_session(client, admin_user):
    with client.session_transaction() as sess:
        sess['_user_id'] = str(admin_user.id)
        sess['_fresh'] = True
    return client


def _seed(db_session, member):
    now = datetime.now(timezone.utc)
    fresh = ClientDevice(
        user_id=member.id,
        device_id=f'thin-{uuid4().hex[:6]}',
        device_kind='thin',
        device_name='Living-room TV',
        client_version='1.0.0',
        last_seen_at=now - timedelta(seconds=20),
    )
    stale = ClientDevice(
        user_id=member.id,
        device_id=f'companion-{uuid4().hex[:6]}',
        device_kind='companion',
        device_name='Gaming PC',
        client_version='0.9.7',
        last_seen_at=now - timedelta(minutes=_COMPANION_ONLINE_MINUTES + 5),
    )
    db_session.add_all([fresh, stale])
    db_session.commit()
    return fresh, stale


def test_list_client_devices_rows_newest_first_with_owner_and_online(db_session, member):
    fresh, stale = _seed(db_session, member)

    result = list_client_devices()

    ids = [row['device_id'] for row in result['devices']]
    assert ids.index(fresh.device_id) < ids.index(stale.device_id)
    by_id = {row['device_id']: row for row in result['devices']}
    assert by_id[fresh.device_id]['online'] is True
    assert by_id[stale.device_id]['online'] is False
    assert by_id[fresh.device_id]['user_name'] == member.name
    assert by_id[fresh.device_id]['device_kind'] == 'thin'
    assert by_id[fresh.device_id]['device_name'] == 'Living-room TV'
    assert result['window_minutes'] == _COMPANION_ONLINE_MINUTES
    assert result['count'] == len(result['devices'])


def test_list_client_devices_limit_is_clamped(db_session, member):
    _seed(db_session, member)
    assert len(list_client_devices(limit=1)['devices']) == 1
    assert len(list_client_devices(limit=0)['devices']) >= 1  # 0 -> at least one row, never an empty page


def test_ops_devices_route_is_admin_only(client, member):
    with client.session_transaction() as sess:
        sess['_user_id'] = str(member.id)
        sess['_fresh'] = True
    response = client.get('/admin/api/ops/devices')
    assert response.status_code in (302, 403)


def test_ops_devices_route_returns_envelope(db_session, member, _admin_session):
    fresh, _stale = _seed(db_session, member)

    response = _admin_session.get('/admin/api/ops/devices?limit=50')

    assert response.status_code == 200
    body = response.get_json()
    assert body['ok'] is True
    assert body['window_minutes'] == _COMPANION_ONLINE_MINUTES
    assert any(row['device_id'] == fresh.device_id and row['online'] for row in body['devices'])
