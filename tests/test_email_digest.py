"""Batched email digest tests."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import uuid4

import pytest

from oneirodex import db
from oneirodex.models import User, UserNotification, UserPreference
from oneirodex.utils.email_digest import run_email_digest_batch, send_digest_for_user
from oneirodex.utils.notifications import notify_user


@pytest.fixture
def member(db_session):
    uid = str(uuid4())
    user = User(
        name=f'digest_{uid[:8]}',
        email=f'digest_{uid[:8]}@example.com',
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


def test_digest_skips_when_pref_off(app, db_session, member):
    with app.app_context():
        prefs = UserPreference(user_id=member.id, email_digest_daily=False)
        db.session.add(prefs)
        db.session.commit()
        notify_user(member.id, kind='mention', title='Hi', body='x', link='/chat')
        with patch('oneirodex.utils.email_digest.send_email_quiet') as send:
            assert send_digest_for_user(member, prefs) is False
            send.assert_not_called()


def test_digest_skips_when_no_unread(app, db_session, member):
    with app.app_context():
        prefs = UserPreference(user_id=member.id, email_digest_daily=True)
        db.session.add(prefs)
        db.session.commit()
        with patch('oneirodex.utils.email_digest.send_email_quiet') as send:
            assert send_digest_for_user(member, prefs) is False
            send.assert_not_called()


def test_digest_sends_and_sets_watermark(app, db_session, member):
    with app.app_context():
        prefs = UserPreference(user_id=member.id, email_digest_daily=True)
        db.session.add(prefs)
        db.session.commit()
        notify_user(member.id, kind='mention', title='Ping', body='hello', link='/chat')
        notify_user(member.id, kind='free_game', title='Free now', body='Game', link='/news')
        now = datetime.now(timezone.utc)
        with patch('oneirodex.utils.email_digest.send_email_quiet', return_value=True) as send:
            assert send_digest_for_user(member, prefs, now=now) is True
            send.assert_called_once()
            args = send.call_args[0]
            assert args[0] == member.email
            assert '2 unread' in args[1]
            assert 'Ping' in args[2]
            assert 'Free now' in args[2]
        db.session.refresh(prefs)
        assert prefs.email_digest_last_sent_at is not None


def test_digest_respects_interval_watermark(app, db_session, member):
    with app.app_context():
        now = datetime.now(timezone.utc)
        prefs = UserPreference(
            user_id=member.id,
            email_digest_daily=True,
            email_digest_last_sent_at=now - timedelta(hours=1),
        )
        db.session.add(prefs)
        db.session.commit()
        notify_user(member.id, kind='dm', title='Msg', body='hi', link='/chat')
        with patch('oneirodex.utils.email_digest.send_email_quiet') as send:
            assert send_digest_for_user(member, prefs, now=now) is False
            send.assert_not_called()


def test_digest_skips_unverified(app, db_session, member):
    with app.app_context():
        user = db.session.get(User, member.id)
        user.is_email_verified = False
        prefs = UserPreference(user_id=user.id, email_digest_daily=True)
        db.session.add(prefs)
        db.session.commit()
        notify_user(user.id, kind='mention', title='Ping', body='x', link='/chat')
        with patch('oneirodex.utils.email_digest.send_email_quiet') as send:
            assert send_digest_for_user(user, prefs) is False
            send.assert_not_called()


def test_run_batch_counts(app, db_session, member):
    with app.app_context():
        prefs = UserPreference(user_id=member.id, email_digest_daily=True)
        db.session.add(prefs)
        db.session.commit()
        notify_user(member.id, kind='mention', title='A', body='b', link='/chat')
        with patch('oneirodex.utils.email_digest.send_email_quiet', return_value=True):
            stats = run_email_digest_batch()
        assert stats['considered'] >= 1
        assert stats['sent'] >= 1
