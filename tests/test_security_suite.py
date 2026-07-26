"""Security unit tests — webhook SSRF, outbound URL policy, path helpers."""

from __future__ import annotations

from gametheca.utils.functions import validate_discord_webhook_url
from gametheca.utils.security import (
    is_blocked_outbound_host,
    is_discord_webhook_url,
    validate_community_chat_url,
    validate_outbound_http_url,
)


def test_discord_webhook_rejects_substring_bypass():
    # Historical bypass: hostname contains discord.com as path segment
    evil = 'https://attacker.example/discord.com/api/webhooks/1/token'
    assert is_discord_webhook_url(evil) is False
    ok, _ = validate_discord_webhook_url(evil)
    assert ok is False


def test_discord_webhook_accepts_real_hosts():
    good = 'https://discord.com/api/webhooks/123456789012345678/AbCdEfGhIjKlMnOpQrStUvWxYz'
    assert is_discord_webhook_url(good) is True
    ok, sanitized = validate_discord_webhook_url(good)
    assert ok is True
    assert sanitized.startswith('https://discord.com/')


def test_discord_webhook_rejects_http_and_wrong_path():
    assert is_discord_webhook_url('http://discord.com/api/webhooks/1/token') is False
    assert is_discord_webhook_url('https://discord.com/api/webhooks/not-a-snowflake/token') is False
    assert is_discord_webhook_url('https://discord.com.evil.com/api/webhooks/1/token') is False


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
