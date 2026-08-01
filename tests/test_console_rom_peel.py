"""Console file-leaf ROM peel — B15–B20 + C12 (W20-7 GM fixtures)."""

from __future__ import annotations

import pytest

from gametheca.platform import LibraryPlatform
from gametheca.utils.gamenames import generate_goty_variants
from gametheca.utils.rom_language import parse_rom_language_tags
from gametheca.utils.rom_name_peel import (
    parse_console_rom_label,
    should_use_console_rom_peel,
)
from gametheca.utils.set_completion import normalize_set_title


class _Lib:
    def __init__(self, platform):
        self.platform = platform


# GM AC fixture table (16 rows)
GM_FIXTURES = [
    (
        'Pokemon - Red Version (USA, Europe) (SGB Enhanced) (Rev A) [!].gb',
        'Pokemon - Red Version',
    ),
    (
        'Legend of Zelda, The (USA) (Rev B) [!].gb',
        'Legend of Zelda, The',
    ),
    (
        'Tetris (World) (Rev 1) [!].gb',
        'Tetris',
    ),
    (
        'Super Mario Land (Japan) [S][!].gb',
        'Super Mario Land',
    ),
    (
        "Kirby's Dream Land (USA, Europe) (Rev A) (SGB Enhanced) [!].gb",
        "Kirby's Dream Land",
    ),
    (
        'Final Fantasy Legend, The (USA) (Rev 1) [!].gb',
        'Final Fantasy Legend, The',
    ),
    (
        'Metroid II - Return of Samus (USA, Europe) (Rev A) [!].gb',
        'Metroid II - Return of Samus',
    ),
    (
        'Donkey Kong (World) (Rev A) (SGB Enhanced) [!].gb',
        'Donkey Kong',
    ),
    (
        'Wario Land II (USA, Europe) (SGB Enhanced) [!].gbc',
        'Wario Land II',
    ),
    (
        "Harry Potter and the Sorcerer's Stone (USA).zip",
        "Harry Potter and the Sorcerer's Stone",
    ),
    (
        'Action Force (USA).zip',
        'Action Force',
    ),
    (
        'Game (Europe) (En,Fr,De).gb',
        'Game',
    ),
    (
        'All-Star Baseball 99 (U) [!].gb',
        'All-Star Baseball 99',
    ),
    (
        'Double Dragon (1995)(SNK)(Jp-US)[!].zip',
        'Double Dragon',
    ),
    (
        'Dr. Mario (Japan) (Rev A) [S][!].gb',
        'Dr. Mario',
    ),
    (
        'Asteroids (USA) [b1].gb',
        'Asteroids',
    ),
]

EXTRA_GB_GBC_FIXTURES = [
    ('Pokemon - Blue Version (USA) (Rev A) [!].gb', 'Pokemon - Blue Version'),
    ('Super Mario Land 2 - 6 Golden Coins (USA) (Rev A) [!].gb', 'Super Mario Land 2 - 6 Golden Coins'),
    ('Mega Man V (USA) [!].gb', 'Mega Man V'),
    ('FIFA 98 - Road to World Cup (Europe) (SGB Enhanced) [!].gb', 'FIFA 98 - Road to World Cup'),
    ('4-in-1 Fun Pak (USA) [!].gb', '4-in-1 Fun Pak'),
    ('Some Hack (USA) [h].gb', 'Some Hack'),
]

CROSS_PLATFORM_FIXTURES = [
    ('Super Mario 64 (USA) [!].z64', 'Super Mario 64'),
    ('Chrono Trigger (USA) [!].sfc', 'Chrono Trigger'),
    ('Sonic the Hedgehog (USA) (Rev A) [!].md', 'Sonic the Hedgehog'),
    ('Castlevania - Symphony of the Night (USA) [!].bin', 'Castlevania - Symphony of the Night'),
    ('Metroid Fusion (USA) [!].gba', 'Metroid Fusion'),
]


@pytest.mark.parametrize('raw,expected', GM_FIXTURES)
def test_gm_fixture_cleaned_name(raw, expected):
    result = parse_console_rom_label(raw)
    assert result['cleaned_name'] == expected


@pytest.mark.parametrize('raw,expected', EXTRA_GB_GBC_FIXTURES + CROSS_PLATFORM_FIXTURES)
def test_extra_console_fixtures(raw, expected):
    result = parse_console_rom_label(raw)
    assert result['cleaned_name'] == expected


def test_transform_trail_stages():
    raw = 'Super Mario Land (Japan) [S][!].gb'
    result = parse_console_rom_label(raw)
    stages = [t['stage'] for t in result['transforms']]
    assert 'B15' in stages
    assert 'B16' in stages
    assert stages.index('B15') < stages.index('B16')
    for i in range(1, len(result['transforms'])):
        assert result['transforms'][i]['before'] == result['transforms'][i - 1]['after']


def test_c12_article_reorder_variants():
    cleaned = parse_console_rom_label('Legend of Zelda, The (USA) [!].gb')['cleaned_name']
    variants = generate_goty_variants(cleaned)
    assert 'The Legend of Zelda' in variants

    ff = parse_console_rom_label('Final Fantasy Legend, The (USA) [!].gb')['cleaned_name']
    assert 'The Final Fantasy Legend' in generate_goty_variants(ff)


def test_rom_language_tags_on_raw_basename():
    raw = 'Game (Europe) (En,Fr,De).gb'
    parsed = parse_rom_language_tags(raw)
    assert parsed['rom_region'] == 'EUR'
    assert 'de' in parsed['languages']


def test_normalize_set_title_uses_shared_peel():
    assert normalize_set_title('Balloon Fight (USA) [!].nes') == 'balloon fight'
    assert normalize_set_title('Castlevania (USA) (Rev A)') == 'castlevania'


def test_multicart_propose_only():
    result = parse_console_rom_label('4-in-1 Fun Pak (USA) [!].gb')
    assert result['is_multicart'] is True
    assert result['propose_only'] is True


def test_hack_propose_only():
    result = parse_console_rom_label('Some Hack (USA) [h].gb')
    assert result['propose_only'] is True


def test_proto_propose_only():
    result = parse_console_rom_label('Early Game (Proto) (USA) [!].gb')
    assert result['propose_only'] is True


def test_should_use_console_rom_peel_pilot():
    gb_lib = _Lib(LibraryPlatform.GB)
    pc_lib = _Lib(LibraryPlatform.PCWIN)
    assert should_use_console_rom_peel(gb_lib, '/roms/tetris.gb', {'scan_mode': 'files'})
    assert not should_use_console_rom_peel(pc_lib, '/roms/tetris.gb', {'scan_mode': 'files'})
    assert not should_use_console_rom_peel(gb_lib, '/roms/tetris.gb', {'scan_mode': 'folders'})


def test_sequel_numeral_not_peeled():
    result = parse_console_rom_label('Super Mario Land 2 (USA) [!].gb')
    assert '2' in result['cleaned_name']
