"""WebRetro play URL helpers for browse tiles / details."""

from __future__ import annotations

from typing import Any

from gametheca.platform import WEBRETR_INSTALLED_CORES, core_is_browser_playable

# Platforms that WebRetro can launch when a bundled core is available.
WEBRETRO_PLATFORMS = frozenset({
    'NES', 'SNES', 'N64', 'GB', 'GBA', 'GBC', 'NDS', 'VB',
    'PSX', 'SEGA_MD', 'SEGA_MS', 'SEGA_CD', 'SEGA_32X', 'SEGA_GG',
    'SEGA_SATURN', 'ATARI_7800', 'ATARI_5200', 'ATARI_2600',
    'LYNX', 'JAGUAR', 'WS', 'NGP', 'COLECO', 'VECTREX',
    'THREEDO', 'NEOGEO_CD', 'INTV', 'CHAF', 'O2EM',
})


def library_platform_key(game) -> str | None:
    library = getattr(game, 'library', None)
    platform = getattr(library, 'platform', None) if library is not None else None
    if platform is None:
        return None
    name = getattr(platform, 'name', None)
    if name:
        return str(name)
    return str(platform)


def browse_play_fields(game) -> dict[str, Any]:
    """Fields for GameCard play / demo links."""
    key = library_platform_key(game)
    if not key or key not in WEBRETRO_PLATFORMS:
        return {'play_url': None, 'can_play_in_browser': False, 'emulator_cores': []}
    try:
        from gametheca.utils.emulator_profiles import resolve_emulators_for_platform

        resolved = resolve_emulators_for_platform(key)
        cores = [
            core
            for core in (resolved.get('emulators') or [])
            if core_is_browser_playable(core)
        ]
        preferred = resolved.get('preferred')
        if preferred and core_is_browser_playable(preferred) and preferred in cores:
            cores = [preferred] + [c for c in cores if c != preferred]
    except Exception:
        cores = []
        preferred = None

    if not cores:
        return {'play_url': None, 'can_play_in_browser': False, 'emulator_cores': []}

    core = cores[0]
    return {
        'play_url': (
            f'/static/vendor/webretro/webretro.html?guid={game.uuid}&core={core}'
        ),
        'can_play_in_browser': True,
        'emulator_cores': cores,
        'emulator_core': core,
        'webretro_installed_cores': sorted(WEBRETR_INSTALLED_CORES),
    }
