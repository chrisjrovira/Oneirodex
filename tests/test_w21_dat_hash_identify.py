"""W21-BE-DAT — unique DAT CRC/MD5/SHA1 short-circuit on console identify."""

from __future__ import annotations

from unittest.mock import patch
from uuid import uuid4

import pytest

from gametheca.models import Game, Library
from gametheca.platform import LibraryPlatform
from gametheca.utils.set_completion import (
    lookup_unique_dat_hash_hit,
    try_dat_hash_identify,
    upsert_reference_set,
)
from gametheca.utils.software_identify import CUSTOM_IGDB_BASE


def _dat_with_hashes(tag: str, *, shared_crc: str | None = None) -> bytes:
    crc_a = shared_crc or 'aabbcc01'
    crc_b = shared_crc or 'aabbcc02'
    return f"""<?xml version="1.0"?>
<datafile>
  <header>
    <name>Nintendo - Game Boy (USA) {tag}</name>
    <description>Test GB USA {tag}</description>
  </header>
  <game name="Tetris {tag} (USA)">
    <description>Tetris {tag} (USA)</description>
    <rom name="Tetris {tag} (USA).gb" size="32768" crc="{crc_a}"
         md5="11111111111111111111111111111111"
         sha1="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"/>
  </game>
  <game name="Mario {tag} (USA)">
    <description>Mario {tag} (USA)</description>
    <rom name="Mario {tag} (USA).gb" size="65536" crc="{crc_b}"
         md5="22222222222222222222222222222222"
         sha1="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"/>
  </game>
</datafile>
""".encode('utf-8')


@pytest.fixture
def gb_library(db_session):
    lib = Library(
        name=f'DAT_GB_{uuid4().hex[:8]}',
        platform=LibraryPlatform.GB,
    )
    db_session.add(lib)
    db_session.flush()
    return lib


@pytest.fixture
def pc_library(db_session):
    lib = Library(
        name=f'DAT_PC_{uuid4().hex[:8]}',
        platform=LibraryPlatform.PCWIN,
    )
    db_session.add(lib)
    db_session.flush()
    return lib


