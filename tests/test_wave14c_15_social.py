"""Wave 14c notifications + Wave 15 chat unit tests."""

from __future__ import annotations

from gametheca.utils.chat import MENTION_RE


def test_mention_regex():
    names = {m.group(1) for m in MENTION_RE.finditer('hey @alice and @bob_1')}
    assert names == {'alice', 'bob_1'}


def test_notification_helpers_importable():
    from gametheca.utils.notifications import list_notifications, notify_user, unread_count

    assert callable(notify_user)
    assert callable(list_notifications)
    assert callable(unread_count)


def test_chat_helpers_importable():
    from gametheca.utils.chat import ensure_default_channels, list_channels_for_user, open_or_create_dm

    assert callable(ensure_default_channels)
    assert callable(list_channels_for_user)
    assert callable(open_or_create_dm)
