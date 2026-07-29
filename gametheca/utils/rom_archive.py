"""Resolve a playable ROM file path, including zip/7z/rar/gz archives for WebRetro."""

from __future__ import annotations

import gzip
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

# Single-file gzip wrappers of a ROM (e.g. Adventure.nes.gz) — scanned via AllowedFileType `gz`.
GZIP_EXTENSIONS = frozenset({'.gz'})

# Advertised by scan history or mistaken drops; not extractable for WebRetro.
UNSUPPORTED_ARCHIVE_EXTENSIONS = frozenset({
    '.tar', '.tgz', '.tbz2', '.txz', '.xz', '.bz2', '.lz', '.lzma',
})

# Prefer these extensions when the library platform is known.
PLATFORM_ROM_EXTENSIONS: dict[str, frozenset[str]] = {
    'NES': frozenset({'.nes', '.fds', '.unf', '.unif'}),
    'SNES': frozenset({'.smc', '.sfc'}),
    'N64': frozenset({'.n64', '.z64', '.v64'}),
    'GB': frozenset({'.gb'}),
    'GBC': frozenset({'.gbc', '.gb'}),
    'GBA': frozenset({'.gba'}),
    'NDS': frozenset({'.nds'}),
    'VB': frozenset({'.vb', '.vboy'}),
    'PSX': frozenset({'.cue', '.chd', '.iso', '.bin', '.pbp', '.img'}),
    'PCE': frozenset({'.pce', '.cue', '.chd'}),
    'SEGA_MD': frozenset({'.md', '.smd', '.gen', '.bin'}),
    'SEGA_MS': frozenset({'.sms'}),
    'SEGA_GG': frozenset({'.gg'}),
    'SEGA_32X': frozenset({'.32x'}),
    'SEGA_CD': frozenset({'.cue', '.chd', '.iso', '.bin'}),
    'SEGA_SATURN': frozenset({'.cue', '.chd', '.iso', '.bin'}),
    'ATARI_2600': frozenset({'.a26', '.bin', '.rom'}),
    'ATARI_5200': frozenset({'.a52', '.bin'}),
    'ATARI_7800': frozenset({'.a78', '.bin'}),
    'LYNX': frozenset({'.lnx'}),
    'JAGUAR': frozenset({'.jag', '.j64', '.rom'}),
    'WS': frozenset({'.ws', '.wsc'}),
    'NGP': frozenset({'.ngp', '.ngc'}),
    'COLECO': frozenset({'.col', '.rom', '.bin'}),
    'VECTREX': frozenset({'.vec', '.bin'}),
    'NEOGEO_CD': frozenset({'.cue', '.chd', '.iso'}),
    'THREEDO': frozenset({'.cue', '.chd', '.iso'}),
}

# When a .cue is chosen, also extract these sibling extensions from the same archive folder.
CUE_COMPANION_EXTENSIONS = frozenset({'.bin', '.img', '.iso', '.raw', '.wav'})

MAX_NEST_DEPTH = 3
MIN_ROM_BYTES_PREFERRED = 1024


