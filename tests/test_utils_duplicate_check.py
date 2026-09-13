"""Tests for true-duplicate vs IGDB-collision classification."""

from types import SimpleNamespace

from oneirodex.platform import LibraryPlatform
from oneirodex.utils.duplicate_check import (
    explain_duplicate_match,
    normalize_disk_path,
    same_duplicate_scope,
    should_mark_as_duplicate,
)


def test_normalize_disk_path_slashes():
    a = normalize_disk_path(r'/storage/_a/Alan Wake')
    b = normalize_disk_path(r'/storage/_a/Alan Wake/')
    assert a == b


def test_true_duplicate_same_title():
    existing = SimpleNamespace(
        name='Arizona Sunshine VR',
        full_disk_path='/storage/_a/Arizona Sunshine VR [FitGirl Repack]',
        library_uuid='lib-pc',
        rom_region=None,
        library=SimpleNamespace(platform=LibraryPlatform.PCWIN),
    )
    assert should_mark_as_duplicate(
        existing,
        '/storage/_b/Arizona Sunshine VR',
        'Arizona Sunshine VR',
        new_platform=LibraryPlatform.PCWIN,
        new_library_uuid='lib-pc',
    )


def test_false_duplicate_complete_collection():
    existing = SimpleNamespace(
        name='Alan Wake',
        full_disk_path='/storage/_a/Alan Wake',
        library_uuid='lib-pc',
        rom_region=None,
        library=SimpleNamespace(platform=LibraryPlatform.PCWIN),
    )
    assert not should_mark_as_duplicate(
        existing,
        '/storage/_a/Alan Wake Complete Collection',
        'Alan Wake Complete Collection',
        new_platform=LibraryPlatform.PCWIN,
        new_library_uuid='lib-pc',
    )


def test_false_duplicate_unrelated_vr_bundle():
    existing = SimpleNamespace(
        name='Some Other Game',
        full_disk_path='/storage/_z/Some Other Game',
        library_uuid='lib-pc',
        rom_region=None,
        library=SimpleNamespace(platform=LibraryPlatform.PCWIN),
    )
    assert not should_mark_as_duplicate(
        existing,
        '/storage/_a/ALL IN ONE ADVENTURE VR',
        'ALL IN ONE ADVENTURE VR',
        new_platform=LibraryPlatform.PCWIN,
        new_library_uuid='lib-pc',
    )


def test_cross_system_same_title_is_not_duplicate():
    existing = SimpleNamespace(
        name='Celeste',
        full_disk_path='/nes/Celeste',
        library_uuid='lib-nes',
        rom_region='USA',
        library=SimpleNamespace(platform=LibraryPlatform.NES),
    )
    assert not same_duplicate_scope(
        existing,
        new_platform=LibraryPlatform.SNES,
        new_library_uuid='lib-snes',
        new_rom_region='USA',
    )
    expl = explain_duplicate_match(
        existing,
        '/snes/Celeste',
        'Celeste',
        new_platform=LibraryPlatform.SNES,
        new_library_uuid='lib-snes',
        new_rom_region='USA',
    )
    assert expl['is_duplicate'] is False
    assert expl['match_reason'] == 'cross_system'


def test_same_system_different_region_is_not_duplicate():
    existing = SimpleNamespace(
        name='Super Mario Bros.',
        full_disk_path='/nes/Super Mario Bros. (USA)',
        library_uuid='lib-nes',
        rom_region='USA',
        library=SimpleNamespace(platform=LibraryPlatform.NES),
    )
    assert not same_duplicate_scope(
        existing,
        new_platform=LibraryPlatform.NES,
        new_library_uuid='lib-nes-2',
        new_rom_region='JPN',
    )
    expl = explain_duplicate_match(
        existing,
        '/nes/Super Mario Bros. (J)',
        'Super Mario Bros. (J)',
        new_platform=LibraryPlatform.NES,
        new_rom_region='JPN',
    )
    assert expl['is_duplicate'] is False
    assert expl['match_reason'] == 'region_mismatch'


def test_same_system_same_region_still_duplicates():
    existing = SimpleNamespace(
        name='Celeste',
        full_disk_path='/switch/Celeste (USA)',
        library_uuid='lib-sw',
        rom_region='USA',
        library=SimpleNamespace(platform=LibraryPlatform.SWITCH),
    )
    assert should_mark_as_duplicate(
        existing,
        '/switch/Celeste',
        'Celeste',
        new_platform=LibraryPlatform.SWITCH,
        new_library_uuid='lib-sw',
        new_rom_region='USA',
    )
