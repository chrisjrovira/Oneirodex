"""Propose candidate leaf libraries under a console/tree root (propose-only).

Never creates Library rows. Implements the many-leaf model from
docs/strategy/console-gaming-libraries.md — never suggests mega-libs on
``_console-gaming`` or family parents (NINTENDO / Sega / Sony / ATARI / …).
"""

from __future__ import annotations

import os
import re
from typing import Any

from gametheca.platform import LibraryPlatform
from gametheca.utils.functions import DEFAULT_SKIP_DIR_GLOBS
from gametheca.utils.gamenames import LETTER_BUCKET_RE, should_skip_scan_dir

# Family / tree roots that must never appear as library folder candidates.
FAMILY_PARENT_NAMES = frozenset({
    '_console-gaming',
    'console-gaming',
    'nintendo',
    'sega',
    'sony',
    'atari',
    # Not 'mame': the household MAME folder is a zip dump leaf (+ one emu
    # build dir), not a family with platform children.
    'arcade',
    'neo geo',
    'neogeo',
    # Not 'pc engine': this household (and many No-Intro trees) keep HuCard
    # dumps in a folder literally named PC Engine. Treating that as a family
    # parent skipped the leaf. TurboGrafx-16 / CD / SuperGrafx / PC-FX sit
    # beside it as their own leaves.
})

# Letter-bucket PC lane. Same token is a scan-root skip glob so a library
# pointed too high does not treat `_pc` as a game — propose still wants it
# as the PCWIN library when the operator scans the games root.
_PC_LANE_NAMES = frozenset({'_pc'})

# Prefer nested dump leaf under these parents when present.
NESTED_DUMP_DIR_NAMES = frozenset({
    'roms',
    'rom',
    'isos',
    'iso',
    'games',
    'dumps',
    'dump',
})

# Extensions that look like ROM/disc dumps (files-mode signal).
_ROM_FILE_EXTS = frozenset({
    'nes', 'sfc', 'smc', 'fig', 'gb', 'gbc', 'gba', 'nds', '3ds', 'cia',
    'n64', 'z64', 'v64', 'gcm', 'iso', 'ciso', 'wbfs', 'rvz', 'wia',
    'nsp', 'xci', 'nsz', 'xcz',
    'md', 'gen', 'smd', 'sms', 'gg', '32x', 'cue', 'bin', 'chd', 'pbp',
    'cso', 'img', 'raw', 'cdi', 'gdi', 'toc', 'nrg',
    'a26', 'a52', 'a78', 'lnx', 'j64', 'jag',
    'pce', 'sgx', 'ngp', 'ngc', 'ws', 'wsc',
    'zip', '7z', 'rar', 'rom', 'adf', 'd64', 'tap',
})

