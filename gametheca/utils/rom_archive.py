"""Resolve a playable ROM file path, including zip/7z archives for WebRetro."""

from __future__ import annotations

import os
import zipfile
from pathlib import Path

ROM_EXTENSIONS = frozenset({
    '.nes', '.smc', '.sfc', '.n64', '.z64', '.v64', '.gb', '.gbc', '.gba',
    '.nds', '.iso', '.cue', '.bin', '.chd', '.pce', '.ngp', '.ngc',
    '.ws', '.wsc', '.col', '.vec', '.a26', '.a52', '.a78', '.lnx', '.jag',
    '.md', '.smd', '.gen', '.sms', '.gg', '.32x', '.rom', '.fds',
})

ARCHIVE_EXTENSIONS = frozenset({'.zip', '.7z', '.rar'})
UNSUPPORTED_ARCHIVE_EXTENSIONS = frozenset()


class ArchiveRomError(Exception):
    """Raised when an archive cannot be used for emulation."""

    def __init__(self, message: str, *, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def _is_rom_name(name: str) -> bool:
    lower = name.lower()
    return any(lower.endswith(ext) for ext in ROM_EXTENSIONS)


def list_roms_in_zip(zip_path: str) -> list[str]:
    with zipfile.ZipFile(zip_path, 'r') as archive:
        return [
            info.filename
            for info in archive.infolist()
            if not info.is_dir() and _is_rom_name(info.filename)
        ]


def extract_rom_from_zip(zip_path: str, cache_dir: str, *, member: str | None = None) -> str:
    """
    Extract one ROM member from a zip into cache_dir and return absolute path.
    """
    os.makedirs(cache_dir, exist_ok=True)
    members = list_roms_in_zip(zip_path)
    if not members:
        raise ArchiveRomError('No playable ROM files found inside zip archive')
    chosen = member if member in members else members[0]
    safe_name = Path(chosen).name
    if not safe_name or safe_name in ('.', '..'):
        raise ArchiveRomError('Invalid ROM member name in archive')

    dest = os.path.join(cache_dir, safe_name)
    if os.path.isfile(dest) and os.path.getsize(dest) > 0:
        return dest

    with zipfile.ZipFile(zip_path, 'r') as archive:
        with archive.open(chosen) as src, open(dest, 'wb') as out:
            while True:
                chunk = src.read(1024 * 1024)
                if not chunk:
                    break
                out.write(chunk)
    return dest


def _list_roms_in_7z(archive_path: str) -> list[str]:
    try:
        import py7zr
        from py7zr.exceptions import Bad7zFile
    except ImportError as exc:
        raise ArchiveRomError(
            '.7z support requires the optional py7zr package',
            status_code=415,
        ) from exc
    try:
        with py7zr.SevenZipFile(archive_path, mode='r') as archive:
            return [name for name in archive.getnames() if _is_rom_name(name)]
    except Bad7zFile as exc:
        raise ArchiveRomError('Invalid or corrupt 7z archive', status_code=400) from exc


def extract_rom_from_7z(archive_path: str, cache_dir: str, *, member: str | None = None) -> str:
    try:
        import py7zr
        from py7zr.exceptions import Bad7zFile
    except ImportError as exc:
        raise ArchiveRomError(
            '.7z support requires the optional py7zr package',
            status_code=415,
        ) from exc

    os.makedirs(cache_dir, exist_ok=True)
    try:
        members = _list_roms_in_7z(archive_path)
    except ArchiveRomError:
        raise
    if not members:
        raise ArchiveRomError('No playable ROM files found inside 7z archive')
    chosen = member if member in members else members[0]
    safe_name = Path(chosen).name
    if not safe_name or safe_name in ('.', '..'):
        raise ArchiveRomError('Invalid ROM member name in archive')

    dest = os.path.join(cache_dir, safe_name)
    if os.path.isfile(dest) and os.path.getsize(dest) > 0:
        return dest

    try:
        with py7zr.SevenZipFile(archive_path, mode='r') as archive:
            archive.extract(targets=[chosen], path=cache_dir)
    except Bad7zFile as exc:
        raise ArchiveRomError('Invalid or corrupt 7z archive', status_code=400) from exc
    extracted = os.path.join(cache_dir, chosen)
    if os.path.isfile(extracted) and extracted != dest:
        os.replace(extracted, dest)
        parent = os.path.dirname(extracted)
        while parent.startswith(cache_dir) and parent != cache_dir:
            try:
                os.rmdir(parent)
            except OSError:
                break
            parent = os.path.dirname(parent)
    if not os.path.isfile(dest):
        raise ArchiveRomError('Failed to extract ROM from 7z archive')
    return dest


def extract_rom_from_rar(archive_path: str, cache_dir: str, *, member: str | None = None) -> str:
    """
    Extract one ROM from a .rar archive when rarfile + an unrar tool are available.
    """
    try:
        import rarfile
    except ImportError as exc:
        raise ArchiveRomError(
            '.rar support requires the optional rarfile package and an unrar tool',
            status_code=415,
        ) from exc

    os.makedirs(cache_dir, exist_ok=True)
    try:
        with rarfile.RarFile(archive_path) as archive:
            members = [
                info.filename
                for info in archive.infolist()
                if not info.is_dir() and _is_rom_name(info.filename)
            ]
            if not members:
                raise ArchiveRomError('No playable ROM files found inside rar archive')
            chosen = member if member in members else members[0]
            safe_name = Path(chosen).name
            if not safe_name or safe_name in ('.', '..'):
                raise ArchiveRomError('Invalid ROM member name in archive')
            dest = os.path.join(cache_dir, safe_name)
            if os.path.isfile(dest) and os.path.getsize(dest) > 0:
                return dest
            with archive.open(chosen) as src, open(dest, 'wb') as out:
                while True:
                    chunk = src.read(1024 * 1024)
                    if not chunk:
                        break
                    out.write(chunk)
            return dest
    except ArchiveRomError:
        raise
    except rarfile.Error as exc:
        raise ArchiveRomError(
            'Failed to read rar archive (is an unrar tool installed?)',
            status_code=415,
        ) from exc


def resolve_playable_rom_path(source_path: str, *, cache_dir: str) -> tuple[str, str]:
    """
    Return (absolute_file_path, filename) suitable for WebRetro streaming.

    Supports plain ROM files, .zip, optional .7z (py7zr), and optional .rar (rarfile).
    """
    if not source_path or not os.path.exists(source_path):
        raise ArchiveRomError('ROM path not found', status_code=404)

    path = os.path.abspath(source_path)
    if os.path.isfile(path):
        ext = Path(path).suffix.lower()
        if ext in UNSUPPORTED_ARCHIVE_EXTENSIONS:
            raise ArchiveRomError(
                f'{ext} archives are not supported — use .zip, .7z, .rar, or a raw ROM',
                status_code=415,
            )
        if ext == '.zip':
            extracted = extract_rom_from_zip(path, cache_dir)
            return extracted, os.path.basename(extracted)
        if ext == '.7z':
            extracted = extract_rom_from_7z(path, cache_dir)
            return extracted, os.path.basename(extracted)
        if ext == '.rar':
            extracted = extract_rom_from_rar(path, cache_dir)
            return extracted, os.path.basename(extracted)
        return path, os.path.basename(path)

    if os.path.isdir(path):
        archives = [
            os.path.join(path, name)
            for name in os.listdir(path)
            if Path(name).suffix.lower() in ARCHIVE_EXTENSIONS
            and os.path.isfile(os.path.join(path, name))
        ]
        roms = [
            os.path.join(path, name)
            for name in os.listdir(path)
            if _is_rom_name(name) and os.path.isfile(os.path.join(path, name))
        ]
        if len(roms) == 1:
            return roms[0], os.path.basename(roms[0])
        if len(archives) == 1:
            return resolve_playable_rom_path(archives[0], cache_dir=cache_dir)
        if roms:
            chosen = sorted(roms)[0]
            return chosen, os.path.basename(chosen)
        raise ArchiveRomError(
            'Folder has no single archive/ROM suitable for WebRetro play',
            status_code=400,
        )

    raise ArchiveRomError('Unsupported ROM path type', status_code=400)
