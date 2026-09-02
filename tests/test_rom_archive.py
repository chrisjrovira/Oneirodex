"""Unit tests for ROM archive extract-on-play (zip / 7z / gz)."""

from __future__ import annotations

import gzip
import os
import zipfile
from pathlib import Path

import pytest

from oneirodex.utils.rom_archive import (
    ArchiveRomError,
    bundle_playable_rom_zip,
    choose_rom_member,
    extract_rom_from_rar,
    extract_rom_from_zip,
    find_archive_extractors,
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


def test_bundle_cue_bin_zips_and_rewrites_paths(tmp_path):
    disc_dir = tmp_path / 'disc'
    disc_dir.mkdir()
    cue_path = disc_dir / 'Game (Disc 1).cue'
    cue_path.write_text(
        'FILE "subfolder/Game (Disc 1).bin" BINARY\n'
        '  TRACK 01 MODE2/2352\n'
        '    INDEX 01 00:00:00\n',
        encoding='utf-8',
    )
    (disc_dir / 'Game (Disc 1).bin').write_bytes(b'BINDATA' * 1000)
    (disc_dir / 'readme.txt').write_text('ignore me', encoding='utf-8')

    cache = tmp_path / 'cache'
    zip_path, filename = bundle_playable_rom_zip(str(cue_path), str(cache))

    assert filename == 'play.zip'
    assert Path(zip_path) == cache / 'play.zip'

    with zipfile.ZipFile(zip_path) as zf:
        names = set(zf.namelist())
        assert names == {'Game (Disc 1).cue', 'Game (Disc 1).bin'}
        info = zf.getinfo('Game (Disc 1).cue')
        assert info.compress_type == zipfile.ZIP_STORED
        cue_contents = zf.read('Game (Disc 1).cue').decode('utf-8')
        assert 'FILE "Game (Disc 1).bin" BINARY' in cue_contents
        assert 'subfolder' not in cue_contents
        assert zf.read('Game (Disc 1).bin') == b'BINDATA' * 1000


def test_bundle_reuses_fresh_zip(tmp_path):
    disc_dir = tmp_path / 'disc'
    disc_dir.mkdir()
    cue_path = disc_dir / 'disc.cue'
    cue_path.write_text('FILE "disc.bin" BINARY\n', encoding='utf-8')
    (disc_dir / 'disc.bin').write_bytes(b'X' * 100)

    cache = tmp_path / 'cache'
    zip_path_1, _ = bundle_playable_rom_zip(str(cue_path), str(cache))
    first_mtime = os.path.getmtime(zip_path_1)

    zip_path_2, _ = bundle_playable_rom_zip(str(cue_path), str(cache))
    assert zip_path_2 == zip_path_1
    assert os.path.getmtime(zip_path_2) == first_mtime


def test_bundle_single_iso_unchanged(tmp_path):
    disc_dir = tmp_path / 'disc'
    disc_dir.mkdir()
    iso_path = disc_dir / 'game.iso'
    iso_path.write_bytes(b'ISODATA')

    cache = tmp_path / 'cache'
    result_path, filename = bundle_playable_rom_zip(str(iso_path), str(cache))

    assert result_path == str(iso_path)
    assert filename == 'game.iso'
    assert not (cache / 'play.zip').exists()


def test_bundle_cue_without_companions_unchanged(tmp_path):
    disc_dir = tmp_path / 'disc'
    disc_dir.mkdir()
    cue_path = disc_dir / 'lone.cue'
    cue_path.write_text('FILE "lone.bin" BINARY\n', encoding='utf-8')

    cache = tmp_path / 'cache'
    result_path, filename = bundle_playable_rom_zip(str(cue_path), str(cache))

    assert result_path == str(cue_path)
    assert filename == 'lone.cue'
    assert not (cache / 'play.zip').exists()


def test_rar_missing_extractor_returns_hint(tmp_path, monkeypatch):
    rar_path = tmp_path / 'game.rar'
    rar_path.write_bytes(b'Rar!\x00fake')

    import builtins
    real_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name == 'rarfile':
            raise ImportError('no rarfile')
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, '__import__', fake_import)
    monkeypatch.setattr(
        'oneirodex.utils.rom_archive.find_archive_extractors',
        lambda: {},
    )
    with pytest.raises(ArchiveRomError) as exc:
        resolve_playable_rom_path(str(rar_path), cache_dir=str(tmp_path / 'c'))
    payload = exc.value.to_dict()
    assert exc.value.status_code == 415
    assert payload['code'] == 'missing_extractor'
    assert 'error' in payload
    assert 'hint' in payload
    hint = payload['hint'].lower()
    assert '7z' in hint or 'bsdtar' in hint or 'p7zip' in hint
    assert 'zip' in hint


def test_rar_extract_via_stubbed_7z(tmp_path, monkeypatch):
    """When 7z is on PATH (stubbed), extract succeeds without rarfile."""
    rar_path = tmp_path / 'pack.rar'
    rar_path.write_bytes(b'fake-rar')
    fake_7z = tmp_path / 'fake-7z'
    fake_7z.write_text('#!/bin/sh\n', encoding='utf-8')
    cache = tmp_path / 'cache'
    cache.mkdir()

    list_calls = {'n': 0}

    def fake_run(cmdline, **kwargs):
        from subprocess import CompletedProcess

        if 'l' in cmdline and '-slt' in cmdline:
            list_calls['n'] += 1
            stdout = (
                'Path = nested/Hero.nes\n'
                'Size = 9\n'
                'Attributes = A\n'
                '\n'
            )
            return CompletedProcess(cmdline, 0, stdout=stdout, stderr='')
        if 'e' in cmdline or 'x' in cmdline:
            dest = cache / 'Hero.nes'
            dest.write_bytes(b'NESROMDAT')
            return CompletedProcess(cmdline, 0, stdout='', stderr='')
        return CompletedProcess(cmdline, 1, stdout='', stderr=f'unexpected {cmdline}')

    import builtins
    real_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name == 'rarfile':
            raise ImportError('no rarfile')
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, '__import__', fake_import)
    monkeypatch.setattr(
        'oneirodex.utils.rom_archive.find_archive_extractors',
        lambda: {'7z': str(fake_7z)},
    )
    monkeypatch.setattr('oneirodex.utils.rom_archive._run_extractor', fake_run)

    path, name = resolve_playable_rom_path(
        str(rar_path),
        cache_dir=str(cache),
        platform='NES',
    )
    assert name == 'Hero.nes'
    assert Path(path).read_bytes() == b'NESROMDAT'
    assert list_calls['n'] >= 1


def test_find_archive_extractors_shape(monkeypatch):
    monkeypatch.setattr(
        'oneirodex.utils.rom_archive.shutil.which',
        lambda name: f'/usr/bin/{name}' if name in ('7z', 'bsdtar') else None,
    )
    found = find_archive_extractors()
    assert found['7z'] == '/usr/bin/7z'
    assert found['bsdtar'] == '/usr/bin/bsdtar'
    assert 'unrar' not in found


def test_extract_rom_from_rar_missing_tool_direct(tmp_path, monkeypatch):
    rar_path = tmp_path / 'x.rar'
    rar_path.write_bytes(b'x')
    monkeypatch.setattr(
        'oneirodex.utils.rom_archive.find_archive_extractors',
        lambda: {},
    )
    import builtins
    real_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name == 'rarfile':
            raise ImportError('no')
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, '__import__', fake_import)
    with pytest.raises(ArchiveRomError) as exc:
        extract_rom_from_rar(str(rar_path), str(tmp_path / 'c'))
    assert exc.value.code == 'missing_extractor'
