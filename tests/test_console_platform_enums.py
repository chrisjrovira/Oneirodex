"""LOCKED console leaf LibraryPlatform enums + play_mode honesty (no DB).

GM list: NEOGEO · PSP · SWITCH · ARCADE — see docs/strategy/console-gaming-libraries.md
"""

from types import SimpleNamespace

from gametheca.platform import (
    Emulator,
    LibraryPlatform,
    WEBRETRO_BROWSER_KEYS,
    mapped_core_ids,
    play_mode_for_platform,
    platform_emulator_mapping,
)
from gametheca.utils.functions import PLATFORM_IDS
from gametheca.utils.play_url import WEBRETRO_PLATFORMS, browse_play_fields


def test_locked_console_leaf_enums_exist():
    assert LibraryPlatform.NEOGEO.value == 'Neo Geo AES'
    assert LibraryPlatform.PSP.value == 'Sony PSP'
    assert LibraryPlatform.SWITCH.value == 'Nintendo Switch'
    assert LibraryPlatform.ARCADE.value == 'Arcade'
    # Cart AES distinct from CD; no NEOGEO_AES / MAME aliases
    assert LibraryPlatform.NEOGEO_CD.value == 'Neo Geo CD'
    assert not hasattr(LibraryPlatform, 'NEOGEO_AES')
    assert not hasattr(LibraryPlatform, 'MAME')


def test_neogeo_never_maps_to_neocd():
    mapped = platform_emulator_mapping[LibraryPlatform.NEOGEO]
    assert mapped == []
    assert Emulator.NEOCD not in mapped
    assert mapped_core_ids('NEOGEO') == []
    # CD keeps neocd; cart must not share that path
    assert Emulator.NEOCD in platform_emulator_mapping[LibraryPlatform.NEOGEO_CD]


def test_locked_four_have_no_webretro_browser_keys():
    for key in ('NEOGEO', 'PSP', 'SWITCH', 'ARCADE'):
        assert key not in WEBRETRO_BROWSER_KEYS
        assert key not in WEBRETRO_PLATFORMS
        assert platform_emulator_mapping[LibraryPlatform[key]] == []
        assert mapped_core_ids(key) == []


def test_locked_four_play_mode_honesty():
    assert play_mode_for_platform('NEOGEO') == 'catalog'
    assert play_mode_for_platform('SWITCH') == 'catalog'
    assert play_mode_for_platform('ARCADE') == 'catalog'
    assert play_mode_for_platform('PSP') == 'companion'
    assert play_mode_for_platform('NEOGEO_CD') == 'browser'
    assert play_mode_for_platform('NES') == 'browser'


def test_browse_play_fields_catalog_platforms_no_browser_cta():
    for name in ('NEOGEO', 'SWITCH', 'ARCADE'):
        game = SimpleNamespace(
            uuid='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            library=SimpleNamespace(platform=SimpleNamespace(name=name)),
        )
        fields = browse_play_fields(game)
        assert fields['can_play_in_browser'] is False
        assert fields['play_mode'] == 'catalog'
        assert fields['play_blocker'] == 'catalog_only'
        assert fields['play_url'] is None


def test_browse_play_fields_psp_companion_no_browser():
    game = SimpleNamespace(
        uuid='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        library=SimpleNamespace(platform=SimpleNamespace(name='PSP')),
    )
    fields = browse_play_fields(game)
    assert fields['can_play_in_browser'] is False
    assert fields['play_mode'] == 'companion'
    assert fields['play_url'] is None
    assert 'PPSSPP' in (fields.get('companion_hint') or '')


def test_platform_ids_wired_for_locked_enums():
    assert PLATFORM_IDS.get('NEOGEO') == 79
    assert PLATFORM_IDS.get('PSP') == 38
    assert PLATFORM_IDS.get('SWITCH') == 130
    assert PLATFORM_IDS.get('ARCADE') == 52
