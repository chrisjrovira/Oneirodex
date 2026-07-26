"""Settings-hub module On/Off status for optional admin features.

Arr and AI honor env OR GlobalSettings DB toggles. Hardlink helpers are
env-only safety gates — the hub still surfaces their status so admins can
see why Apply is disabled without opening the page.
"""

from __future__ import annotations

from typing import Any

from flask import current_app
from sqlalchemy import select

from gametheca import db
from gametheca.models import GlobalSettings


def env_flag(name: str, default: str = '') -> bool:
    return str(current_app.config.get(name, default)).lower() in (
        '1',
        'true',
        'yes',
        'on',
    )


def _global_settings() -> GlobalSettings | None:
    return db.session.execute(
        select(GlobalSettings).order_by(GlobalSettings.id).limit(1),
    ).scalars().first()


def ensure_global_settings() -> GlobalSettings:
    row = _global_settings()
    if row is None:
        row = GlobalSettings()
        db.session.add(row)
        db.session.flush()
    return row


def arr_db_enabled() -> bool:
    settings = _global_settings()
    return bool(getattr(settings, 'enable_arr_module', False)) if settings else False


def arr_module_on() -> bool:
    return env_flag('ENABLE_ARR_MODULE') or arr_db_enabled()


def ai_db_enabled() -> bool:
    settings = _global_settings()
    return bool(getattr(settings, 'enable_ai_assist', False)) if settings else False


def ai_module_on() -> bool:
    from gametheca.utils.ai_assist import ai_enabled

    return ai_enabled()


def hardlink_helpers_on() -> bool:
    return env_flag('ENABLE_HARDLINK_HELPERS')


def hardlink_apply_on() -> bool:
    return hardlink_helpers_on() and env_flag('ALLOW_HARDLINK_APPLY')


def settings_hub_module_status() -> dict[str, dict[str, Any]]:
    """Badge payload for settings-shell cards keyed by section id."""
    arr_on = arr_module_on()
    ai_on = ai_module_on()
    helpers_on = hardlink_helpers_on()
    apply_on = hardlink_apply_on()

    storage: dict[str, Any] = {
        'on': helpers_on,
        'label': 'On' if helpers_on else 'Off',
    }
    if helpers_on and not apply_on:
        storage['detail'] = 'Apply off'

    return {
        'arr': {'on': arr_on, 'label': 'On' if arr_on else 'Off'},
        'ai': {'on': ai_on, 'label': 'On' if ai_on else 'Off'},
        'storage': storage,
    }
