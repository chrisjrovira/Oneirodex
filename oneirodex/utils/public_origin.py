"""Public site origin for invite / share links.

Admin Settings → Site URL is preferred when it is a real non-loopback host.
When that is still the install default, fall back to the host the client
actually reached (`request.url_root`) so LAN invite links are usable.
"""

from __future__ import annotations

from flask import request

from oneirodex.utils.global_settings import global_settings_row

_LOCAL_SITE_DEFAULTS = frozenset({
    '',
    'http://127.0.0.1',
    'http://127.0.0.1:5006',
    'http://localhost',
    'http://localhost:5006',
})


def configured_site_url() -> str:
    settings = global_settings_row()
    return ((settings.site_url if settings else None) or '').strip().rstrip('/')


def is_local_site_url(url: str) -> bool:
    cleaned = (url or '').strip().rstrip('/')
    if cleaned in _LOCAL_SITE_DEFAULTS:
        return True
    return cleaned.startswith('http://127.0.0.1') or cleaned.startswith('http://localhost')


def public_origin() -> str:
    configured = configured_site_url()
    if configured and not is_local_site_url(configured):
        return configured
    try:
        root = (request.url_root or '').rstrip('/')
        if root and not is_local_site_url(root):
            return root
        if root:
            return root
    except RuntimeError:
        pass
    return configured or 'http://127.0.0.1'


def invite_url(token: str) -> str:
    return f'{public_origin()}/register?token={token}'


def site_url_is_configured() -> bool:
    """True when Settings has a non-loopback Site URL (not just request host)."""
    return not is_local_site_url(configured_site_url())
