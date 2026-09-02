"""The platform recency table must stay complete and stay ordered.

`LibraryPlatform` is an arbitrary declaration order — `SWITCH` and `ARCADE` sit
after `O2EM` — so collapsing a title's copies to "the latest system it was
released on" needs a table that says which system that is. A table like that
rots in one specific way: a platform gets added to the enum, nobody adds it
here, and `platform_rank` quietly returns the unknown rank — so the new system
is treated as the *oldest* thing in the library and never wins the tile. These
tests make that failure loud.
"""

from __future__ import annotations

from oneirodex.platform import LibraryPlatform
from oneirodex.platform_recency import (
    PLATFORM_LAUNCH_YEAR,
    missing_platforms,
    newest_platform,
    platform_rank,
)


def test_every_platform_is_ranked():
    missing = missing_platforms()
    assert not missing, (
        'These LibraryPlatform members have no entry in PLATFORM_LAUNCH_YEAR, '
        'so they rank as the oldest thing in the library and can never '
        f'represent a title: {", ".join(missing)}'
    )


def test_no_rank_for_a_platform_that_no_longer_exists():
    """A renamed enum member would otherwise leave a dead row ranking nothing."""
    known = {member.name for member in LibraryPlatform}
    stale = sorted(set(PLATFORM_LAUNCH_YEAR) - known)
    assert not stale, f'ranked platforms that are not in the enum: {stale}'


def test_newer_hardware_outranks_older_within_a_family():
    assert platform_rank('SNES') > platform_rank('NES')
    assert platform_rank('GBA') > platform_rank('SNES')
    assert platform_rank('SWITCH') > platform_rank('WII_U') > platform_rank('WII')
    assert platform_rank('PS5') > platform_rank('PS4') > platform_rank('PSX')
    assert platform_rank('XSX') > platform_rank('X360') > platform_rank('XBOX')
    assert platform_rank('APPLE_II') < platform_rank('ZX_SPECTRUM')
    assert platform_rank('ZX_SPECTRUM') < platform_rank('MSX') < platform_rank('CPC')
    assert platform_rank('GX4000') > platform_rank('CPC')
    assert platform_rank('ATARI_ST') < platform_rank('JAGUAR')
    assert platform_rank('ATARI_2600') < platform_rank('ATARI_8BIT') < platform_rank('ATARI_ST')
    assert platform_rank('PC_98') < platform_rank('X68000')
    assert platform_rank('GAME_WATCH') < platform_rank('GB')
    assert platform_rank('BBC_MICRO') < platform_rank('PC_98')


def test_the_example_that_was_asked_for():
    """A title on NES, GBA and SNES is represented by its GBA copy."""
    assert newest_platform(['NES', 'GBA', 'SNES']) == 'GBA'


def test_pc_outranks_every_console():
    """A PC release is the copy that is still current — see the module docstring."""
    for member in LibraryPlatform:
        if member.name in {'PCWIN', 'MAC'}:
            continue
        assert platform_rank('PCWIN') > platform_rank(member.name), member.name


def test_arcade_is_the_original_not_the_newest():
    """An arcade board is what a console version was ported *from*."""
    assert platform_rank('ARCADE') < platform_rank('NES')
    assert newest_platform(['ARCADE', 'SNES']) == 'SNES'


def test_unknown_platforms_lose_rather_than_break():
    assert platform_rank(None) == 0
    assert platform_rank('NOT_A_PLATFORM') == 0
    # An identified system still wins over one this table has not caught up with.
    assert newest_platform(['NOT_A_PLATFORM', 'NES']) == 'NES'


def test_unclassified_libraries_never_represent_a_title():
    assert newest_platform(['OTHER', 'ATARI_2600']) == 'ATARI_2600'


def test_ties_break_stably_so_tiles_do_not_swap_between_page_loads():
    # Saturn and Jaguar are both ranked 1994 and 1993; use two genuine ties.
    assert platform_rank('SEGA_SATURN') == platform_rank('PCFX')
    first = newest_platform(['SEGA_SATURN', 'PCFX'])
    assert first == newest_platform(['PCFX', 'SEGA_SATURN'])
    assert first == 'PCFX'  # alphabetical, deterministic


def test_no_platforms_without_a_source_of_truth():
    """Years are real years, so the ordering can be checked against the world."""
    for name, year in PLATFORM_LAUNCH_YEAR.items():
        if name in {'PCWIN', 'MAC', 'OTHER'}:
            continue  # deliberately not years — see the module docstring
        assert 1940 < year < 2100, f'{name} has an implausible rank: {year}'
