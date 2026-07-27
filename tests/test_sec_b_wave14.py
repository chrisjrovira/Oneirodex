"""Sec-B + Wave 14 unit coverage."""

from __future__ import annotations

from gametheca.utils.security import validate_outbound_http_url


def test_private_lan_blocked_by_default(monkeypatch):
    monkeypatch.delenv('ALLOW_PRIVATE_LAN_URLS', raising=False)
    ok, _ = validate_outbound_http_url(
        'http://192.168.1.50:8080/api',
        allow_http=True,
        allow_private_lan=False,
    )
    assert ok is False


def test_private_lan_allowed_when_flagged():
    ok, cleaned = validate_outbound_http_url(
        'http://192.168.1.50:8080/api',
        allow_http=True,
        allow_private_lan=True,
    )
    assert ok is True
    assert '192.168.1.50' in cleaned


def test_metadata_blocked_even_with_lan_flag():
    ok, _ = validate_outbound_http_url(
        'http://169.254.169.254/latest/meta-data/',
        allow_http=True,
        allow_private_lan=True,
    )
    assert ok is False


def test_presence_helpers_importable():
    from gametheca.utils.presence import AWAY_AFTER_SECONDS, presence_for_user

    assert AWAY_AFTER_SECONDS > 0
    assert callable(presence_for_user)


def test_oidc_lock_roles_default_true():
    from config import Config

    assert Config.OIDC_LOCK_ROLES is True
