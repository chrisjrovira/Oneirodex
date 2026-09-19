"""Resolve a playable ROM file path, including zip/7z/rar/gz archives for WebRetro.

The v11 cycle (H-D.4) moved the extension tables to ``rom_archive_types``,
member selection to ``rom_archive_select`` and the zip / gzip / bundle paths
to ``rom_archive_zip`` as pure moves. The 7z / rar extractor shims and
``resolve_playable_rom_path`` stay here; every name callers import still
resolves here.
"""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

# H-D.4 split: these moved to sibling modules as pure moves. Public names are
# re-exported here because callers and tests import them from this module.
from oneirodex.utils.rom_archive_select import (  # noqa: F401
    choose_rom_member,
    path_supports_browser_extract,
    _cue_companion_targets,
    _is_rom_name,
    _safe_basename,
)
from oneirodex.utils.rom_archive_types import (  # noqa: F401
    ARCHIVE_EXTENSIONS,
    ArchiveRomError,
    CUE_COMPANION_EXTENSIONS,
    GZIP_EXTENSIONS,
    MAX_NEST_DEPTH,
    MIN_ROM_BYTES_PREFERRED,
    PLATFORM_DUMP_SUFFIXES,
    PLATFORM_ROM_EXTENSIONS,
    ROM_EXTENSIONS,
    UNSUPPORTED_ARCHIVE_EXTENSIONS,
    _EXTRACTOR_BINARIES,
    _MISSING_EXTRACTOR_HINT,
)
from oneirodex.utils.rom_archive_zip import (  # noqa: F401
    bundle_playable_rom_zip,
    extract_rom_from_gz,
    extract_rom_from_zip,
    _list_roms_with_sizes_in_zip,
)


def find_archive_extractors() -> dict[str, str]:
    """Return ``{tool_key: absolute_path}`` for ``7z`` / ``7za`` / ``bsdtar`` / ``unrar`` on PATH."""
    found: dict[str, str] = {}
    for key, binary in _EXTRACTOR_BINARIES:
        path = shutil.which(binary)
        if path:
            found[key] = path
    return found


def _missing_extractor_error(*, archive_kind: str) -> ArchiveRomError:
    return ArchiveRomError(
        f'Failed to extract {archive_kind} archive — no extractor tool found',
        status_code=415,
        code='missing_extractor',
        hint=_MISSING_EXTRACTOR_HINT,
    )


def _configure_rarfile_tools(rarfile_mod) -> list[str]:
    """Point rarfile at available ``7z`` / ``bsdtar`` / ``unrar`` and force tool rediscovery."""
    found = find_archive_extractors()
    if '7z' in found:
        rarfile_mod.SEVENZIP_TOOL = found['7z']
    if '7za' in found:
        rarfile_mod.SEVENZIP2_TOOL = found['7za']
    if 'bsdtar' in found:
        rarfile_mod.BSDTAR_TOOL = found['bsdtar']
    if 'unrar' in found:
        rarfile_mod.UNRAR_TOOL = found['unrar']

    has_unrar = 'unrar' in found
    has_7z = '7z' in found
    has_7za = '7za' in found
    has_bsdtar = 'bsdtar' in found
    if not (has_unrar or has_7z or has_7za or has_bsdtar):
        return []

    # Prefer available tools; skip unrar when absent so 7z/bsdtar are tried first.
    rarfile_mod.tool_setup(
        unrar=has_unrar,
        unar=False,
        sevenzip=has_7z,
        sevenzip2=has_7za,
        bsdtar=has_bsdtar,
        force=True,
    )
    return list(found.keys())


def _run_extractor(cmdline: list[str], *, timeout: int = 120) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmdline,
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )


