"""WebRetro play URL helpers for browse tiles / details."""

from __future__ import annotations

from typing import Any

from gametheca.platform import (
    core_is_browser_playable,
    mapped_core_ids,
    pcdos_browser_enabled,
    play_mode_for_platform,
)
from gametheca.utils.webretro_cores import get_effective_installed_cores

# Platforms that WebRetro can launch when a bundled core is available.
WEBRETRO_PLATFORMS = frozenset({
    'NES', 'SNES', 'N64', 'GB', 'GBA', 'GBC', 'NDS', 'VB',
    'PSX', 'SEGA_MD', 'SEGA_MS', 'SEGA_CD', 'SEGA_32X', 'SEGA_GG',
    'SEGA_SATURN', 'ATARI_7800', 'ATARI_5200', 'ATARI_2600',
    'LYNX', 'JAGUAR', 'WS', 'NGP', 'COLECO', 'VECTREX',
    'THREEDO', 'NEOGEO_CD', 'INTV', 'CHAF', 'O2EM',
    'PCE', 'VICE_X64SC', 'VICE_X128', 'VICE_XVIC', 'VICE_XPLUS4', 'VICE_XPET',
    'PCDOS',
})

# Wave 19c+ — honest companion copy when no browser core ships.
COMPANION_HINTS = {
    'NGC': (
        'GameCube plays via the desktop companion or Dolphin / RetroArch (dolphin). '
        'No browser Play — WASM Dolphin is not shipped.'
    ),
    'WII': (
        'Wii plays via the desktop companion or Dolphin / RetroArch (dolphin). '
        'No browser Play — WASM Dolphin is not shipped.'
    ),
    'SEGA_DC': (
        'Dreamcast: use Flycast via desktop companion / RetroArch (flycast). '
        'Not browser-playable in this build.'
    ),
    'N3DS': (
        'Nintendo 3DS: use Citra-class / RetroArch companion (citra). '
        'Not browser-playable in this build.'
    ),
    'PS2': (
        'PS2: use PCSX2 or a RetroArch PCSX2 profile via the desktop companion. '
        'Not browser-playable.'
    ),
    'PSVITA': (
        'PS Vita: use Vita3K via the desktop companion when installed. '
        'Not browser-playable.'
    ),
    'PS3': (
        'PS3: catalog + optional BYO RPCS3 companion. No browser Play.'
    ),
    'PS4': (
        'PS4: catalog + optional BYO companion. No browser Play.'
    ),
    'XBOX': (
        'Original Xbox: catalog + optional BYO Xemu/Xenia-class companion. No browser Play.'
    ),
    'X360': (
        'Xbox 360: catalog + optional BYO Xenia companion. No browser Play.'
    ),
    'XONE': (
        'Xbox One: catalog + optional BYO companion. No browser Play.'
    ),
    'PSP': (
        'PSP: use PPSSPP or a RetroArch PPSSPP profile via the desktop companion. '
        'Not browser-playable.'
    ),
}

COMPANION_PREFERRED_BLOCKERS = frozenset({
    'NGC', 'WII', 'SEGA_DC', 'N3DS', 'PS2', 'PSVITA',
})


def companion_hint_for(key: str | None, cores: list[str] | None = None) -> str | None:
    if not key:
        return None
    if key in COMPANION_HINTS:
        return COMPANION_HINTS[key]
    if cores:
        return 'Use the desktop companion / RetroArch with: ' + ', '.join(cores)
    return None


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
    mode = play_mode_for_platform(key)
    if not key:
        return {
            'play_url': None,
            'can_play_in_browser': False,
            'emulator_cores': [],
            'play_mode': 'none',
        }
    if mode == 'catalog':
        return {
            'play_url': None,
            'can_play_in_browser': False,
            'emulator_cores': [],
            'library_platform': key,
            'play_mode': 'catalog',
            'play_blocker': 'catalog_only',
        }

    # Wave 19b — PC DOS: companion by default; browser only with flag + vendored WASM.
    if key == 'PCDOS':
        companion = mapped_core_ids(key)
        flag_on = pcdos_browser_enabled()
        wasm_ready = any(core_is_browser_playable(c) for c in companion)
        if not (flag_on and wasm_ready):
            blocker = 'pcdos_flag_off' if not flag_on else 'pcdos_wasm_missing'
            return {
                'play_url': None,
                'can_play_in_browser': False,
                'emulator_cores': [],
                'companion_cores': companion,
                'library_platform': key,
                'play_mode': 'companion',
                'play_blocker': blocker,
                'companion_hint': (
                    'PC DOS plays via desktop companion / RetroArch (dosbox_pure). '
                    'Browser play needs ENABLE_PCDOS_BROWSER=true and a vendored dosbox WASM core.'
                ),
            }

    if key not in WEBRETRO_PLATFORMS:
        companion = mapped_core_ids(key)
        blocker = (
            'companion_preferred'
            if key in COMPANION_PREFERRED_BLOCKERS
            else 'companion_or_catalog'
        )
        return {
            'play_url': None,
            'can_play_in_browser': False,
            'emulator_cores': [],
            'companion_cores': companion,
            'library_platform': key,
            'play_mode': mode,
            'play_blocker': blocker,
            'companion_hint': companion_hint_for(key, companion),
        }
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
        companion = mapped_core_ids(key)
        return {
            'play_url': None,
            'can_play_in_browser': False,
            'emulator_cores': [],
            'companion_cores': companion,
            'library_platform': key,
            'play_mode': mode if mode != 'browser' else 'companion',
            'play_blocker': 'no_browser_core',
            'companion_hint': companion_hint_for(key, companion),
        }

    core = cores[0]
    bios_hint = None
    try:
        from gametheca.utils.emulator_bios import BIOS_REQUIREMENTS, list_bios_files

        required = BIOS_REQUIREMENTS.get(core) or []
        if required:
            present = {row['name'].lower() for row in list_bios_files()}
            found = [name for name in required if name.lower() in present]
            if not found:
                bios_hint = {
                    'core': core,
                    'ready': False,
                    'missing': required,
                    'message': f'{core} needs BIOS under userdata/system (none found yet)',
                }
            else:
                bios_hint = {
                    'core': core,
                    'ready': True,
                    'present': found,
                    'message': None,
                }
    except Exception:
        bios_hint = None

    n64_note = None
    if key == 'N64':
        n64_note = 'N64 WebRetro cores can be flaky on some titles — try the other core in Emulator profiles if play fails.'

    platform_q = f'&platform={key}' if key else ''
    return {
        'play_url': (
            f'/static/vendor/webretro/webretro.html?guid={game.uuid}&core={core}{platform_q}'
        ),
        'can_play_in_browser': True,
        'emulator_cores': cores,
        'emulator_core': core,
        'library_platform': key,
        'webretro_installed_cores': sorted(get_effective_installed_cores()),
        'bios': bios_hint,
        'n64_note': n64_note,
        'play_mode': 'browser',
    }