# (compiled regex, LibraryPlatform.name) — first match wins; order matters.
# More specific leaves before family-ish substrings (32X before Genesis, SNES
# before NES, Pocket Color before Pocket, TurboGrafx CD before TurboGrafx-16).
_NIN_TYPO = r'nin(?:ten|ent)do'
_PLATFORM_NAME_RULES: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r'neo\s*geo\s*cd', re.I), 'NEOGEO_CD'),
    (re.compile(r'neo\s*geo\s*pocket\s*color', re.I), 'NGPC'),
    (re.compile(r'neo\s*geo\s*pocket', re.I), 'NGP'),
    (re.compile(r'neo\s*geo', re.I), 'NEOGEO'),
    (re.compile(r'\barcade\b', re.I), 'ARCADE'),
    # AAE (Arcade Architecture Emulator) — vector-arcade set folders, not a family.
    (re.compile(r'^\s*aae\s*$', re.I), 'ARCADE'),
    (re.compile(r'^\s*mame\s*$', re.I), 'ARCADE'),
    (re.compile(r'\bswitch\b', re.I), 'SWITCH'),
    (re.compile(rf'super\s*{_NIN_TYPO}|\bsnes\b', re.I), 'SNES'),
    (re.compile(rf'{_NIN_TYPO}\s*entertainment|^\s*nes\s*$', re.I), 'NES'),
    (re.compile(r'nintendo\s*64|\bn64\b', re.I), 'N64'),
    (re.compile(r'game\s*boy\s*advance|\bgba\b', re.I), 'GBA'),
    (re.compile(r'game\s*boy\s*color|\bgbc\b', re.I), 'GBC'),
    (re.compile(r'game\s*boy|\bgb\b', re.I), 'GB'),
    (re.compile(r'nintendo\s*3ds|\b3ds\b', re.I), 'N3DS'),
    (re.compile(r'nintendo\s*ds|\bnds\b', re.I), 'NDS'),
    (re.compile(r'game\s*cube|\bngc\b', re.I), 'NGC'),
    (re.compile(r'\bwii\b', re.I), 'WII'),
    (re.compile(r'virtual\s*boy|\bvb\b', re.I), 'VB'),
    (re.compile(r'\b32x\b', re.I), 'SEGA_32X'),
    (re.compile(r'sg-?1000', re.I), 'SEGA_SG1000'),
    (re.compile(r'mega\s*drive|genesis|\bsega\s*md\b', re.I), 'SEGA_MD'),
    (re.compile(r'master\s*system|\bsega\s*ms\b|\bsms\b', re.I), 'SEGA_MS'),
    (re.compile(r'sega\s*cd|mega[- ]?cd', re.I), 'SEGA_CD'),
    (re.compile(r'game\s*gear|\bsega\s*gg\b', re.I), 'SEGA_GG'),
    (re.compile(r'\bsaturn\b', re.I), 'SEGA_SATURN'),
    (re.compile(r'\bdreamcast\b', re.I), 'SEGA_DC'),
    (re.compile(r'\bps\s*vita\b|\bpsvita\b', re.I), 'PSVITA'),
    (re.compile(r'\bpsp\b', re.I), 'PSP'),
    (re.compile(r'\bps5\b|playstation\s*5', re.I), 'PS5'),
    (re.compile(r'\bps4\b|playstation\s*4', re.I), 'PS4'),
    (re.compile(r'\bps3\b|playstation\s*3', re.I), 'PS3'),
    (re.compile(r'\bps2\b|playstation\s*2', re.I), 'PS2'),
    (re.compile(r'playstation|\bpsx\b|\bps1\b', re.I), 'PSX'),
    (re.compile(r'atari\s*2600|\b2600\b', re.I), 'ATARI_2600'),
    (re.compile(r'atari\s*5200|\b5200\b', re.I), 'ATARI_5200'),
    (re.compile(r'atari\s*7800|\b7800\b', re.I), 'ATARI_7800'),
    (re.compile(r'\blynx\b', re.I), 'LYNX'),
    (re.compile(r'\bjaguar\b', re.I), 'JAGUAR'),
    (re.compile(r'super\s*grafx', re.I), 'SUPERGRAFX'),
    (re.compile(r'turbo\s*grafx\s*cd|pc[- ]?engine\s*cd|\btg[- ]?cd\b', re.I), 'PCE_CD'),
    (re.compile(r'pc[- ]?engine|turbo\s*grafx|\btg[- ]?16\b', re.I), 'PCE'),
    (re.compile(r'\bpc[- ]?fx\b', re.I), 'PCFX'),
    (re.compile(r'xbox\s*series|\bxsx\b', re.I), 'XSX'),
    (re.compile(r'xbox\s*one|\bxone\b', re.I), 'XONE'),
    (re.compile(r'xbox\s*360|\bx360\b', re.I), 'X360'),
    (re.compile(r'\bxbox\b', re.I), 'XBOX'),
    (re.compile(r'wonder\s*swan|\bws\b', re.I), 'WS'),
    (re.compile(r'coleco', re.I), 'COLECO'),
    (re.compile(r'\b3do\b', re.I), 'THREEDO'),
    (re.compile(r'vectrex', re.I), 'VECTREX'),
    (re.compile(r'intellivision', re.I), 'INTV'),
    (re.compile(r'commodore\s*amiga|\bamiga\b', re.I), 'AMIGA'),
    (re.compile(r'channel\s*f|fairchild', re.I), 'CHAF'),
    (re.compile(r'odyssey\s*2|\bo2em\b', re.I), 'O2EM'),
    (re.compile(r'arcadia', re.I), 'ARCADIA'),
    (re.compile(r'astrocade', re.I), 'ASTROCADE'),
    (re.compile(r'creativision', re.I), 'CREATIVISION'),
    (re.compile(r'adventure\s*vision|adventurevision', re.I), 'ADVISION'),
    (re.compile(r'studio\s*ii|\bstudio\s*2\b', re.I), 'STUDIO2'),
    (re.compile(r'action\s*max', re.I), 'ACTIONMAX'),
    (re.compile(r'\bdaphne\b', re.I), 'DAPHNE'),
    (re.compile(r'pinball', re.I), 'PINBALL'),
    (re.compile(r'supervision', re.I), 'SUPERVISION'),
    (re.compile(r'gx4000', re.I), 'GX4000'),
)