def _list_roms_via_7z(archive_path: str, seven_z: str) -> list[tuple[str, int]]:
    """List ROM members via ``7z l -slt`` (works for .7z and many .rar)."""
    result = _run_extractor([seven_z, 'l', '-slt', '-ba', archive_path])
    if result.returncode != 0:
        raise ArchiveRomError(
            'Failed to list archive members with 7z',
            status_code=415,
            code='extract_failed',
            hint=_MISSING_EXTRACTOR_HINT if not find_archive_extractors() else (
                'Archive may be corrupt or password-protected; prefer a .zip ROM.'
            ),
        )
    members: list[tuple[str, int]] = []
    path: str | None = None
    size = 0
    is_dir = False
    for line in (result.stdout or '').splitlines():
        if line.startswith('Path = '):
            if path and not is_dir and _is_rom_name(path):
                members.append((path.replace('\\', '/'), size))
            path = line[7:].strip()
            size = 0
            is_dir = False
        elif line.startswith('Size = '):
            try:
                size = int(line[7:].strip() or 0)
            except ValueError:
                size = 0
        elif line.startswith('Attributes = '):
            attrs = line[13:].strip().upper()
            is_dir = 'D' in attrs
        elif line == '' and path:
            if not is_dir and _is_rom_name(path):
                members.append((path.replace('\\', '/'), size))
            path = None
            size = 0
            is_dir = False
    if path and not is_dir and _is_rom_name(path):
        members.append((path.replace('\\', '/'), size))
    return members


def _list_roms_via_bsdtar(archive_path: str, bsdtar: str) -> list[tuple[str, int]]:
    result = _run_extractor([bsdtar, '-tf', archive_path])
    if result.returncode != 0:
        raise ArchiveRomError(
            'Failed to list archive members with bsdtar',
            status_code=415,
            code='extract_failed',
            hint='Archive may be corrupt or use an unsupported RAR variant; prefer .zip or install 7z.',
        )
    members: list[tuple[str, int]] = []
    for line in (result.stdout or '').splitlines():
        name = line.strip().replace('\\', '/')
        if not name or name.endswith('/'):
            continue
        if _is_rom_name(name):
            members.append((name, 0))
    return members


def _extract_members_via_7z(
    archive_path: str,
    cache_dir: str,
    members: list[str],
    seven_z: str,
) -> None:
    # Extract specific members to cache_dir (flattened via -y).
    cmdline = [seven_z, 'e', '-y', f'-o{cache_dir}', archive_path, '--', *members]
    result = _run_extractor(cmdline)
    if result.returncode != 0:
        raise ArchiveRomError(
            'Failed to extract ROM with 7z',
            status_code=415,
            code='extract_failed',
            hint=(result.stderr or result.stdout or '7z extract failed').strip()[:240]
            or 'Prefer re-packing as .zip.',
        )


def _extract_members_via_bsdtar(
    archive_path: str,
    cache_dir: str,
    members: list[str],
    bsdtar: str,
) -> None:
    cmdline = [bsdtar, '-xf', archive_path, '-C', cache_dir, '--', *members]
    result = _run_extractor(cmdline)
    if result.returncode != 0:
        raise ArchiveRomError(
            'Failed to extract ROM with bsdtar',
            status_code=415,
            code='extract_failed',
            hint=(result.stderr or result.stdout or 'bsdtar extract failed').strip()[:240]
            or 'Prefer re-packing as .zip or use 7z.',
        )
    # Flatten nested paths into cache_dir basenames.
    for member in members:
        src = os.path.join(cache_dir, member.replace('/', os.sep))
        dest = os.path.join(cache_dir, Path(member).name)
        if os.path.isfile(src) and src != dest:
            parent = os.path.dirname(src)
            os.replace(src, dest)
            while parent.startswith(cache_dir) and parent != cache_dir:
                try:
                    os.rmdir(parent)
                except OSError:
                    break
                parent = os.path.dirname(parent)


