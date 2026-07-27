"""Hash ROM files for DAT set-completion matching (CRC32 / MD5 / SHA1)."""

from __future__ import annotations

import hashlib
import zlib
from pathlib import Path

# Prefer single-file ROM dumps when a library path is a folder.
_ROM_SUFFIXES = frozenset({
    '.nes', '.sfc', '.smc', '.n64', '.z64', '.v64', '.gb', '.gbc', '.gba', '.nds',
    '.md', '.gen', '.sms', '.gg', '.pce', '.ngp', '.ws', '.wsc', '.a26', '.a78',
    '.lnx', '.col', '.int', '.iso', '.cue', '.chd', '.bin', '.img', '.rom',
    '.zip', '.7z',
})


def resolve_hashable_file(path: str | Path) -> Path | None:
    """Return a single file to hash, or None for multi-file / missing paths."""
    root = Path(path) if path else None
    if root is None:
        return None
    try:
        if root.is_file():
            return root
        if not root.is_dir():
            return None
    except OSError:
        return None

    candidates: list[Path] = []
    try:
        for child in root.iterdir():
            if child.is_file() and child.suffix.lower() in _ROM_SUFFIXES:
                candidates.append(child)
    except OSError:
        return None
    if len(candidates) == 1:
        return candidates[0]
    return None


def hash_rom_file(path: str | Path, *, chunk_size: int = 1024 * 1024) -> dict[str, str] | None:
    """Return lowercase hex crc/md5/sha1 for a ROM file path, or None if unhashable."""
    target = resolve_hashable_file(path)
    if target is None:
        return None
    crc = 0
    md5 = hashlib.md5()
    sha1 = hashlib.sha1()
    try:
        with target.open('rb') as handle:
            while True:
                chunk = handle.read(chunk_size)
                if not chunk:
                    break
                crc = zlib.crc32(chunk, crc)
                md5.update(chunk)
                sha1.update(chunk)
    except OSError:
        return None
    return {
        'crc': f'{crc & 0xffffffff:08x}',
        'md5': md5.hexdigest(),
        'sha1': sha1.hexdigest(),
    }


def apply_file_hashes_to_game(game, path: str | None = None) -> bool:
    """Hash ``path`` (or ``game.full_disk_path``) onto the game model. Returns True if set."""
    disk = path if path is not None else getattr(game, 'full_disk_path', None)
    hashes = hash_rom_file(disk) if disk else None
    if not hashes:
        return False
    game.file_crc = hashes['crc']
    game.file_md5 = hashes['md5']
    game.file_sha1 = hashes['sha1']
    return True
