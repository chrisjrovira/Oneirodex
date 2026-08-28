"""Browser play engine settings (BP-0 stub).

Admin keys live under ``GlobalSettings.settings['browser_player']``.
Only engines that are actually wired may be the default or listed as
available — honesty lock: no fake EmulatorJS Play until that shell ships.
"""

from __future__ import annotations

from typing import Any

from flask import g, has_request_context
from sqlalchemy import select

from gametheca import db
from gametheca.models import GlobalSettings

STORAGE_KEY = 'browser_player'

# Names we recognize in settings. Availability is a separate set.
KNOWN_ENGINES = ('webretro', 'emulatorjs')
SHIPPED_ENGINES = ('webretro',)

DEFAULTS: dict[str, Any] = {
    'browser_player_default': 'webretro',
    'browser_player_allow_member_choice': False,
    'webrcade_sidecar_url': '',
    'webrcade_feed_export': False,
}


def _settings_row() -> GlobalSettings | None:
    return db.session.execute(
        select(GlobalSettings).order_by(GlobalSettings.id).limit(1),
    ).scalars().first()


def _ensure_settings_row() -> GlobalSettings:
    row = _settings_row()
    if row is None:
        row = GlobalSettings(settings={})
        db.session.add(row)
        db.session.flush()
    return row


def _blob(row: GlobalSettings | None) -> dict[str, Any]:
    raw = getattr(row, 'settings', None) if row is not None else None
    if not isinstance(raw, dict):
        return {}
    nested = raw.get(STORAGE_KEY)
    return nested if isinstance(nested, dict) else {}


def _clean_url(value: Any) -> str:
    text = str(value or '').strip()
    if not text:
        return ''
    if not (text.startswith('http://') or text.startswith('https://')):
        raise ValueError('webrcade_sidecar_url must be http(s) or empty')
    return text.rstrip('/')


def normalize_browser_player_settings(raw: dict[str, Any] | None) -> dict[str, Any]:
    """Return a full settings dict from a partial payload (no I/O)."""
    src = raw if isinstance(raw, dict) else {}
    default = str(src.get('browser_player_default') or DEFAULTS['browser_player_default']).strip().lower()
    if default not in KNOWN_ENGINES:
        raise ValueError(f'Unsupported browser_player_default: {default}')
    if default not in SHIPPED_ENGINES:
        raise ValueError(
            f'{default} is not wired yet — default must be one of: {", ".join(SHIPPED_ENGINES)}'
        )
    allow = src.get(
        'browser_player_allow_member_choice',
        DEFAULTS['browser_player_allow_member_choice'],
    )
    if isinstance(allow, str):
        allow = allow.strip().lower() in ('1', 'true', 'yes', 'on')
    else:
        allow = bool(allow)
    export = src.get('webrcade_feed_export', DEFAULTS['webrcade_feed_export'])
    if isinstance(export, str):
        export = export.strip().lower() in ('1', 'true', 'yes', 'on')
    else:
        export = bool(export)
    return {
        'browser_player_default': default,
        'browser_player_allow_member_choice': allow,
        'webrcade_sidecar_url': _clean_url(src.get('webrcade_sidecar_url')),
        'webrcade_feed_export': export,
        'browser_players_available': list(SHIPPED_ENGINES),
    }


def get_browser_player_settings() -> dict[str, Any]:
    """Read stored admin keys, filling defaults. Safe without a settings row."""
    if has_request_context() and hasattr(g, '_browser_player_settings'):
        return g._browser_player_settings
    try:
        merged = {**DEFAULTS, **_blob(_settings_row())}
        cleaned = normalize_browser_player_settings(merged)
    except Exception:
        cleaned = normalize_browser_player_settings(DEFAULTS)
    if has_request_context():
        g._browser_player_settings = cleaned
    return cleaned


def set_browser_player_settings(payload: dict[str, Any] | None) -> dict[str, Any]:
    """Validate and persist admin browser-player keys."""
    cleaned = normalize_browser_player_settings(
        {**get_browser_player_settings(), **(payload or {})},
    )
    row = _ensure_settings_row()
    current = dict(row.settings) if isinstance(row.settings, dict) else {}
    stored = {
        'browser_player_default': cleaned['browser_player_default'],
        'browser_player_allow_member_choice': cleaned['browser_player_allow_member_choice'],
        'webrcade_sidecar_url': cleaned['webrcade_sidecar_url'],
        'webrcade_feed_export': cleaned['webrcade_feed_export'],
    }
    current[STORAGE_KEY] = stored
    row.settings = current
    db.session.commit()
    if has_request_context() and hasattr(g, '_browser_player_settings'):
        delattr(g, '_browser_player_settings')
    return cleaned


def play_engine_fields() -> dict[str, Any]:
    """Fields for browse/details play payloads. Never lists an unwired engine."""
    try:
        settings = get_browser_player_settings()
        default = settings['browser_player_default']
    except Exception:
        default = 'webretro'
    if default not in SHIPPED_ENGINES:
        default = 'webretro'
    return {
        'browser_player': default,
        'browser_players_available': list(SHIPPED_ENGINES),
    }