def _extract_archive_via_cli(
    archive_path: str,
    cache_dir: str,
    *,
    member: str | None = None,
    platform: str | None = None,
    archive_kind: str = 'archive',
) -> str:
    """Extract one ROM (and cue companions) using host ``7z`` or ``bsdtar``."""
    found = find_archive_extractors()
    seven = found.get('7z') or found.get('7za')
    bsdtar = found.get('bsdtar')
    if not seven and not bsdtar:
        raise _missing_extractor_error(archive_kind=archive_kind)

    last_error: ArchiveRomError | None = None
    members: list[tuple[str, int]] = []
    tool_name = ''
    if seven:
        try:
            members = _list_roms_via_7z(archive_path, seven)
            tool_name = '7z'
        except ArchiveRomError as exc:
            last_error = exc
    if not members and bsdtar:
        try:
            members = _list_roms_via_bsdtar(archive_path, bsdtar)
            tool_name = 'bsdtar'
        except ArchiveRomError as exc:
            last_error = exc

    if not members:
        if last_error is not None:
            raise last_error
        raise ArchiveRomError(
            f'No playable ROM files found inside {archive_kind} archive',
            code='no_playable_member',
            hint='Archive should contain a ROM with a known extension (e.g. .nes, .sfc, .gba).',
        )

    chosen = choose_rom_member(members, platform=platform, preferred_member=member)
    safe_name = _safe_basename(chosen)
    dest = os.path.join(cache_dir, safe_name)
    if os.path.isfile(dest) and os.path.getsize(dest) > 0:
        return dest

    targets = _cue_companion_targets(members, chosen)
    os.makedirs(cache_dir, exist_ok=True)
    if tool_name == '7z' and seven:
        _extract_members_via_7z(archive_path, cache_dir, targets, seven)
    elif bsdtar:
        _extract_members_via_bsdtar(archive_path, cache_dir, targets, bsdtar)
    else:
        raise _missing_extractor_error(archive_kind=archive_kind)

    # 7z -e already flattens; ensure companions land as basenames.
    for target in targets:
        flat = os.path.join(cache_dir, Path(target).name)
        nested = os.path.join(cache_dir, target.replace('/', os.sep))
        if os.path.isfile(nested) and nested != flat:
            os.replace(nested, flat)

    if not os.path.isfile(dest):
        raise ArchiveRomError(
            f'Failed to extract ROM from {archive_kind} archive',
            code='extract_failed',
            hint='Prefer re-packing as .zip with a single known ROM extension.',
        )
    return dest


def list_roms_in_zip(zip_path: str) -> list[str]:
    return [name for name, _ in _list_roms_with_sizes_in_zip(zip_path)]


def path_is_supported_archive(path: str | Path | None) -> bool:
    """True when path looks like a zip/7z/rar container (existence not required)."""
    if not path:
        return False
    return Path(path).suffix.lower() in ARCHIVE_EXTENSIONS


def list_roms_in_archive(archive_path: str) -> list[tuple[str, int]]:
    """
    List playable ROM members ``(name, size)`` inside zip/7z/rar.

    Raises ``ArchiveRomError`` on corrupt / unsupported archives. Returns [] when
    the archive opens but contains no ROM-like members.
    """
    path = os.path.abspath(archive_path)
    if not os.path.isfile(path):
        raise ArchiveRomError(
            'Archive path not found',
            status_code=404,
            code='path_not_found',
        )
    ext = Path(path).suffix.lower()
    if ext == '.zip':
        return _list_roms_with_sizes_in_zip(path)
    if ext == '.7z':
        return _list_roms_in_7z(path)
    if ext == '.rar':
        return _list_roms_in_rar(path)
    raise ArchiveRomError(
        f'{ext or "unknown"} archives are not supported — use .zip, .7z, or .rar',
        status_code=415,
        code='unsupported_format',
    )


def _list_roms_in_rar(archive_path: str) -> list[tuple[str, int]]:
    tools = find_archive_extractors()
    has_cli = bool(tools.get('7z') or tools.get('7za') or tools.get('bsdtar') or tools.get('unrar'))
    try:
        import rarfile
    except ImportError:
        seven = tools.get('7z') or tools.get('7za')
        if seven:
            return _list_roms_via_7z(archive_path, seven)
        if tools.get('bsdtar'):
            return _list_roms_via_bsdtar(archive_path, tools['bsdtar'])
        raise ArchiveRomError(
            '.rar support requires rarfile plus an extractor tool (7z/bsdtar/unrar)',
            status_code=415,
            code='missing_extractor',
            hint=_MISSING_EXTRACTOR_HINT,
        )

    configured = _configure_rarfile_tools(rarfile)
    if not configured and not has_cli:
        raise _missing_extractor_error(archive_kind='rar')

    try:
        with rarfile.RarFile(archive_path) as archive:
            return [
                (info.filename, int(getattr(info, 'file_size', 0) or 0))
                for info in archive.infolist()
                if not info.is_dir() and _is_rom_name(info.filename)
            ]
    except ArchiveRomError:
        raise
    except Exception:
        seven = tools.get('7z') or tools.get('7za')
        if seven:
            return _list_roms_via_7z(archive_path, seven)
        if tools.get('bsdtar'):
            return _list_roms_via_bsdtar(archive_path, tools['bsdtar'])
        raise ArchiveRomError(
            'Failed to list rar archive members',
            status_code=415,
            code='extract_failed',
            hint='Prefer re-packing as .zip, or verify the RAR is not password-protected.',
        )


