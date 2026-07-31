"""Admin loading-icon mode: rotate catalogue vs lock to one icon id.

Member/admin SPAs read the public payload and pick a spinner glyph without
admin auth. Assets/CSS for each id live in themes / SPA (UI owns visuals).
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import select

from gametheca import db
from gametheca.models import GlobalSettings

LOADING_ICON_MODES = frozenset({'rotate', 'lock'})
DEFAULT_LOADING_ICON_MODE = 'rotate'
DEFAULT_LOADING_ICON_ID = None

# Builtin catalogue ids — SPA/theme maps each id to a spinner treatment.
BUILTIN_LOADING_ICONS: list[dict[str, Any]] = [
    {
        'id': 'ring',
        'name': 'Ring',
        'description': 'Default CSS ring (gt-spinner).',
    },
    {
        'id': 'orbit',
        'name': 'Orbit',
        'description': 'Orbiting dots around a center mark.',
    },
    {
        'id': 'pulse',
        'name': 'Pulse',
        'description': 'Soft pulse / breathe loader.',
    },
    {
        'id': 'blocks',
        'name': 'Blocks',
        'description': 'Chunky block cascade — retro-friendly.',
    },
    {
        'id': 'scan',
        'name': 'Scan',
        'description': 'Horizontal scan sweep for library ops.',
    },
    {
        'id': 'arcade',
        'name': 'Arcade',
        'description': 'Coin-slot style bounce.',
    },
]


def catalogue_ids() -> frozenset[str]:
    return frozenset(row['id'] for row in BUILTIN_LOADING_ICONS)


def list_loading_icons() -> list[dict[str, Any]]:
    return [dict(row) for row in BUILTIN_LOADING_ICONS]


def _settings_row() -> GlobalSettings | None:
    return db.session.execute(
        select(GlobalSettings).order_by(GlobalSettings.id).limit(1),
    ).scalars().first()


def _ensure_settings_row() -> GlobalSettings:
    row = _settings_row()
    if row is None:
        row = GlobalSettings()
        db.session.add(row)
        db.session.flush()
    return row


def normalize_mode(raw: Any) -> str:
    mode = str(raw or DEFAULT_LOADING_ICON_MODE).strip().lower()
    if mode not in LOADING_ICON_MODES:
        return DEFAULT_LOADING_ICON_MODE
    return mode


def normalize_icon_id(raw: Any, *, allow_null: bool = True) -> str | None:
    if raw is None:
        return None if allow_null else 'ring'
    text = str(raw).strip()
    if not text:
        return None if allow_null else 'ring'
    if len(text) > 64:
        raise ValueError('loading_icon_id must be at most 64 characters')
    if text not in catalogue_ids():
        raise ValueError(
            f'Unknown loading_icon_id {text!r}; choose one of: '
            + ', '.join(sorted(catalogue_ids())),
        )
    return text


def get_loading_icon_settings(*, admin: bool = False) -> dict[str, Any]:
    """Return persisted loading-icon settings (+ catalogue for pickers)."""
    row = _settings_row()
    mode = normalize_mode(getattr(row, 'loading_icon_mode', None) if row else None)
    raw_id = getattr(row, 'loading_icon_id', None) if row else None
    icon_id: str | None = None
    if raw_id is not None:
        text = str(raw_id).strip()
        if text and text in catalogue_ids():
            icon_id = text

    # Lock without a valid id is unsafe for UIs — readers fall back to rotate.
    effective_mode = mode if not (mode == 'lock' and not icon_id) else 'rotate'
    resolved = icon_id if effective_mode == 'lock' else None

    payload: dict[str, Any] = {
        'loading_icon_mode': effective_mode,
        'loading_icon_id': icon_id if effective_mode == 'lock' else None,
        'resolved_id': resolved,
        'catalogue': list_loading_icons(),
        'defaults': {
            'loading_icon_mode': DEFAULT_LOADING_ICON_MODE,
            'loading_icon_id': DEFAULT_LOADING_ICON_ID,
        },
    }
    if admin:
        payload['modes'] = sorted(LOADING_ICON_MODES)
        # Surface stored values even when effective mode fell back.
        payload['stored_mode'] = mode
        payload['stored_id'] = icon_id
    return payload


def member_loading_icon_payload() -> dict[str, Any]:
    """Public/member-safe bootstrap (no secrets)."""
    data = get_loading_icon_settings(admin=False)
    return {
        'loading_icon_mode': data['loading_icon_mode'],
        'loading_icon_id': data['loading_icon_id'],
        'resolved_id': data['resolved_id'],
        'catalogue': data['catalogue'],
    }


def save_loading_icon_settings(data: dict[str, Any]) -> dict[str, Any]:
    """Persist admin loading-icon mode/id. Raises ValueError on bad input."""
    if not isinstance(data, dict) or not data:
        raise ValueError('No fields to update')

    row = _ensure_settings_row()
    mode = normalize_mode(
        data['loading_icon_mode']
        if 'loading_icon_mode' in data
        else getattr(row, 'loading_icon_mode', None),
    )

    if 'loading_icon_id' in data:
        icon_id = normalize_icon_id(data.get('loading_icon_id'), allow_null=True)
    else:
        raw = getattr(row, 'loading_icon_id', None)
        icon_id = None
        if raw is not None:
            text = str(raw).strip()
            if text and text in catalogue_ids():
                icon_id = text

    if mode == 'lock' and not icon_id:
        raise ValueError('loading_icon_id is required when loading_icon_mode is lock')

    if mode == 'rotate':
        # Rotate uses the full catalogue; clear any locked id.
        icon_id = None

    row.loading_icon_mode = mode
    row.loading_icon_id = icon_id
    db.session.commit()
    return get_loading_icon_settings(admin=True)
