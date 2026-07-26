"""WebRetro play URL helpers for browse tiles / details."""

from __future__ import annotations

from typing import Any

# Platforms that WebRetro can launch (matches game_details.html supported list).
WEBRETRO_PLATFORMS = frozenset({
    'PCDOS', 'NES', 'SNES', 'N64', 'GB', 'GBA', 'GBC', 'NDS',
    'PSX', 'SEGA_MD', 'SEGA_MS', 'SEGA_32X', 'SEGA_GG',
    'SEGA_SATURN', 'ATARI_7800', 'ATARI_5200', 'ATARI_2600',
    'LYNX', 'JAGUAR', 'WS', 'COLECO', 'VECTREX',
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
        return {'play_url': None, 'can_play_in_browser': False}
    try:
        from gametheca.utils.emulator_profiles import resolve_emulators_for_platform

        resolved = resolve_emulators_for_platform(key)
        core = resolved.get('preferred') or (resolved.get('emulators') or [None])[0]
    except Exception:
        core = None
    if not core or core == 'auto':
        return {
            'play_url': f'/static/vendor/webretro/webretro.html?guid={game.uuid}',
            'can_play_in_browser': True,
        }
    return {
        'play_url': (
            f'/static/vendor/webretro/webretro.html?guid={game.uuid}&core={core}'
        ),
        'can_play_in_browser': True,
    }