def _list_roms_in_7z(archive_path: str) -> list[tuple[str, int]]:
    try:
        import py7zr
        from py7zr.exceptions import Bad7zFile
    except ImportError:
        found = find_archive_extractors()
        seven = found.get('7z') or found.get('7za')
        if seven:
            return _list_roms_via_7z(archive_path, seven)
        raise ArchiveRomError(
            '.7z support requires py7zr or a host 7z binary',
            status_code=415,
            code='missing_extractor',
            hint=_MISSING_EXTRACTOR_HINT,
        )
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
    except ImportError:
        return _extract_archive_via_cli(
            archive_path,
            cache_dir,
            member=member,
            platform=platform,
            archive_kind='7z',
        )

    os.makedirs(cache_dir, exist_ok=True)
    try:
        members = _list_roms_in_7z(archive_path)
    except ArchiveRomError:
        # py7zr present but list failed oddly — try host 7z before giving up.
        found = find_archive_extractors()
        if found.get('7z') or found.get('7za'):
            return _extract_archive_via_cli(
                archive_path,
                cache_dir,
                member=member,
                platform=platform,
                archive_kind='7z',
            )
        raise
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

    targets = _cue_companion_targets(members, chosen)

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
        # Fall back to host 7z when py7zr wrote nothing useful.
        found = find_archive_extractors()
        if found.get('7z') or found.get('7za'):
            return _extract_archive_via_cli(
                archive_path,
                cache_dir,
                member=member,
                platform=platform,
                archive_kind='7z',
            )
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
    Extract one ROM from a .rar archive.

    Prefers host ``7z`` / ``bsdtar`` (Docker ships both) via rarfile or a direct
    CLI path. Returns ``missing_extractor`` JSON when no tool is available.
    """
    os.makedirs(cache_dir, exist_ok=True)
    tools = find_archive_extractors()
    has_cli = bool(tools.get('7z') or tools.get('7za') or tools.get('bsdtar') or tools.get('unrar'))

    try:
        import rarfile
    except ImportError as exc:
        if has_cli:
            return _extract_archive_via_cli(
                archive_path,
                cache_dir,
                member=member,
                platform=platform,
                archive_kind='rar',
            )
        raise ArchiveRomError(
            '.rar support requires rarfile plus an extractor tool (7z/bsdtar/unrar)',
            status_code=415,
            code='missing_extractor',
            hint=_MISSING_EXTRACTOR_HINT,
        ) from exc

    configured = _configure_rarfile_tools(rarfile)
    if not configured and not has_cli:
        raise _missing_extractor_error(archive_kind='rar')

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
            for companion_name in _cue_companion_targets(members, chosen)[1:]:
                companion_dest = os.path.join(cache_dir, Path(companion_name).name)
                if os.path.isfile(companion_dest) and os.path.getsize(companion_dest) > 0:
                    continue
                with archive.open(companion_name) as src, open(companion_dest, 'wb') as out:
                    while True:
                        chunk = src.read(1024 * 1024)
                        if not chunk:
                            break
                        out.write(chunk)
            return dest
    except ArchiveRomError:
        raise
    except Exception as exc:
        # rarfile.Error / RarCannotExec / OSError — prefer CLI before failing.
        if tools.get('7z') or tools.get('7za') or tools.get('bsdtar'):
            try:
                return _extract_archive_via_cli(
                    archive_path,
                    cache_dir,
                    member=member,
                    platform=platform,
                    archive_kind='rar',
                )
            except ArchiveRomError:
                pass
        if not find_archive_extractors():
            raise _missing_extractor_error(archive_kind='rar') from exc
        raise ArchiveRomError(
            'Failed to read rar archive',
            status_code=415,
            code='extract_failed',
            hint=(
                'A 7z/bsdtar/unrar tool was found but could not open this archive. '
                'Prefer re-packing as .zip, or verify the RAR is not password-protected.'
            ),
        ) from exc


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


