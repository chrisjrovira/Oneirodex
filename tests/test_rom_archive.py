"""Unit tests for ROM archive extract-on-play (zip / 7z / gz)."""

from __future__ import annotations

import gzip
import zipfile
from pathlib import Path

import pytest

from gametheca.utils.rom_archive import (
    ArchiveRomError,
    choose_rom_member,
    extract_rom_from_zip,
    path_supports_browser_extract,
    resolve_playable_rom_path,
)


def test_choose_prefers_platform_extension():
    members = [
        ('readme.txt', 10),  # not a rom — caller filters first
        ('junk.bin', 50),
        ('Game.nes', 40_000),
        ('Game.smc', 500_000),
    ]
    # Only pass ROM-like names (as list_roms would).
    roms = [(n, s) for n, s in members if Path(n).suffix.lower() in {'.bin', '.nes', '.smc'}]
    assert choose_rom_member(roms, platform='NES') == 'Game.nes'
    assert choose_rom_member(roms, platform='SNES') == 'Game.smc'


def test_choose_prefers_larger_over_tiny_junk():
    members = [
        ('tiny.nes', 128),
        ('real.nes', 131_072),
    ]
    assert choose_rom_member(members, platform='NES') == 'real.nes'


def test_choose_prefers_cue_over_bin():
    members = [
        ('disc.bin', 700_000_000),
        ('disc.cue', 200),
    ]
    assert choose_rom_member(members, platform='PSX') == 'disc.cue'


def test_resolve_zip_nested_folder(tmp_path):
    zip_path = tmp_path / 'game.zip'
    with zipfile.ZipFile(zip_path, 'w') as zf:
        zf.writestr('nested/Adventure.nes', b'NESROMDATA')
    cache = tmp_path / 'cache'
    path, name = resolve_playable_rom_path(str(zip_path), cache_dir=str(cache))
    assert name == 'Adventure.nes'
    assert Path(path).read_bytes() == b'NESROMDATA'


def test_resolve_zip_platform_pick(tmp_path):
    zip_path = tmp_path / 'multi.zip'
    with zipfile.ZipFile(zip_path, 'w') as zf:
        zf.writestr('a.smc', b'S' * 10_000)
        zf.writestr('b.nes', b'N' * 8_000)
    cache = tmp_path / 'cache'
    path, name = resolve_playable_rom_path(
        str(zip_path),
        cache_dir=str(cache),
        platform='NES',
    )
    assert name == 'b.nes'
    assert Path(path).read_bytes() == b'N' * 8_000


def test_resolve_nested_zip_member(tmp_path):
    inner = tmp_path / 'inner.zip'
    with zipfile.ZipFile(inner, 'w') as zf:
        zf.writestr('deep/Hero.gba', b'GBAROM')
    outer = tmp_path / 'outer.zip'
    with zipfile.ZipFile(outer, 'w') as zf:
        zf.write(inner, arcname='pack/inner.zip')
    cache = tmp_path / 'cache'
    path, name = resolve_playable_rom_path(str(outer), cache_dir=str(cache), platform='GBA')
    assert name == 'Hero.gba'
    assert Path(path).read_bytes() == b'GBAROM'


def test_resolve_cue_bin_companions(tmp_path):
    zip_path = tmp_path / 'psx.zip'
    with zipfile.ZipFile(zip_path, 'w') as zf:
        zf.writestr('game/disc.cue', b'FILE "disc.bin" BINARY\n')
        zf.writestr('game/disc.bin', b'BINDATA' * 100)
        zf.writestr('game/readme.txt', b'ignore')
    cache = tmp_path / 'cache'
    path, name = resolve_playable_rom_path(str(zip_path), cache_dir=str(cache), platform='PSX')
    assert name == 'disc.cue'
    assert Path(path).is_file()
    assert (cache / 'disc.bin').is_file()
    assert (cache / 'disc.bin').read_bytes() == b'BINDATA' * 100


def test_resolve_gz_rom(tmp_path):
    gz_path = tmp_path / 'Adventure.nes.gz'
    with gzip.open(gz_path, 'wb') as fh:
        fh.write(b'NESGZDATA')
    cache = tmp_path / 'cache'
    path, name = resolve_playable_rom_path(str(gz_path), cache_dir=str(cache))
    assert name == 'Adventure.nes'
    assert Path(path).read_bytes() == b'NESGZDATA'


def test_resolve_tar_gz_rejected(tmp_path):
    bad = tmp_path / 'archive.tar.gz'
    with gzip.open(bad, 'wb') as fh:
        fh.write(b'not-a-rom')
    with pytest.raises(ArchiveRomError) as exc:
        resolve_playable_rom_path(str(bad), cache_dir=str(tmp_path / 'c'))
    assert exc.value.status_code == 415
    assert exc.value.code == 'unsupported_format'


def test_path_supports_browser_extract_gz():
    assert path_supports_browser_extract('/lib/Adventure.nes.gz') is True
    assert path_supports_browser_extract('/lib/archive.tar.gz') is False
    assert path_supports_browser_extract('/lib/game.zip') is True
    assert path_supports_browser_extract('/lib/game.tar') is False


def test_empty_zip_clear_error(tmp_path):
    zip_path = tmp_path / 'empty.zip'
    with zipfile.ZipFile(zip_path, 'w') as zf:
        zf.writestr('readme.txt', b'no rom here')
    with pytest.raises(ArchiveRomError) as exc:
        extract_rom_from_zip(str(zip_path), str(tmp_path / 'c'))
    assert exc.value.code == 'no_playable_member'
    assert exc.value.to_dict()['error']


def test_resolve_7z_with_py7zr(tmp_path):
    py7zr = pytest.importorskip('py7zr')
    seven = tmp_path / 'game.7z'
    with py7zr.SevenZipFile(seven, 'w') as archive:
        archive.writestr(b'SNESDATA', 'Folder/Quest.sfc')
    cache = tmp_path / 'cache'
    path, name = resolve_playable_rom_path(str(seven), cache_dir=str(cache), platform='SNES')
    assert name == 'Quest.sfc'
    assert Path(path).read_bytes() == b'SNESDATA'


def test_archive_error_payload_shape():
    err = ArchiveRomError('boom', status_code=415, code='missing_dependency', hint='install x')
    assert err.to_dict() == {
        'error': 'boom',
        'code': 'missing_dependency',
        'hint': 'install x',
    }
