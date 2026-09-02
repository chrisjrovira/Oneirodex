"""BE-DET-6 — DAT unique-hash optional inner archive (zip) digests."""

from __future__ import annotations

import zipfile
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

import pytest

from oneirodex.models import Library
from oneirodex.platform import LibraryPlatform
from oneirodex.utils.rom_hash import (
    hash_archive_inner_primary_dumps,
    hash_fileobj,
    hash_rom_file,
)
from oneirodex.utils.set_completion import (
    try_dat_hash_identify,
    upsert_reference_set,
)
from oneirodex.utils.software_identify import CUSTOM_IGDB_BASE


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


def _digest_of_bytes(payload: bytes) -> dict[str, str]:
    import io

    return hash_fileobj(io.BytesIO(payload))


def _write_zip(path: Path, members: dict[str, bytes]) -> Path:
    with zipfile.ZipFile(path, 'w', compression=zipfile.ZIP_STORED) as zf:
        for name, data in members.items():
            zf.writestr(name, data)
    return path


@pytest.fixture
def gb_library(db_session):
    lib = Library(
        name=f'DAT_INNER_GB_{uuid4().hex[:8]}',
        platform=LibraryPlatform.GB,
    )
    db_session.add(lib)
    db_session.flush()
    return lib


def test_outer_miss_unique_inner_hit(db_session, gb_library, tmp_path):
    tag = uuid4().hex[:8]
    rom_bytes = b'unique-inner-rom-payload-' + tag.encode()
    inner = _digest_of_bytes(rom_bytes)
    dat = f"""<?xml version="1.0"?>
<datafile>
  <header>
    <name>Nintendo - Game Boy (USA) {tag}</name>
    <description>Test GB USA {tag}</description>
  </header>
  <game name="Tetris {tag} (USA)">
    <description>Tetris {tag} (USA)</description>
    <rom name="Tetris {tag} (USA).gb" size="{len(rom_bytes)}" crc="{inner['crc']}"
         md5="{inner['md5']}" sha1="{inner['sha1']}"/>
  </game>
</datafile>
""".encode('utf-8')
    upsert_reference_set(
        library_platform='GB',
        region='USA',
        source='nointro',
        dat_bytes=dat,
    )

    archive = _write_zip(
        tmp_path / f'Tetris {tag} (USA).zip',
        {f'Tetris {tag} (USA).gb': rom_bytes},
    )
    outer = hash_rom_file(archive)
    assert outer is not None
    assert outer['sha1'] != inner['sha1']

    game = try_dat_hash_identify(
        full_disk_path=str(archive),
        library_uuid=gb_library.uuid,
        library_platform='GB',
        size=archive.stat().st_size,
    )
    assert game is not None
    assert game.igdb_id >= CUSTOM_IGDB_BASE
    assert f'Tetris {tag}' in game.name
    assert 'inner archive dump' in (game.summary or '')
    assert game.file_sha1 == inner['sha1']
    assert game.file_crc == inner['crc']


def test_outer_miss_ambiguous_inner_no_match(db_session, gb_library, tmp_path):
    tag = uuid4().hex[:8]
    rom_a = b'rom-a-' + tag.encode() + b'-aaaaaaaa'
    rom_b = b'rom-b-' + tag.encode() + b'-bbbbbbbb'
    dig_a = _digest_of_bytes(rom_a)
    dig_b = _digest_of_bytes(rom_b)
    dat = f"""<?xml version="1.0"?>
<datafile>
  <header>
    <name>Nintendo - Game Boy (USA) {tag}</name>
    <description>Test GB USA {tag}</description>
  </header>
  <game name="Tetris {tag} (USA)">
    <description>Tetris {tag} (USA)</description>
    <rom name="Tetris {tag} (USA).gb" size="{len(rom_a)}" crc="{dig_a['crc']}"
         md5="{dig_a['md5']}" sha1="{dig_a['sha1']}"/>
  </game>
  <game name="Mario {tag} (USA)">
    <description>Mario {tag} (USA)</description>
    <rom name="Mario {tag} (USA).gb" size="{len(rom_b)}" crc="{dig_b['crc']}"
         md5="{dig_b['md5']}" sha1="{dig_b['sha1']}"/>
  </game>
</datafile>
""".encode('utf-8')
    upsert_reference_set(
        library_platform='GB',
        region='USA',
        source='nointro',
        dat_bytes=dat,
    )

    archive = _write_zip(
        tmp_path / f'Multicart {tag}.zip',
        {
            f'Tetris {tag} (USA).gb': rom_a,
            f'Mario {tag} (USA).gb': rom_b,
        },
    )
    game = try_dat_hash_identify(
        full_disk_path=str(archive),
        library_uuid=gb_library.uuid,
        library_platform='GB',
        size=archive.stat().st_size,
    )
    assert game is None