def test_lookup_unique_sha1_hit(db_session, gb_library):
    tag = uuid4().hex[:8]
    upsert_reference_set(
        library_platform='GB',
        region='USA',
        source='nointro',
        dat_bytes=_dat_with_hashes(tag),
    )
    hit = lookup_unique_dat_hash_hit(
        library_platform='GB',
        sha1='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    )
    assert hit is not None
    assert hit['match_method'] == 'sha1'
    assert hit['identify_path'] == 'dat_hash'
    assert hit['match_reason'] == 'dat_unique_sha1'
    assert f'Tetris {tag}' in hit['name']


def test_lookup_ambiguous_shared_crc_no_auto(db_session, gb_library):
    tag = uuid4().hex[:8]
    shared = 'deadbeef'
    upsert_reference_set(
        library_platform='GB',
        region='USA',
        source='nointro',
        dat_bytes=_dat_with_hashes(tag, shared_crc=shared),
    )
    hit = lookup_unique_dat_hash_hit(library_platform='GB', crc=shared)
    assert hit is None


def test_lookup_missing_dat_skip(db_session, gb_library):
    hit = lookup_unique_dat_hash_hit(
        library_platform='GB',
        crc='ffffffff',
    )
    assert hit is None


def test_lookup_pc_platform_skipped(db_session, pc_library):
    tag = uuid4().hex[:8]
    upsert_reference_set(
        library_platform='NES',
        region='USA',
        source='nointro',
        dat_bytes=_dat_with_hashes(tag),
    )
    hit = lookup_unique_dat_hash_hit(
        library_platform='PCWIN',
        sha1='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    )
    assert hit is None


def test_try_dat_hash_identify_creates_custom_game(db_session, gb_library, tmp_path):
    tag = uuid4().hex[:8]
    upsert_reference_set(
        library_platform='GB',
        region='USA',
        source='nointro',
        dat_bytes=_dat_with_hashes(tag),
    )
    rom = tmp_path / f'Tetris {tag} (USA).gb'
    rom.write_bytes(b'unique-rom-bytes-for-hash')

    hashes = {
        'crc': 'aabbcc01',
        'md5': '11111111111111111111111111111111',
        'sha1': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    }
    game = try_dat_hash_identify(
        full_disk_path=str(rom),
        library_uuid=gb_library.uuid,
        library_platform='GB',
        size=0,
        hashes=hashes,
    )
    assert game is not None
    assert game.igdb_id >= CUSTOM_IGDB_BASE
    assert f'Tetris {tag}' in game.name
    assert 'reference DAT' in (game.summary or '')
    assert game.file_crc == 'aabbcc01'
    assert game.file_sha1 == 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'


def test_try_dat_hash_identify_ambiguous_returns_none(db_session, gb_library):
    tag = uuid4().hex[:8]
    shared = 'cafebabe'
    upsert_reference_set(
        library_platform='GB',
        region='USA',
        source='nointro',
        dat_bytes=_dat_with_hashes(tag, shared_crc=shared),
    )
    game = try_dat_hash_identify(
        full_disk_path=f'/tmp/multicart-{tag}.gb',
        library_uuid=gb_library.uuid,
        library_platform='GB',
        hashes={'crc': shared, 'md5': 'x', 'sha1': 'y'},
    )
    assert game is None


def test_retrieve_unique_dat_auto_before_stage_e(app, db_session, gb_library, tmp_path):
    from gametheca.utils.game_core import retrieve_and_save_game

    tag = uuid4().hex[:8]
    upsert_reference_set(
        library_platform='GB',
        region='USA',
        source='nointro',
        dat_bytes=_dat_with_hashes(tag),
    )
    rom = tmp_path / f'Tetris {tag} (USA).gb'
    rom.write_bytes(b'rom-payload')

    with patch(
        'gametheca.utils.game_core.search_igdb_for_game',
        return_value=[],
    ), patch(
        'gametheca.utils.software_identify.try_stage_d_store_identify',
        return_value=None,
    ), patch(
        'gametheca.utils.rom_hash.hash_rom_file',
        return_value={
            'crc': 'aabbcc01',
            'md5': '11111111111111111111111111111111',
            'sha1': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        },
    ), patch(
        'gametheca.utils.game_core.notify_admins_new_game',
    ), patch(
        'gametheca.utils.software_identify.enrich_proposal_with_stage_e',
    ) as mock_stage_e:
        result = retrieve_and_save_game(
            f'Tetris {tag}',
            str(rom),
            library_uuid=gb_library.uuid,
            settings={
                'use_local_metadata': False,
                'write_local_metadata': False,
                'use_local_images': False,
                'local_metadata_filename': 'gametheca.json',
                'propose_only_scan': False,
                'scan_mode': 'files',
            },
        )

    assert result is not None
    assert result.igdb_id >= CUSTOM_IGDB_BASE
    assert f'Tetris {tag}' in result.name
    mock_stage_e.assert_not_called()


def test_retrieve_skips_dat_when_propose_only(app, db_session, gb_library, tmp_path):
    from gametheca.utils.game_core import retrieve_and_save_game

    rom = tmp_path / f'SkipPropose-{uuid4().hex[:4]}.gb'
    rom.write_bytes(b'x')

    with patch(
        'gametheca.utils.game_core.search_igdb_for_game',
        return_value=[],
    ), patch(
        'gametheca.utils.set_completion.try_dat_hash_identify',
    ) as mock_dat, patch(
        'gametheca.utils.software_identify.try_stage_d_store_identify',
    ) as mock_stage_d, patch(
        'gametheca.utils.software_identify.enrich_proposal_with_software',
        side_effect=lambda p, *_a, **_k: p,
    ), patch(
        'gametheca.utils.software_identify.enrich_proposal_with_stage_e',
        side_effect=lambda p, **_k: p,
    ), patch(
        'gametheca.utils.game_core.write_match_proposal',
        return_value=True,
    ):
        result = retrieve_and_save_game(
            'Some Title',
            str(rom),
            library_uuid=gb_library.uuid,
            settings={
                'use_local_metadata': False,
                'write_local_metadata': False,
                'use_local_images': False,
                'local_metadata_filename': 'gametheca.json',
                'propose_only_scan': True,
                'scan_mode': 'files',
            },
        )
    assert result is None
    mock_stage_d.assert_not_called()
    mock_dat.assert_not_called()
