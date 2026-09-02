"""TGDB Stage E platform corroboration — short siblings must not steal long hits."""

from oneirodex.utils.rom_archive import PLATFORM_ROM_EXTENSIONS, choose_rom_member
from oneirodex.utils.software_identify import (
    filter_tgdb_hits_for_platform,
    tgdb_platform_matches,
)


def test_game_boy_does_not_match_color_or_advance():
    assert tgdb_platform_matches(['Nintendo Game Boy'], 'GB')
    assert not tgdb_platform_matches(['Nintendo Game Boy Color'], 'GB')
    assert not tgdb_platform_matches(['Nintendo Game Boy Advance'], 'GB')
    assert tgdb_platform_matches(['Nintendo Game Boy Color'], 'GBC')
    assert not tgdb_platform_matches(['Nintendo Game Boy'], 'GBC')
    assert tgdb_platform_matches(['Nintendo Game Boy Advance'], 'GBA')
    assert not tgdb_platform_matches(['Nintendo Game Boy Color'], 'GBA')


def test_wii_does_not_match_wii_u():
    assert tgdb_platform_matches(['Nintendo Wii'], 'WII')
    assert not tgdb_platform_matches(['Nintendo Wii U'], 'WII')
    assert tgdb_platform_matches(['Nintendo Wii U'], 'WII_U')
    assert not tgdb_platform_matches(['Nintendo Wii'], 'WII_U')


def test_jaguar_amiga_pce_pocket_stay_distinct():
    assert tgdb_platform_matches(['Atari Jaguar'], 'JAGUAR')
    assert not tgdb_platform_matches(['Atari Jaguar CD'], 'JAGUAR')
    assert tgdb_platform_matches(['Atari Jaguar CD'], 'JAGUAR_CD')
    assert tgdb_platform_matches(['Commodore Amiga'], 'AMIGA')
    assert not tgdb_platform_matches(['Commodore Amiga CD32'], 'AMIGA')
    assert tgdb_platform_matches(['Commodore Amiga CD32'], 'AMIGA_CD32')
    assert tgdb_platform_matches(['PC Engine'], 'PCE')
    assert not tgdb_platform_matches(['TurboGrafx-16/PC Engine CD'], 'PCE')
    assert not tgdb_platform_matches(['PC Engine SuperGrafx'], 'PCE')
    assert tgdb_platform_matches(['PC Engine SuperGrafx'], 'SUPERGRAFX')
    assert tgdb_platform_matches(['Neo Geo Pocket'], 'NGP')
    assert not tgdb_platform_matches(['Neo Geo Pocket Color'], 'NGP')
    assert tgdb_platform_matches(['Neo Geo Pocket Color'], 'NGPC')
    assert not tgdb_platform_matches(['NGPC'], 'NGP')


def test_psx_xbox_do_not_match_later_siblings():
    assert tgdb_platform_matches(['Sony Playstation'], 'PSX')
    assert not tgdb_platform_matches(['Sony Playstation 2'], 'PSX')
    assert not tgdb_platform_matches(['Sony PSP'], 'PSX')
    assert tgdb_platform_matches(['Sony Playstation 2'], 'PS2')
    assert not tgdb_platform_matches(['Sony Playstation'], 'PS2')
    assert tgdb_platform_matches(['Microsoft Xbox'], 'XBOX')
    assert not tgdb_platform_matches(['Microsoft Xbox 360'], 'XBOX')
    assert not tgdb_platform_matches(['Microsoft Xbox One'], 'XBOX')
    assert tgdb_platform_matches(['Microsoft Xbox 360'], 'X360')


def test_neogeo_aes_does_not_match_pocket():
    assert tgdb_platform_matches(['Neo Geo AES'], 'NEOGEO')
    assert not tgdb_platform_matches(['Neo Geo Pocket'], 'NEOGEO')
    assert not tgdb_platform_matches(['Neo Geo Pocket Color'], 'NEOGEO')
    assert not tgdb_platform_matches(['Neo Geo CD'], 'NEOGEO')


def test_filter_drops_sibling_hits():
    hits = [
        {'name': 'Zelda', 'platforms': ['Nintendo Wii']},
        {'name': 'Zelda', 'platforms': ['Nintendo Wii U']},
    ]
    wii = filter_tgdb_hits_for_platform(hits, 'WII')
    assert len(wii) == 1
    assert wii[0]['platforms'] == ['Nintendo Wii']
    wii_u = filter_tgdb_hits_for_platform(hits, 'WII_U')
    assert len(wii_u) == 1
    assert wii_u[0]['platforms'] == ['Nintendo Wii U']


def test_leftover_rom_extension_prefers_dump_suffix():
    members = [
        ('readme.bin', 80_000),
        ('Title.sg', 40_000),
        ('Title.sgx', 90_000),
        ('Title.min', 20_000),
        ('Title.cpr', 30_000),
    ]
    assert choose_rom_member(members, platform='SEGA_SG1000') == 'Title.sg'
    assert choose_rom_member(members, platform='SUPERGRAFX') == 'Title.sgx'
    assert choose_rom_member(members, platform='POKE_MINI') == 'Title.min'
    assert choose_rom_member(members, platform='GX4000') == 'Title.cpr'
    assert '.sg' in PLATFORM_ROM_EXTENSIONS['SEGA_SG1000']
    assert '.min' in PLATFORM_ROM_EXTENSIONS['POKE_MINI']
    assert '.adf' in PLATFORM_ROM_EXTENSIONS['AMIGA']
