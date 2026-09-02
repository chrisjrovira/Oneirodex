"""LOCKED console leaf LibraryPlatform enums + play_mode honesty (no DB).

GM list: NEOGEO · PSP · SWITCH · ARCADE, plus the 2026-08-29 console wave
(WII_U · POKE_MINI · CD_I · SEGA_PICO · JAGUAR_CD · AMIGA_CD32).
See docs/strategy/console-gaming-libraries.md
"""

from types import SimpleNamespace

from oneirodex.platform import (
    Emulator,
    LibraryPlatform,
    WEBRETRO_BROWSER_KEYS,
    WEBRETR_INSTALLED_CORES,
    mapped_core_ids,
    play_mode_for_platform,
    platform_emulator_mapping,
)
from oneirodex.utils.functions import (
    PLATFORM_IDS,
    PLATFORM_IDS_UNMAPPED,
    igdb_platform_id_for,
)
from oneirodex.utils.play_url import WEBRETRO_PLATFORMS, browse_play_fields


LOCKED_NO_WASM = (
    'NEOGEO', 'PSP', 'SWITCH', 'ARCADE',
    'WII_U', 'POKE_MINI', 'CD_I', 'SEGA_PICO', 'JAGUAR_CD',
)


def test_locked_console_leaf_enums_exist():
    assert LibraryPlatform.NEOGEO.value == 'Neo Geo AES'
    assert LibraryPlatform.PSP.value == 'Sony PSP'
    assert LibraryPlatform.SWITCH.value == 'Nintendo Switch'
    assert LibraryPlatform.ARCADE.value == 'Arcade'
    # Cart AES distinct from CD; no NEOGEO_AES / MAME aliases
    assert LibraryPlatform.NEOGEO_CD.value == 'Neo Geo CD'
    assert not hasattr(LibraryPlatform, 'NEOGEO_AES')
    assert not hasattr(LibraryPlatform, 'MAME')
    assert LibraryPlatform.WII_U.value == 'Nintendo Wii U'
    assert LibraryPlatform.POKE_MINI.value == 'Pokémon Mini'
    assert LibraryPlatform.GAME_WATCH.value == 'Nintendo Game & Watch'
    assert LibraryPlatform.CD_I.value == 'Philips CD-i'
    assert LibraryPlatform.SEGA_PICO.value == 'Sega Pico'
    assert LibraryPlatform.JAGUAR_CD.value == 'Atari Jaguar CD'
    assert LibraryPlatform.AMIGA_CD32.value == 'Commodore Amiga CD32'


def test_neogeo_never_maps_to_neocd():
    mapped = platform_emulator_mapping[LibraryPlatform.NEOGEO]
    assert mapped == []
    assert Emulator.NEOCD not in mapped
    assert mapped_core_ids('NEOGEO') == []
    # CD keeps neocd; cart must not share that path
    assert Emulator.NEOCD in platform_emulator_mapping[LibraryPlatform.NEOGEO_CD]


def test_jaguar_cd_never_maps_to_cart_virtualjaguar():
    assert platform_emulator_mapping[LibraryPlatform.JAGUAR_CD] == []
    assert Emulator.VIRTUALJAGUAR not in platform_emulator_mapping[LibraryPlatform.JAGUAR_CD]
    assert Emulator.VIRTUALJAGUAR in platform_emulator_mapping[LibraryPlatform.JAGUAR]


def test_wii_u_never_maps_to_dolphin():
    assert platform_emulator_mapping[LibraryPlatform.WII_U] == []
    assert Emulator.DOLPHIN not in platform_emulator_mapping[LibraryPlatform.WII_U]
    assert Emulator.DOLPHIN in platform_emulator_mapping[LibraryPlatform.WII]


def test_locked_wave_have_no_webretro_browser_keys():
    for key in LOCKED_NO_WASM:
        assert key not in WEBRETRO_BROWSER_KEYS
        assert key not in WEBRETRO_PLATFORMS
        assert mapped_core_ids(key) == []
    assert 'AMIGA_CD32' not in WEBRETRO_BROWSER_KEYS
    assert 'AMIGA_CD32' not in WEBRETRO_PLATFORMS


def test_game_watch_maps_gw_companion_not_browser():
    assert mapped_core_ids('GAME_WATCH') == ['gw']
    assert Emulator.GW.value == 'gw'
    assert 'GAME_WATCH' not in WEBRETRO_BROWSER_KEYS
    assert 'GAME_WATCH' not in WEBRETRO_PLATFORMS
    assert 'gw' not in WEBRETR_INSTALLED_CORES


