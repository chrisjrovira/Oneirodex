"""Wave 15c — per-channel mute API + notification fanout."""

from __future__ import annotations

from unittest.mock import patch
from uuid import uuid4

import pytest
from flask_login import login_user

from gametheca import db
from gametheca.models import ChatChannel, User
from gametheca.utils.chat import (
    ensure_default_channels,
    list_channels_for_user,
    open_or_create_dm,
    post_message,
    set_channel_muted,
)


@pytest.fixture
def alice(db_session):
    uid = str(uuid4())
    user = User(
        name=f'alice_{uid[:8]}',
        email=f'alice_{uid[:8]}@example.com',
        password_hash='hashed_password',
        role='user',
        user_id=uid,
        avatarpath='newstyle/avatar_default.jpg',
        invite_quota=5,
        is_email_verified=True,
    )
    user.set_password('testpassword123')
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def bob(db_session):
    uid = str(uuid4())
    user = User(
        name=f'bob_{uid[:8]}',
        email=f'bob_{uid[:8]}@example.com',
        password_hash='hashed_password',
        role='user',
        user_id=uid,
        avatarpath='newstyle/avatar_default.jpg',
        invite_quota=5,
        is_email_verified=True,
    )
    user.set_password('testpassword123')
    db_session.add(user)
    db_session.commit()
    return user


def _login(client, app, account):
    with client.session_transaction() as sess:
        sess['_user_id'] = str(account.id)
        sess['_fresh'] = True
    with app.test_request_context():
        login_user(account)


def test_set_channel_muted_and_list(app, db_session, alice):
    with app.app_context():
        ensure_default_channels()
        channels = list_channels_for_user(alice)
        assert channels
        general = next(c for c in channels if c.get('slug') == 'general')
        assert general['muted'] is False
        ch = db.session.get(ChatChannel, general['id'])
        assert set_channel_muted(alice, ch, True) is True
        again = list_channels_for_user(alice)
        muted = next(c for c in again if c['id'] == general['id'])
        assert muted['muted'] is True


def test_mention_fanout_skips_muted_member(app, db_session, alice, bob):
    with app.app_context():
        ensure_default_channels()
        channels = list_channels_for_user(alice)
        list_channels_for_user(bob)
        general = next(c for c in channels if c.get('slug') == 'general')
        ch = db.session.get(ChatChannel, general['id'])
        set_channel_muted(bob, ch, True)

        with patch('gametheca.utils.chat.notify_user') as notify:
            msg = post_message(ch, alice, f'hey @{bob.name} ping')
            assert msg is not None
            notify.assert_not_called()


def test_dm_fanout_skips_muted(app, db_session, alice, bob):
    with app.app_context():
        dm = open_or_create_dm(alice, bob)
        set_channel_muted(bob, dm, True)
        with patch('gametheca.utils.chat.notify_user') as notify:
            post_message(dm, alice, 'quiet please')
            notify.assert_not_called()


def test_mute_api_persists(client, app, db_session, alice):
    with app.app_context():
        ensure_default_channels()
        channels = list_channels_for_user(alice)
        channel_id = next(c for c in channels if c.get('slug') == 'general')['id']

    _login(client, app, alice)
    response = client.post(
        f'/api/chat/channels/{channel_id}/mute',
        json={'muted': True},
    )
    assert response.status_code == 200
    payload = response.get_json()
    assert payload['ok'] is True
    assert payload['muted'] is True

    listed = client.get('/api/chat/channels')
    assert listed.status_code == 200
    row = next(c for c in listed.get_json()['channels'] if c['id'] == channel_id)
    assert row['muted'] is True


def test_mute_api_404_inaccessible(client, app, db_session, alice):
    _login(client, app, alice)
    response = client.post('/api/chat/channels/999999/mute', json={'muted': True})
    assert response.status_code == 404
