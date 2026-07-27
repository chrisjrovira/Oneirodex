"""Unit tests for ROM language / patch filename heuristics."""

from gametheca.utils.rom_language import (
    classify_patch_file,
    parse_rom_language_tags,
    preferred_locale_matches,
)


def test_parse_japan_region_implies_ja():
    parsed = parse_rom_language_tags('Final Fantasy (Japan).sfc')
    assert parsed['rom_region'] == 'JPN'
    assert parsed['languages'] == ['ja']
    assert parsed['has_english'] is False


def test_parse_usa_implies_en():
    parsed = parse_rom_language_tags('Super Metroid (USA).sfc')
    assert parsed['rom_region'] == 'USA'
    assert 'en' in parsed['languages']
    assert parsed['has_english'] is True


def test_parse_explicit_lang_list():
    parsed = parse_rom_language_tags('Game (Europe) (En,Fr,De).nes')
    assert parsed['rom_region'] == 'EUR'
    assert parsed['languages'] == ['en', 'fr', 'de']
    assert parsed['has_english'] is True


def test_preferred_locale_mismatch_jpn_vs_en_us():
    assert preferred_locale_matches('en-US', ['ja'], region='JPN') is False
    assert preferred_locale_matches('ja-JP', ['ja'], region='JPN') is True
    assert preferred_locale_matches('en-US', ['en'], region='USA') is True


def test_classify_patch_file():
    meta = classify_patch_file('MyGame_English.bps')
    assert meta is not None
    assert meta['extra_kind'] == 'translation_patch'
    assert meta['patch_format'] == 'bps'
    assert meta['target_language'] == 'en'
    assert classify_patch_file('readme.txt') is None