class ArchiveRomError(Exception):
    """Raised when an archive cannot be used for emulation."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int = 400,
        code: str = 'archive_error',
        hint: str | None = None,
    ):
        self.message = message
        self.status_code = status_code
        self.code = code
        self.hint = hint
        super().__init__(message)

    def to_dict(self) -> dict[str, str]:
        payload = {'error': self.message, 'code': self.code}
        if self.hint:
            payload['hint'] = self.hint
        return payload


def _is_rom_name(name: str) -> bool:
    lower = Path(name).name.lower()
    return any(lower.endswith(ext) for ext in ROM_EXTENSIONS)


def _member_ext(name: str) -> str:
    return Path(name).suffix.lower()


def _safe_basename(member: str) -> str:
    safe_name = Path(member).name
    if not safe_name or safe_name in ('.', '..'):
        raise ArchiveRomError(
            'Invalid ROM member name in archive',
            code='invalid_member',
        )
    return safe_name


def _platform_key(platform: str | None) -> str | None:
    if not platform:
        return None
    text = str(platform).strip()
    if not text:
        return None
    # Accept enum .name or raw key.
    return text.upper().replace(' ', '_') if text.islower() else text


def choose_rom_member(
    members: list[tuple[str, int]],
    *,
    platform: str | None = None,
    preferred_member: str | None = None,
) -> str:
    """
    Pick the best ROM member from (name, size) pairs.

    Prefer: explicit member → platform-matching extension → .cue over lone .bin →
    larger size → shallower path. Tiny junk files are demoted when larger ROMs exist.
    """
    if not members:
        raise ArchiveRomError(
            'No playable ROM files found inside archive',
            code='no_playable_member',
            hint='Archive should contain a ROM with a known extension (e.g. .nes, .sfc, .gba).',
        )

    names = {name for name, _ in members}
    if preferred_member and preferred_member in names:
        return preferred_member

    preferred_exts = PLATFORM_ROM_EXTENSIONS.get(_platform_key(platform) or '', frozenset())
    has_cue = any(_member_ext(name) == '.cue' for name, _ in members)

    scored: list[tuple[float, str]] = []
    for name, size in members:
        ext = _member_ext(name)
        score = float(max(size, 0))
        if preferred_exts and ext in preferred_exts:
            score += 1e12
        if ext == '.cue':
            score += 1e9
        if has_cue and ext == '.bin':
            # WebRetro / disc cores usually want the cue sheet, not a raw track dump.
            score -= 1e8
        if size < MIN_ROM_BYTES_PREFERRED and any(s >= MIN_ROM_BYTES_PREFERRED for _, s in members):
            score -= 1e6
        depth = name.count('/') + name.count('\\')
        score -= depth * 1000
        # Stable tie-break: lexicographic name (negative so reverse sort still prefers A before Z).
        scored.append((score, name))

    scored.sort(key=lambda item: (-item[0], item[1].lower()))
    return scored[0][1]


def path_supports_browser_extract(source_path: str | None) -> bool:
    """
    Whether browse play_url may advertise browser play for this on-disk path.

    Returns True when unknown/empty (keep existing browse behavior) or when the
    resolver can attempt extract/stream. Returns False for formats we will never
    extract for WebRetro (e.g. bare .tar / non-ROM .gz). Existence is not required.
    """
    if not source_path:
        return True
    path = os.path.abspath(source_path)
    if os.path.isdir(path):
        return True

    ext = Path(path).suffix.lower()
    if ext in UNSUPPORTED_ARCHIVE_EXTENSIONS:
        return False
    if ext in ARCHIVE_EXTENSIONS:
        return True
    if ext in GZIP_EXTENSIONS:
        return _is_rom_name(Path(path).stem)
    if _is_rom_name(Path(path).name):
        return True
    # Unknown extension — leave browse decision to platform/cores.
    return True


def list_roms_in_zip(zip_path: str) -> list[str]:
    return [name for name, _ in _list_roms_with_sizes_in_zip(zip_path)]


def _list_roms_with_sizes_in_zip(zip_path: str) -> list[tuple[str, int]]:
    try:
        with zipfile.ZipFile(zip_path, 'r') as archive:
            return [
                (info.filename, int(info.file_size or 0))
                for info in archive.infolist()
                if not info.is_dir() and _is_rom_name(info.filename)
            ]
    except zipfile.BadZipFile as exc:
        raise ArchiveRomError(
            'Invalid or corrupt zip archive',
            code='corrupt_archive',
            hint='Re-zip the ROM or use a raw ROM / .7z / .rar if the file is not a zip.',
        ) from exc


def _list_nested_zip_members(zip_path: str) -> list[tuple[str, int]]:
    with zipfile.ZipFile(zip_path, 'r') as archive:
        return [
            (info.filename, int(info.file_size or 0))
            for info in archive.infolist()
            if not info.is_dir() and info.filename.lower().endswith('.zip')
        ]


def _extract_zip_member(archive: zipfile.ZipFile, member: str, dest: str) -> None:
    parent = os.path.dirname(dest)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with archive.open(member) as src, open(dest, 'wb') as out:
        while True:
            chunk = src.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)


def _extract_cue_companions(
    archive: zipfile.ZipFile,
    chosen: str,
    cache_dir: str,
    member_names: set[str],
) -> None:
    """Extract disc companions (.bin/.img/…) next to a chosen .cue in the same zip folder."""
    if _member_ext(chosen) != '.cue':
        return
    folder = str(Path(chosen).parent).replace('\\', '/')
    if folder == '.':
        folder = ''
    prefix = f'{folder}/' if folder else ''
    for name in member_names:
        if name == chosen:
            continue
        norm = name.replace('\\', '/')
        if folder:
            if not norm.startswith(prefix):
                continue
            rest = norm[len(prefix):]
            if '/' in rest:
                continue
        elif '/' in norm or '\\' in name:
            continue
        if _member_ext(name) not in CUE_COMPANION_EXTENSIONS:
            continue
        companion_dest = os.path.join(cache_dir, Path(name).name)
        if os.path.isfile(companion_dest) and os.path.getsize(companion_dest) > 0:
            continue
        try:
            _extract_zip_member(archive, name, companion_dest)
        except KeyError:
            continue


def extract_rom_from_zip(
    zip_path: str,
    cache_dir: str,
    *,
    member: str | None = None,
    platform: str | None = None,
    nest_depth: int = 0,
) -> str:
    """
    Extract one ROM member from a zip into cache_dir and return absolute path.

    Supports nested .zip members when no ROM is present at the current level.
    When a .cue is selected, sibling disc images in the same folder are extracted too.
    """
    os.makedirs(cache_dir, exist_ok=True)
    rom_members = _list_roms_with_sizes_in_zip(zip_path)

    if rom_members:
        chosen = choose_rom_member(rom_members, platform=platform, preferred_member=member)
        safe_name = _safe_basename(chosen)
        dest = os.path.join(cache_dir, safe_name)
        with zipfile.ZipFile(zip_path, 'r') as archive:
            all_names = {info.filename for info in archive.infolist() if not info.is_dir()}
            if not (os.path.isfile(dest) and os.path.getsize(dest) > 0):
                try:
                    _extract_zip_member(archive, chosen, dest)
                except KeyError as exc:
                    raise ArchiveRomError(
                        f'ROM member not found in zip: {safe_name}',
                        code='invalid_member',
                    ) from exc
            _extract_cue_companions(archive, chosen, cache_dir, all_names)
        if not os.path.isfile(dest):
            raise ArchiveRomError(
                'Failed to extract ROM from zip archive',
                code='extract_failed',
            )
        return dest

    if nest_depth >= MAX_NEST_DEPTH:
        raise ArchiveRomError(
            'No playable ROM files found inside zip archive (nested search exhausted)',
            code='no_playable_member',
            hint='Put a ROM directly in the zip, or use a shallower nest of zip-in-zip.',
        )

    nested = _list_nested_zip_members(zip_path)
    if not nested:
        raise ArchiveRomError(
            'No playable ROM files found inside zip archive',
            code='no_playable_member',
            hint='Archive should contain a ROM with a known extension (e.g. .nes, .sfc, .gba).',
        )

    nested.sort(key=lambda item: (-item[1], item[0].lower()))
    last_error: ArchiveRomError | None = None
    for nested_name, _ in nested[:8]:
        nested_basename = _safe_basename(nested_name)
        nested_dest = os.path.join(cache_dir, f'_nested_{nest_depth}_{nested_basename}')
        try:
            with zipfile.ZipFile(zip_path, 'r') as archive:
                if not (os.path.isfile(nested_dest) and os.path.getsize(nested_dest) > 0):
                    _extract_zip_member(archive, nested_name, nested_dest)
            return extract_rom_from_zip(
                nested_dest,
                cache_dir,
                member=member,
                platform=platform,
                nest_depth=nest_depth + 1,
            )
        except ArchiveRomError as exc:
            last_error = exc
            continue

    if last_error is not None:
        raise last_error
    raise ArchiveRomError(
        'No playable ROM files found inside nested zip archive',
        code='no_playable_member',
    )


def _list_roms_in_7z(archive_path: str) -> list[tuple[str, int]]:
    try:
        import py7zr
        from py7zr.exceptions import Bad7zFile
    except ImportError as exc:
        raise ArchiveRomError(
            '.7z support requires the optional py7zr package',
            status_code=415,
            code='missing_dependency',
            hint='Install py7zr in the GameTheca environment (see requirements.txt).',
        ) from exc
    try:
        with py7zr.SevenZipFile(archive_path, mode='r') as archive:
            names = [name for name in archive.getnames() if _is_rom_name(name)]
            # py7zr does not always expose reliable per-file sizes before extract; use 0.
            return [(name, 0) for name in names]
    except Bad7zFile as exc:
        raise ArchiveRomError(
            'Invalid or corrupt 7z archive',
            status_code=400,
            code='corrupt_archive',
        ) from exc


def extract_rom_from_7z(
    archive_path: str,
    cache_dir: str,
    *,
    member: str | None = None,
    platform: str | None = None,
) -> str:
    try:
        import py7zr
        from py7zr.exceptions import Bad7zFile
    except ImportError as exc:
        raise ArchiveRomError(
            '.7z support requires the optional py7zr package',
            status_code=415,
            code='missing_dependency',
            hint='Install py7zr in the GameTheca environment (see requirements.txt).',
        ) from exc

    os.makedirs(cache_dir, exist_ok=True)
    members = _list_roms_in_7z(archive_path)
    if not members:
        raise ArchiveRomError(
            'No playable ROM files found inside 7z archive',
            code='no_playable_member',
            hint='Archive should contain a ROM with a known extension (e.g. .nes, .sfc, .gba).',
        )
    chosen = choose_rom_member(members, platform=platform, preferred_member=member)
    safe_name = _safe_basename(chosen)
    dest = os.path.join(cache_dir, safe_name)
    if os.path.isfile(dest) and os.path.getsize(dest) > 0:
        return dest

    targets = [chosen]
    if _member_ext(chosen) == '.cue':
        folder = str(Path(chosen).parent).replace('\\', '/')
        if folder == '.':
            folder = ''
        prefix = f'{folder}/' if folder else ''
        for name, _ in members:
            if name == chosen:
                continue
            if _member_ext(name) not in CUE_COMPANION_EXTENSIONS:
                continue
            norm = name.replace('\\', '/')
            if folder and not norm.startswith(prefix):
                continue
            targets.append(name)

    try:
        with py7zr.SevenZipFile(archive_path, mode='r') as archive:
            archive.extract(targets=targets, path=cache_dir)
    except Bad7zFile as exc:
        raise ArchiveRomError(
            'Invalid or corrupt 7z archive',
            status_code=400,
            code='corrupt_archive',
        ) from exc

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
    for companion_name in targets[1:]:
        companion_src = os.path.join(cache_dir, companion_name)
        companion_dest = os.path.join(cache_dir, Path(companion_name).name)
        if os.path.isfile(companion_src) and companion_src != companion_dest:
            os.replace(companion_src, companion_dest)
    if not os.path.isfile(dest):
        raise ArchiveRomError(
            'Failed to extract ROM from 7z archive',
            code='extract_failed',
        )
    return dest


def extract_rom_from_rar(
    archive_path: str,
    cache_dir: str,
    *,
    member: str | None = None,
    platform: str | None = None,
) -> str:
    """
    Extract one ROM from a .rar archive when rarfile + an unrar tool are available.
    """
    try:
        import rarfile
    except ImportError as exc:
        raise ArchiveRomError(
            '.rar support requires the optional rarfile package and an unrar tool',
            status_code=415,
            code='missing_dependency',
            hint='Install rarfile and an unrar/bsdtar binary on the host.',
        ) from exc

    os.makedirs(cache_dir, exist_ok=True)
    try:
        with rarfile.RarFile(archive_path) as archive:
            members = [
                (info.filename, int(getattr(info, 'file_size', 0) or 0))
                for info in archive.infolist()
                if not info.is_dir() and _is_rom_name(info.filename)
            ]
            if not members:
                raise ArchiveRomError(
                    'No playable ROM files found inside rar archive',
                    code='no_playable_member',
                    hint='Archive should contain a ROM with a known extension (e.g. .nes, .sfc, .gba).',
                )
            chosen = choose_rom_member(members, platform=platform, preferred_member=member)
            safe_name = _safe_basename(chosen)
            dest = os.path.join(cache_dir, safe_name)
            if os.path.isfile(dest) and os.path.getsize(dest) > 0:
                return dest
            with archive.open(chosen) as src, open(dest, 'wb') as out:
                while True:
                    chunk = src.read(1024 * 1024)
                    if not chunk:
                        break
                    out.write(chunk)
            if _member_ext(chosen) == '.cue':
                folder = str(Path(chosen).parent).replace('\\', '/')
                if folder == '.':
                    folder = ''
                prefix = f'{folder}/' if folder else ''
                for name, _ in members:
                    if name == chosen or _member_ext(name) not in CUE_COMPANION_EXTENSIONS:
                        continue
                    norm = name.replace('\\', '/')
                    if folder and not norm.startswith(prefix):
                        continue
                    companion_dest = os.path.join(cache_dir, Path(name).name)
                    if os.path.isfile(companion_dest) and os.path.getsize(companion_dest) > 0:
                        continue
                    with archive.open(name) as src, open(companion_dest, 'wb') as out:
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
            code='missing_dependency',
            hint='Install an unrar or bsdtar binary and ensure rarfile can find it.',
        ) from exc


def extract_rom_from_gz(gz_path: str, cache_dir: str) -> str:
    """Gunzip a single-file ROM wrapper (e.g. Adventure.nes.gz) into cache_dir."""
    inner_name = Path(gz_path).stem
    if inner_name.lower().endswith('.tar') or not _is_rom_name(inner_name):
        raise ArchiveRomError(
            '.gz must wrap a single ROM file (e.g. game.nes.gz); .tar.gz is not supported',
            status_code=415,
            code='unsupported_format',
            hint='Unzip/repack as .zip/.7z/.rar with a ROM inside, or store the raw ROM.',
        )

    os.makedirs(cache_dir, exist_ok=True)
    safe_name = _safe_basename(inner_name)
    dest = os.path.join(cache_dir, safe_name)
    if os.path.isfile(dest) and os.path.getsize(dest) > 0:
        return dest

    try:
        with gzip.open(gz_path, 'rb') as src, open(dest, 'wb') as out:
            while True:
                chunk = src.read(1024 * 1024)
                if not chunk:
                    break
                out.write(chunk)
    except OSError as exc:
        raise ArchiveRomError(
            'Invalid or corrupt gzip ROM',
            code='corrupt_archive',
        ) from exc

    if not os.path.isfile(dest) or os.path.getsize(dest) == 0:
        raise ArchiveRomError(
            'Failed to extract ROM from gzip',
            code='extract_failed',
        )
    return dest


def resolve_playable_rom_path(
    source_path: str,
    *,
    cache_dir: str,
    platform: str | None = None,
) -> tuple[str, str]:
    """
    Return (absolute_file_path, filename) suitable for WebRetro streaming.

    Supports plain ROM files, .zip (including nested zip), optional .7z (py7zr),
    optional .rar (rarfile), and single-file .gz ROM wrappers.
    """
    if not source_path or not os.path.exists(source_path):
        raise ArchiveRomError(
            'ROM path not found',
            status_code=404,
            code='path_not_found',
        )

    path = os.path.abspath(source_path)
    if os.path.isfile(path):
        ext = Path(path).suffix.lower()
        if ext in UNSUPPORTED_ARCHIVE_EXTENSIONS:
            raise ArchiveRomError(
                f'{ext} archives are not supported — use .zip, .7z, .rar, .gz (ROM.gz), or a raw ROM',
                status_code=415,
                code='unsupported_format',
            )
        if ext == '.zip':
            extracted = extract_rom_from_zip(path, cache_dir, platform=platform)
            return extracted, os.path.basename(extracted)
        if ext == '.7z':
            extracted = extract_rom_from_7z(path, cache_dir, platform=platform)
            return extracted, os.path.basename(extracted)
        if ext == '.rar':
            extracted = extract_rom_from_rar(path, cache_dir, platform=platform)
            return extracted, os.path.basename(extracted)
        if ext in GZIP_EXTENSIONS:
            extracted = extract_rom_from_gz(path, cache_dir)
            return extracted, os.path.basename(extracted)
        return path, os.path.basename(path)

    if os.path.isdir(path):
        archives = [
            os.path.join(path, name)
            for name in os.listdir(path)
            if Path(name).suffix.lower() in (ARCHIVE_EXTENSIONS | GZIP_EXTENSIONS)
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
            return resolve_playable_rom_path(archives[0], cache_dir=cache_dir, platform=platform)
        if roms:
            sized = [(p, os.path.getsize(p)) for p in roms]
            chosen_path = choose_rom_member(
                [(os.path.basename(p), size) for p, size in sized],
                platform=platform,
            )
            for full, _ in sized:
                if os.path.basename(full) == chosen_path:
                    return full, os.path.basename(full)
            chosen = sorted(roms)[0]
            return chosen, os.path.basename(chosen)
        if archives:
            raise ArchiveRomError(
                'Folder has multiple archives — ambiguous for WebRetro play',
                status_code=400,
                code='ambiguous_folder',
                hint='Keep one archive or one ROM in the game folder for browser play.',
            )
        raise ArchiveRomError(
            'Folder has no single archive/ROM suitable for WebRetro play',
            status_code=400,
            code='ambiguous_folder',
            hint='Place one .zip/.7z/.rar/.gz or a raw ROM in the game folder.',
        )

    raise ArchiveRomError(
        'Unsupported ROM path type',
        status_code=400,
        code='unsupported_format',
    )