_MAX_WALK_DEPTH = 5
_SAMPLE_LIMIT = 80


def is_family_parent_name(name: str | None) -> bool:
    """True when basename is a family / console-tree parent (never a library root)."""
    if not name:
        return False
    return name.strip().casefold() in FAMILY_PARENT_NAMES


def infer_platform_from_name(name: str | None) -> str | None:
    """Map a folder basename to LibraryPlatform.name, or None if unknown."""
    if not name:
        return None
    text = name.strip()
    if not text:
        return None
    for pattern, platform_name in _PLATFORM_NAME_RULES:
        if pattern.search(text):
            try:
                LibraryPlatform[platform_name]
            except KeyError:
                continue
            return platform_name
    return None


def _list_children(path: str) -> list[str]:
    try:
        return sorted(os.listdir(path), key=str.lower)
    except OSError:
        return []


def _child_path(parent: str, name: str) -> str:
    return os.path.join(parent, name)


def _find_nested_dump_dir(path: str) -> str | None:
    """Return first nested ROMs/ISO/games dump child path, if any."""
    for name in _list_children(path):
        full = _child_path(path, name)
        if not os.path.isdir(full):
            continue
        if name.casefold() in NESTED_DUMP_DIR_NAMES:
            return full
    return None


def _sample_layout(path: str) -> dict[str, Any]:
    """Inspect immediate children to choose scan_mode / scan_depth."""
    names = _list_children(path)[:_SAMPLE_LIMIT]
    dirs: list[str] = []
    files: list[str] = []
    rom_files = 0
    letter_buckets = 0
    for name in names:
        full = _child_path(path, name)
        if os.path.isdir(full):
            dirs.append(name)
            if LETTER_BUCKET_RE.match(name):
                letter_buckets += 1
        elif os.path.isfile(full):
            files.append(name)
            ext = os.path.splitext(name)[1].lstrip('.').casefold()
            if ext in _ROM_FILE_EXTS:
                rom_files += 1

    dir_count = len(dirs)
    file_count = len(files)
    # Letter buckets under the leaf → folders / depth 2 (same as PC).
    if letter_buckets >= 3 and letter_buckets >= max(1, dir_count // 2):
        return {
            'scan_mode': 'folders',
            'scan_depth': 2,
            'reason': 'letter-bucket layout (_a…_z); folders scan_depth=2',
            'dir_count': dir_count,
            'file_count': file_count,
            'rom_files': rom_files,
            'letter_buckets': letter_buckets,
        }
    # Title / set dirs dominate → folders / 1.
    if dir_count > 0 and dir_count >= max(1, rom_files):
        return {
            'scan_mode': 'folders',
            'scan_depth': 1,
            'reason': 'title/set directories dominate; folders scan_depth=1',
            'dir_count': dir_count,
            'file_count': file_count,
            'rom_files': rom_files,
            'letter_buckets': letter_buckets,
        }
    # Flat ROM/disc dumps → files / 1.
    if rom_files > 0 and rom_files >= dir_count:
        return {
            'scan_mode': 'files',
            'scan_depth': 1,
            'reason': 'flat ROM/disc files; files scan_depth=1',
            'dir_count': dir_count,
            'file_count': file_count,
            'rom_files': rom_files,
            'letter_buckets': letter_buckets,
        }
    # Empty or ambiguous — still folders/1 so ops can inspect.
    return {
        'scan_mode': 'folders',
        'scan_depth': 1,
        'reason': 'sparse/ambiguous leaf; default folders scan_depth=1',
        'dir_count': dir_count,
        'file_count': file_count,
        'rom_files': rom_files,
        'letter_buckets': letter_buckets,
    }


def _suggested_name(path: str, platform: str | None) -> str:
    base = os.path.basename(path.rstrip('\\/')) or path
    if base.casefold() in NESTED_DUMP_DIR_NAMES:
        parent = os.path.basename(os.path.dirname(path.rstrip('\\/')))
        if parent:
            return f'{parent} {base}'
    if platform == 'SWITCH':
        return 'Nintendo Switch'
    if platform == 'PSX':
        return 'PlayStation (PSX)'
    if platform == 'PSP':
        return 'Sony PSP'
    if platform == 'NEOGEO':
        return 'Neo Geo AES'
    if platform == 'ARCADE':
        return 'Arcade'
    return base


def _candidate(
    path: str,
    *,
    platform: str | None,
    reason: str,
    layout: dict[str, Any] | None = None,
) -> dict[str, Any]:
    layout = layout or _sample_layout(path)
    plat = platform or 'OTHER'
    detail = reason
    if layout.get('reason'):
        detail = f"{reason}; {layout['reason']}"
    return {
        'path': os.path.normpath(path),
        'suggested_name': _suggested_name(path, plat if plat != 'OTHER' else None),
        'platform': plat,
        'scan_mode': layout['scan_mode'],
        'scan_depth': int(layout['scan_depth']),
        'reason': detail,
    }


def _platform_for_leaf(path: str, basename: str) -> str | None:
    """Infer platform from leaf name, or parent when leaf is ROMs/… dump dir."""
    plat = infer_platform_from_name(basename)
    if plat:
        return plat
    if basename.casefold() in NESTED_DUMP_DIR_NAMES:
        parent = os.path.basename(os.path.dirname(path.rstrip('\\/')))
        return infer_platform_from_name(parent)
    return None


def _looks_like_platform_leaf(name: str) -> bool:
    return infer_platform_from_name(name) is not None


def _looks_like_pc_lane(path: str, basename: str) -> bool:
    """True when this folder is the `_pc` letter-bucket library root."""
    if basename.casefold() not in _PC_LANE_NAMES:
        return False
    layout = _sample_layout(path)
    return int(layout.get('letter_buckets') or 0) >= 3


def _looks_like_games_scan_root(path: str) -> bool:
    """True when children include the household console and/or PC lanes.

    A folder named ``games`` is also a dump-leaf token. The household scan
    root must walk, not propose itself as one ROMs-style library.
    """
    names = {name.casefold() for name in _list_children(path)}
    return bool(names & {'_console-gaming', 'console-gaming', '_pc'})


def propose_leaf_libraries(
    root_path: str,
    *,
    skip_dir_patterns=None,
    max_depth: int = _MAX_WALK_DEPTH,
) -> list[dict[str, Any]]:
    """Scan ``root_path`` and return propose-only leaf library candidates.

    Never auto-creates libraries. Rejects family parents and emu/FE roots as
    candidates; still discovers nested ``ROMs`` under portable emu trees.
    """
    if not root_path or not isinstance(root_path, str):
        return []
    root = os.path.abspath(root_path)
    if not os.path.isdir(root):
        return []

    patterns = list(skip_dir_patterns) if skip_dir_patterns is not None else list(DEFAULT_SKIP_DIR_GLOBS)
    seen: set[str] = set()
    candidates: list[dict[str, Any]] = []

    def add(path: str, *, platform: str | None, reason: str) -> None:
        key = os.path.normcase(os.path.normpath(path))
        if key in seen:
            return
        # Hard reject family / tree roots even if called directly.
        base = os.path.basename(path.rstrip('\\/'))
        if is_family_parent_name(base):
            return
        # A recognised dump name is the thing this module exists to propose, so
        # the scan-time skip list must not veto it. 'ROMs' is in
        # DEFAULT_SKIP_DIR_GLOBS so that a library pointed too high does not
        # treat it as a game folder — the opposite job from proposing it as a
        # library of its own, which every dump-leaf branch below relies on.
        # `_pc` is the same dual-use token: skip-dir during a game listing,
        # propose-as-library when walking the games root.
        if (
            base.casefold() not in NESTED_DUMP_DIR_NAMES
            and base.casefold() not in _PC_LANE_NAMES
            and should_skip_scan_dir(base, patterns)
        ):
            return
        seen.add(key)
        candidates.append(_candidate(path, platform=platform, reason=reason))

    def walk(path: str, depth: int) -> None:
        if depth > max_depth:
            return
        basename = os.path.basename(path.rstrip('\\/')) or path

        # Family / mega-lib parents: never propose; always recurse.
        # Must run before skip-dir: `_console-gaming` is BOTH a family parent
        # and a scan-root skip glob. Propose-from-games-root has to walk it.
        if is_family_parent_name(basename):
            for name in _list_children(path):
                child = _child_path(path, name)
                if os.path.isdir(child):
                    walk(child, depth + 1)
            return

        # PC letter-bucket lane: propose as PCWIN. Same skip-dir name is a
        # lane leak when scanning a library pointed too high — here it is
        # the library we want to suggest.
        if _looks_like_pc_lane(path, basename):
            add(
                path,
                platform='PCWIN',
                reason=f'PC letter-bucket lane ({basename})',
            )
            return

        # Emulator / FE / tool install: never propose self; peek for nested dumps.
        # Dump names are exempt for the same reason as in `add`: otherwise a
        # directory literally called ROMs is treated as an emu install and
        # searched for a dump *inside* it, which makes the dump-leaf branch
        # below unreachable for the most common dump name there is.
        if (
            depth > 0
            and basename.casefold() not in NESTED_DUMP_DIR_NAMES
            and basename.casefold() not in _PC_LANE_NAMES
            and should_skip_scan_dir(basename, patterns)
        ):
            dump = _find_nested_dump_dir(path)
            if dump:
                plat = _platform_for_leaf(dump, os.path.basename(dump))
                # Prefer parent folder name for platform when dump is generic "ROMs".
                if not plat:
                    plat = infer_platform_from_name(basename)
                add(
                    dump,
                    platform=plat,
                    reason=f'nested dump under emu/tool install ({basename})',
                )
            return

        # Nested ROMs (or iso/games) dump leaf.
        if basename.casefold() in NESTED_DUMP_DIR_NAMES and depth > 0:
            plat = _platform_for_leaf(path, basename)
            add(path, platform=plat, reason=f'dump leaf ({basename})')
            return

        # Platform-named folder: prefer nested ROMs when present.
        if _looks_like_platform_leaf(basename):
            dump = _find_nested_dump_dir(path)
            if dump:
                plat = _platform_for_leaf(dump, os.path.basename(dump)) or infer_platform_from_name(basename)
                add(
                    dump,
                    platform=plat,
                    reason=f'platform leaf with nested dump ({basename}/{os.path.basename(dump)})',
                )
            else:
                plat = infer_platform_from_name(basename)
                add(path, platform=plat, reason=f'platform leaf ({basename})')
            # Still walk non-dump children in case of mixed trees (rare).
            for name in _list_children(path):
                child = _child_path(path, name)
                if not os.path.isdir(child):
                    continue
                if name.casefold() in NESTED_DUMP_DIR_NAMES:
                    continue
                if should_skip_scan_dir(name, patterns) or is_family_parent_name(name):
                    walk(child, depth + 1)
                    continue
                # Sibling platform leaves under a platform folder are unusual; walk.
                if _looks_like_platform_leaf(name):
                    walk(child, depth + 1)
            return

        # Generic directory under root: recurse looking for leaves.
        for name in _list_children(path):
            child = _child_path(path, name)
            if os.path.isdir(child):
                walk(child, depth + 1)

    # If the operator points directly at a platform leaf (not a family root),
    # still propose it — unless it is a rejected family / emu name.
    root_base = os.path.basename(root.rstrip('\\/'))
    if _looks_like_games_scan_root(root) or is_family_parent_name(root_base):
        walk(root, 0)
    elif (
        not should_skip_scan_dir(root_base, patterns)
        and (_looks_like_platform_leaf(root_base) or root_base.casefold() in NESTED_DUMP_DIR_NAMES)
    ):
        dump = _find_nested_dump_dir(root) if _looks_like_platform_leaf(root_base) else None
        if dump:
            plat = _platform_for_leaf(dump, os.path.basename(dump)) or infer_platform_from_name(root_base)
            add(dump, platform=plat, reason=f'root platform with nested dump ({root_base})')
        else:
            plat = _platform_for_leaf(root, root_base)
            add(root, platform=plat, reason=f'root is a leaf ({root_base})')
    else:
        walk(root, 0)

    candidates.sort(key=lambda c: c['path'].casefold())
    return candidates