def test_non_archive_unchanged_outer_path(db_session, gb_library, tmp_path):
    tag = uuid4().hex[:8]
    upsert_reference_set(
        library_platform='GB',
        region='USA',
        source='nointro',
        dat_bytes=_dat_with_hashes(tag),
    )
    rom = tmp_path / f'Tetris {tag} (USA).gb'
    rom.write_bytes(b'loose-rom-bytes')

    with patch(
        'oneirodex.utils.rom_hash.hash_archive_inner_primary_dumps',
    ) as mock_inner:
        game = try_dat_hash_identify(
            full_disk_path=str(rom),
            library_uuid=gb_library.uuid,
            library_platform='GB',
            hashes={
                'crc': 'aabbcc01',
                'md5': '11111111111111111111111111111111',
                'sha1': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            },
        )
    assert game is not None
    assert f'Tetris {tag}' in game.name
    mock_inner.assert_not_called()


def test_non_archive_miss_does_not_invent(db_session, gb_library, tmp_path):
    tag = uuid4().hex[:8]
    upsert_reference_set(
        library_platform='GB',
        region='USA',
        source='nointro',
        dat_bytes=_dat_with_hashes(tag),
    )
    rom = tmp_path / f'Unknown {tag}.gb'
    rom.write_bytes(b'no-dat-match-payload')

    assert hash_archive_inner_primary_dumps(rom, platform='GB') == []
    game = try_dat_hash_identify(
        full_disk_path=str(rom),
        library_uuid=gb_library.uuid,
        library_platform='GB',
    )
    assert game is None


def test_hash_archive_inner_empty_for_loose_rom(tmp_path):
    rom = tmp_path / 'plain.gb'
    rom.write_bytes(b'x')
    assert hash_archive_inner_primary_dumps(rom, platform='GB') == []


def test_dat_hash_inner_archive_env_off(db_session, gb_library, tmp_path, monkeypatch):
    monkeypatch.setenv('DAT_HASH_INNER_ARCHIVE', '0')
    tag = uuid4().hex[:8]
    rom_bytes = b'gated-inner-' + tag.encode()
    inner = _digest_of_bytes(rom_bytes)
    dat = f"""<?xml version="1.0"?>
<datafile>
  <header><name>GB {tag}</name><description>x</description></header>
  <game name="Tetris {tag} (USA)">
    <description>Tetris {tag} (USA)</description>
    <rom name="Tetris {tag} (USA).gb" size="{len(rom_bytes)}" crc="{inner['crc']}"
         md5="{inner['md5']}" sha1="{inner['sha1']}"/>
  </game>
</datafile>
""".encode('utf-8')
    upsert_reference_set(
        library_platform='GB',
        region='USA',
        source='nointro',
        dat_bytes=dat,
    )
    archive = _write_zip(
        tmp_path / f'Tetris {tag}.zip',
        {f'Tetris {tag} (USA).gb': rom_bytes},
    )
    assert hash_archive_inner_primary_dumps(archive, platform='GB') == []
    game = try_dat_hash_identify(
        full_disk_path=str(archive),
        library_uuid=gb_library.uuid,
        library_platform='GB',
    )
    assert game is None
