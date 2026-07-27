"""Security unit tests for outbound URL policy and path helpers."""

from __future__ import annotations

from gametheca.utils.security import (
    is_blocked_outbound_host,
    validate_community_chat_url,
    validate_outbound_http_url,
)


def test_blocked_outbound_hosts():
    assert is_blocked_outbound_host('127.0.0.1') is True
    assert is_blocked_outbound_host('169.254.169.254') is True
    assert is_blocked_outbound_host('10.0.0.5') is True
    assert is_blocked_outbound_host('localhost') is True
    assert is_blocked_outbound_host('cdn.example.com') is False


def test_outbound_http_url_blocks_metadata():
    ok, msg = validate_outbound_http_url('http://169.254.169.254/latest/meta-data/', allow_http=True)
    assert ok is False
    assert 'not allowed' in msg.lower() or 'host' in msg.lower()


def test_community_chat_url_blocks_localhost():
    ok, msg = validate_community_chat_url('http://localhost:8080/invite')
    assert ok is False
    ok2, cleaned = validate_community_chat_url('https://stoat.example/invite')
    assert ok2 is True
    assert cleaned.startswith('https://')
