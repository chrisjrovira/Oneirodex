"""Emulator profile helpers — preferred WebRetro cores per platform."""

from __future__ import annotations

from sqlalchemy import select

from gametheca import db
from gametheca.models import GlobalSettings
from gametheca.platform import Emulator, LibraryPlatform, platform_emulator_mapping


def _global_settings() -> GlobalSettings | None:
    return db.session.execute(
        select(GlobalSettings).order_by(GlobalSettings.id).limit(1),
    ).scalars().first()


def get_emulator_profiles() -> dict[str, str]:
    """Return {platform_name: core_id} overrides from GlobalSettings."""
    settings = _global_settings()
    raw = getattr(settings, 'emulator_profiles', None) if settings else None
    if not isinstance(raw, dict):
        return {}
    cleaned: dict[str, str] = {}
    for key, value in raw.items():
        if not isinstance(key, str) or not isinstance(value, str):
            continue
        platform = key.strip().upper()
        core = value.strip()
        if not platform or not core:
            continue
        cleaned[platform] = core
    return cleaned


def set_emulator_profiles(profiles: dict[str, str | None]) -> dict[str, str]:
    """Validate and persist preferred cores. Empty/null clears a platform."""
    settings = _global_settings()
    if not settings:
        settings = GlobalSettings()
        db.session.add(settings)

    valid_platforms = {p.name for p in LibraryPlatform}
    valid_cores = {e.value for e in Emulator}
    next_map = get_emulator_profiles()

    for platform, core in (profiles or {}).items():
        platform_key = str(platform or '').strip().upper()
        if platform_key not in valid_platforms:
            raise ValueError(f'Unsupported platform: {platform}')
        if core is None or str(core).strip() == '':
            next_map.pop(platform_key, None)
            continue
        core_value = str(core).strip()
        allowed = {e.value for e in platform_emulator_mapping.get(LibraryPlatform[platform_key], [])}
        if core_value not in valid_cores or (allowed and core_value not in allowed):
            raise ValueError(f'Core {core_value} is not valid for {platform_key}')
        next_map[platform_key] = core_value

    settings.emulator_profiles = next_map
    db.session.commit()
    return next_map


def resolve_emulators_for_platform(platform_name: str) -> dict:
    """Return default cores with optional preferred core first."""
    platform_enum = LibraryPlatform[platform_name]
    defaults = [e.value for e in platform_emulator_mapping.get(platform_enum, [])]
    preferred = get_emulator_profiles().get(platform_name.upper())
    ordered = list(defaults)
    if preferred and preferred in ordered:
        ordered.remove(preferred)
        ordered.insert(0, preferred)
    elif preferred:
        ordered.insert(0, preferred)
    return {
        'platform': platform_name,
        'emulators': ordered,
        'preferred': preferred if preferred in (defaults + ([preferred] if preferred else [])) else preferred,
        'defaults': defaults,
    }
