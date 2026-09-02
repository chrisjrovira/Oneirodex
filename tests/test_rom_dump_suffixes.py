"""Dump suffixes on LibraryPlatform leaves must scan, peel, hash, and propose."""

from oneirodex.init_data import seeded_allowed_file_types
from oneirodex.utils.propose_leaf_libraries import _ROM_FILE_EXTS
from oneirodex.utils.rom_archive import (
    ARCHIVE_EXTENSIONS,
    PLATFORM_DUMP_SUFFIXES,
    ROM_EXTENSIONS,
)
from oneirodex.utils.rom_hash import _ROM_SUFFIXES
from oneirodex.utils.rom_name_peel import ROM_EXT_RE, parse_console_rom_label


def test_bbc_and_game_watch_suffixes_are_first_class():
    for suffix in ('.ssd', '.dsd', '.uef', '.bbc', '.mgw'):
        assert suffix in PLATFORM_DUMP_SUFFIXES, suffix
        assert suffix in ROM_EXTENSIONS, suffix
        assert suffix in _ROM_SUFFIXES, suffix
        assert suffix.lstrip('.') in _ROM_FILE_EXTS, suffix
        assert ROM_EXT_RE.search(f'Elite (USA){suffix}')


def test_seeded_allowed_file_types_cover_platform_dumps():
    allowed = {f'.{token}' if not token.startswith('.') else token for token in seeded_allowed_file_types()}
    missing = sorted(PLATFORM_DUMP_SUFFIXES - allowed - ARCHIVE_EXTENSIONS)
    assert missing == [], missing


def test_rom_extensions_cover_platform_dumps():
    missing = sorted(PLATFORM_DUMP_SUFFIXES - ROM_EXTENSIONS - ARCHIVE_EXTENSIONS)
    assert missing == [], missing


def test_hash_suffixes_cover_platform_dumps():
    missing = sorted(PLATFORM_DUMP_SUFFIXES - _ROM_SUFFIXES - ARCHIVE_EXTENSIONS)
    assert missing == [], missing


def test_propose_files_mode_covers_platform_dumps():
    missing = sorted(
        {suffix.lstrip('.') for suffix in PLATFORM_DUMP_SUFFIXES - ARCHIVE_EXTENSIONS} - _ROM_FILE_EXTS
    )
    assert missing == [], missing


def test_peel_strips_bbc_and_game_watch_leaves():
    assert parse_console_rom_label('Elite (USA).ssd')['cleaned_name'] == 'Elite'
    assert parse_console_rom_label('Octopus (World).mgw')['cleaned_name'] == 'Octopus'
    assert parse_console_rom_label('Castle of Dragon (USA).vb')['cleaned_name'] == 'Castle of Dragon'