def test_locked_play_mode_honesty():
    assert play_mode_for_platform('NEOGEO') == 'catalog'
    assert play_mode_for_platform('SWITCH') == 'catalog'
    assert play_mode_for_platform('ARCADE') == 'catalog'
    assert play_mode_for_platform('WII_U') == 'catalog'
    assert play_mode_for_platform('PSP') == 'companion'
    assert play_mode_for_platform('POKE_MINI') == 'companion'
    assert play_mode_for_platform('GAME_WATCH') == 'companion'
    assert play_mode_for_platform('CD_I') == 'companion'
    assert play_mode_for_platform('SEGA_PICO') == 'companion'
    assert play_mode_for_platform('JAGUAR_CD') == 'companion'
    assert play_mode_for_platform('AMIGA_CD32') == 'companion'
    assert play_mode_for_platform('NEOGEO_CD') == 'browser'
    assert play_mode_for_platform('NES') == 'browser'


def test_browse_play_fields_catalog_platforms_no_browser_cta():
    for name in ('NEOGEO', 'SWITCH', 'ARCADE', 'WII_U'):
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


def test_browse_play_fields_new_companion_wave_no_browser():
    for name in ('POKE_MINI', 'GAME_WATCH', 'CD_I', 'SEGA_PICO', 'JAGUAR_CD', 'AMIGA_CD32'):
        game = SimpleNamespace(
            uuid='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            library=SimpleNamespace(platform=SimpleNamespace(name=name)),
        )
        fields = browse_play_fields(game)
        assert fields['can_play_in_browser'] is False, name
        assert fields['play_mode'] == 'companion', name
        assert fields['play_url'] is None, name


def test_platform_ids_wired_for_locked_enums():
    assert PLATFORM_IDS.get('NEOGEO') == 79
    assert PLATFORM_IDS.get('PSP') == 38
    assert PLATFORM_IDS.get('SWITCH') == 130
    assert PLATFORM_IDS.get('ARCADE') == 52
    assert PLATFORM_IDS.get('WII_U') == 41
    assert PLATFORM_IDS.get('POKE_MINI') == 166
    assert PLATFORM_IDS.get('GAME_WATCH') == 307
    assert PLATFORM_IDS.get('CD_I') == 117
    assert PLATFORM_IDS.get('SEGA_PICO') == 339
    assert PLATFORM_IDS.get('JAGUAR_CD') == 410
    assert PLATFORM_IDS.get('AMIGA_CD32') == 114


def test_platform_ids_leftover_consoles_and_gbc():
    assert PLATFORM_IDS.get('GBC') == 22
    assert PLATFORM_IDS.get('MAC') == 14
    assert PLATFORM_IDS.get('ATARI_5200') == 66
    assert PLATFORM_IDS.get('THREEDO') == 50
    assert PLATFORM_IDS.get('VECTREX') == 70
    assert PLATFORM_IDS.get('INTV') == 67
    assert PLATFORM_IDS.get('CHAF') == 127
    assert PLATFORM_IDS.get('O2EM') == 133
    assert PLATFORM_IDS.get('SEGA_SG1000') == 84
    assert PLATFORM_IDS.get('NGPC') == 120
    assert PLATFORM_IDS.get('PCE_CD') == 150
    assert PLATFORM_IDS.get('SUPERGRAFX') == 128
    assert PLATFORM_IDS.get('ASTROCADE') == 91
    assert PLATFORM_IDS.get('SUPERVISION') == 415
    assert PLATFORM_IDS.get('GX4000') == 506
    assert PLATFORM_IDS.get('ARCADIA') == 473
    assert PLATFORM_IDS.get('GX4000') != PLATFORM_IDS.get('CPC')


def test_every_library_platform_has_igdb_or_is_unmapped():
    for member in LibraryPlatform:
        igdb = PLATFORM_IDS.get(member.name)
        if member.name in PLATFORM_IDS_UNMAPPED:
            assert igdb is None, member.name
        else:
            assert isinstance(igdb, int) and igdb > 0, member.name


def test_igdb_platform_id_for_uses_enum_name_not_value():
    assert PLATFORM_IDS.get(LibraryPlatform.GBC.value.upper()) is None
    assert igdb_platform_id_for(LibraryPlatform.GBC) == 22
    assert igdb_platform_id_for('GBC') == 22
    assert igdb_platform_id_for(LibraryPlatform.SEGA_PICO) == 339
    assert igdb_platform_id_for(LibraryPlatform.CREATIVISION) is None
    assert igdb_platform_id_for(None) is None
