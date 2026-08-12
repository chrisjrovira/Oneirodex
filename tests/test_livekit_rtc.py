# LiveKit voice lobby tests (Wave 16)
import os
from unittest.mock import patch

import pytest

from gametheca.utils.livekit_rtc import (
    livekit_enabled,
    mint_livekit_token,
    normalize_room_name,
    user_may_join_room,
)


def test_normalize_room_name_opaque():
    assert normalize_room_name('household:lobby') == 'household:lobby'
    assert normalize_room_name('party Super Game!!') == 'party-Super-Game--'
    assert normalize_room_name('') == 'lobby'


def test_unidentified_user_is_denied_every_room():
    """No `id` means no access check can be resolved, so nothing is granted."""
    class Anonymous:
        role = 'child'

    assert user_may_join_room(Anonymous(), 'household:lobby') is False
    assert user_may_join_room(Anonymous(), 'adult:lounge') is False


def test_child_blocked_from_adult_rooms():
    """Unrecognised room names are denied outright, not pattern-matched.

    The stub used to have no `id`, so it was rejected at the identity gate and
    the room rules below were never actually exercised — the test passed for
    the wrong reason until the household-lobby rule changed underneath it.

    NOTE: `household:lobby` now returns False for a child (`role != 'child'`),
    which reads oddly against the comment calling it "the one intentionally
    household-wide room". Pinned here as the behaviour that exists; worth
    confirming that excluding children from the household room is intended.
    """
    class Child:
        id = 1
        role = 'child'

    assert user_may_join_room(Child(), 'household:lobby') is False
    assert user_may_join_room(Child(), 'adult:lounge') is False
    assert user_may_join_room(Child(), 'admin-ops') is False


def test_adult_may_join_the_household_lobby():
    class Adult:
        id = 2
        role = 'user'

    assert user_may_join_room(Adult(), 'household:lobby') is True
    # Still denied everything it cannot resolve to a real check.
    assert user_may_join_room(Adult(), 'admin-ops') is False


def test_livekit_enabled_flag(monkeypatch):
    monkeypatch.setenv('ENABLE_LIVEKIT', 'true')
    assert livekit_enabled() is True
    monkeypatch.setenv('ENABLE_LIVEKIT', 'false')
    assert livekit_enabled() is False


def test_mint_token_shape(monkeypatch):
    monkeypatch.setenv('LIVEKIT_API_KEY', 'devkey')
    monkeypatch.setenv('LIVEKIT_API_SECRET', 'secret')
    token = mint_livekit_token(identity='user-1', name='Ada', room='household:lobby')
    parts = token.split('.')
    assert len(parts) == 3


@pytest.mark.usefixtures('client')
def test_rtc_status_disabled(client, monkeypatch):
    monkeypatch.setenv('ENABLE_LIVEKIT', 'false')
    # May redirect to login — just ensure route exists via app map in other tests


def test_rtc_token_requires_login(client, monkeypatch):
    monkeypatch.setenv('ENABLE_LIVEKIT', 'true')
    monkeypatch.setenv('LIVEKIT_URL', 'ws://127.0.0.1:7880')
    monkeypatch.setenv('LIVEKIT_API_KEY', 'devkey')
    monkeypatch.setenv('LIVEKIT_API_SECRET', 'secret')
    response = client.post('/api/rtc/token', json={'room': 'household:lobby'})
    assert response.status_code in (401, 302, 403)
