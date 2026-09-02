"""Optional social email notify (Wave 15c email half-step)."""

from __future__ import annotations

from unittest.mock import patch
from uuid import uuid4

import pytest

from oneirodex import db
from oneirodex.models import User, UserPreference
from oneirodex.utils.notifications import maybe_email_social_notify, notify_user
from oneirodex.utils.smtp import is_smtp_config_valid, send_email_quiet


@pytest.fixture
def member(db_session):
    uid = str(uuid4())
    user = User(
        name=f'member_{uid[:8]}',
        email=f'member_{uid[:8]}@example.com',
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


def test_is_smtp_config_valid_when_disabled_returns_false():
    with patch('oneirodex.utils.smtp.get_smtp_settings', return_value=None):
        ok, message = is_smtp_config_valid()
    assert ok is False
    assert 'not enabled' in message.lower()


def test_send_email_quiet_skips_when_smtp_off():
    with patch('oneirodex.utils.smtp.get_smtp_settings', return_value=None):
        assert send_email_quiet('a@b.c', 'Hi', '<p>x</p>') is False


def test_maybe_email_skips_when_pref_off(app, db_session, member):
    with app.app_context():
        prefs = UserPreference(user_id=member.id, email_notify_social=False)
        db_session.add(prefs)
        db_session.commit()
        with patch('oneirodex.utils.notifications.send_email_quiet') as send:
            assert maybe_email_social_notify(
                member.id,
                kind='mention',
                title='Ping',
                body='hi',
                link='/chat',
            ) is False
            send.assert_not_called()


def test_maybe_email_sends_when_pref_on(app, db_session, member):
    with app.app_context():
        prefs = UserPreference(user_id=member.id, email_notify_social=True)
        db_session.add(prefs)
        db_session.commit()
        with patch('oneirodex.utils.notifications.send_email_quiet', return_value=True) as send:
            assert maybe_email_social_notify(
                member.id,
                kind='dm',
                title='Message from Alice',
                body='hello',
                link='/chat',
            ) is True
            send.assert_called_once()
            args = send.call_args[0]
            assert args[0] == member.email
            assert 'Message from Alice' in args[1]
            assert 'hello' in args[2]


def test_maybe_email_skips_unverified(app, db_session, member):
    with app.app_context():
        user = db.session.get(User, member.id)
        assert user is not None
        user.is_email_verified = False
        prefs = UserPreference(user_id=user.id, email_notify_social=True)
        db.session.add(prefs)
        db.session.commit()
        with patch('oneirodex.utils.notifications.send_email_quiet') as send:
            assert maybe_email_social_notify(
                user.id,
                kind='mention',
                title='Ping',
                body='hi',
                link='/chat',
            ) is False
            send.assert_not_called()


def test_notify_user_triggers_email_for_mention(app, db_session, member):
    with app.app_context():
        prefs = UserPreference(
            user_id=member.id,
            notify_mentions=True,
            email_notify_social=True,
        )
        db_session.add(prefs)
        db_session.commit()
        with patch('oneirodex.utils.notifications.send_email_quiet', return_value=True) as send:
            row = notify_user(
                member.id,
                kind='mention',
                title='Bob mentioned you',
                body='@you hello',
                link='/chat',
                pref_flag='notify_mentions',
            )
            assert row is not None
            send.assert_called_once()


def test_notify_user_skips_email_for_friend_request(app, db_session, member):
    with app.app_context():
        prefs = UserPreference(user_id=member.id, email_notify_social=True)
        db_session.add(prefs)
        db_session.commit()
        with patch('oneirodex.utils.notifications.send_email_quiet') as send:
            row = notify_user(
                member.id,
                kind='friend_request',
                title='Friend request',
                link='/activity',
            )
            assert row is not None
            send.assert_not_called()
