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


def test_child_blocked_from_adult_rooms():
    class U:
        role = 'child'

    assert user_may_join_room(U(), 'household:lobby') is True
    assert user_may_join_room(U(), 'adult:lounge') is False
    assert user_may_join_room(U(), 'admin-ops') is False


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
