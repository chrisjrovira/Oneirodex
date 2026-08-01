"""Shared ROM name peel patterns (No-Intro / GoodTools) and console file-leaf parser."""

from __future__ import annotations

import os
import re
from typing import Any

from gametheca.platform import LibraryPlatform
from gametheca.utils.game_name_parse import (
    _record_transform,
    inject_franchise_apostrophes,
    normalize_smart_apostrophes,
)

# --- Shared peel regex (single source — imported by set_completion + rom_language) ---

ROM_EXT_RE = re.compile(
    r'\.(?:nes|sfc|smc|n64|z64|v64|gb|gbc|gba|nds|md|gen|sms|gg|'
    r'iso|cue|bin|chd|img|rom|zip|7z|rar)$',
    re.IGNORECASE,
)
DUMP_BRACKETS_RE = re.compile(r'\s*\[[^\]]*\]')
REGION_PAREN_RE = re.compile(
    r'\s*\((?:USA|Europe|Japan|World|UE|JU|EU|JP|U|J|E|Asia|Brazil|Korea|'
    r'Australia|France|Germany|Spain|Italy|Netherlands|Sweden|China|'
    r'Hong Kong|Taiwan|Russia|En,Fr,De|En,Ja)[^)]*\)',
    re.IGNORECASE,
)
REV_PAREN_RE = re.compile(
    r'\s*\((?:Rev\s*[A-Z0-9]+|v?\d+(?:\.\d+)*|Proto|Beta|Sample|Demo|'
    r'Unl|Aftermarket|Pirate|Virtual Console|Switch Online|Wii U Virtual Console|'
    r'GB Compatibility|SGB Enhanced|NTSC|PAL|NTSC-J)[^)]*\)',
    re.IGNORECASE,
)
LANG_LIST_PAREN_RE = re.compile(
    r'\s*\(((?:En|Fr|De|Es|It|Nl|Pt|Ru|Ja|Zh|Ko|Pl|Sv|No|Da|Fi|Hu|Cs|Tr|Ar)'
    r'(?:\s*,\s*(?:En|Fr|De|Es|It|Nl|Pt|Ru|Ja|Zh|Ko|Pl|Sv|No|Da|Fi|Hu|Cs|Tr|Ar))*)\)',
    re.IGNORECASE,
)
REMAINING_SIMPLE_PAREN_RE = re.compile(r'\s*\([^)]{1,40}\)')
MULTI_SPACE_RE = re.compile(r'\s+')

# First region-like parenthetical for rom_language capture (subset of REGION_PAREN tokens).
REGION_CAPTURE_RE = re.compile(
    r'\((USA|Europe|Japan|World|UE|JU|EU|JP|U|J|E|Asia|Brazil|Korea|'
    r'Australia|France|Germany|Spain|Italy|Netherlands|Sweden|China|'
    r'Hong Kong|Taiwan|Russia)(?:[^)]*)\)',
    re.IGNORECASE,
)

# GoodTools / status flags that force propose-only (checked on raw basename).
_PROPOSE_BRACKET_FLAGS_RE = re.compile(r'\[(?:h|T|tr)\]', re.IGNORECASE)
_PROPOSE_STATUS_PAREN_RE = re.compile(
    r'\(\s*(?:Proto|Beta|Demo|Sample|Unl|Aftermarket|Pirate|Tr|Hacker)\b',
    re.IGNORECASE,
)
_MULTICART_RE = re.compile(
    r'(?:\b\d+\s*-?\s*in\s*-?\s*\d+\b|\bMaxi\s+\d+\b|'
    r'Action\s+Replay|Game\s+Genie|\[BIOS\])',
    re.IGNORECASE,
)
_METADATA_REGION_SHORTHAND_RE = re.compile(
    r'^(?:Jp-US|EU-US|US-EU|Jp-Eu)$',
    re.IGNORECASE,
)
_METADATA_PUBLISHER_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 .&'\-]{0,30}$")

# Pilot wire in identify — helper itself works for any console platform.
CONSOLE_ROM_PEEL_PILOT_PLATFORMS = frozenset({
    LibraryPlatform.GB,
    LibraryPlatform.GBC,
})

_ARTICLE_SUFFIXES = (', The', ', A', ', An')
_ROM_SMALL_WORDS = frozenset({
    'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'vs',
})


def rom_title_case(working: str) -> str:
    """Title-case ROM display names; keep small words lowercase (IGDB-style)."""
    if not working:
        return ''
    words = working.split(' ')
    out: list[str] = []
    last_idx = len(words) - 1
    for idx, word in enumerate(words):
        if not word:
            continue
        if word in ('-', '–', '—'):
            out.append(word)
            continue
        punct = ''
        core = word
        if word.endswith(','):
            core = word[:-1]
            punct = ','
        lower = core.lower()
        if core.isupper() or re.fullmatch(r'[IVXLC]+', core, re.IGNORECASE):
            cased = core
        elif any(ch.isdigit() for ch in core) and core.upper() == core:
            cased = core
        elif idx == 0 or idx == last_idx and lower in {'the', 'a', 'an'}:
            cased = core[:1].upper() + core[1:] if core.lower() == core else core
        elif idx > 0 and lower in _ROM_SMALL_WORDS:
            cased = lower
        elif core.lower() == core:
            cased = core[:1].upper() + core[1:]
        else:
            cased = core
        out.append(cased + punct)
    return ' '.join(out)


def _basename(raw: str) -> str:
    text = (raw or '').strip()
    if not text:
        return ''
    return os.path.basename(text.replace('\\', '/'))


def peel_rom_extensions(text: str) -> str:
    """B15 — strip known ROM/archive extensions."""
    return ROM_EXT_RE.sub('', text or '').strip()


def peel_dump_brackets(text: str) -> str:
    """B16 — strip all GoodTools / dump bracket tags."""
    if not text:
        return ''
    working = text
    while True:
        next_pass = DUMP_BRACKETS_RE.sub('', working).strip()
        if next_pass == working:
            break
        working = next_pass
    return working


def peel_region_and_lang_parens(text: str) -> str:
    """B17 — strip No-Intro region and language-list parentheticals."""
    if not text:
        return ''
    working = text
    while True:
        next_pass = REGION_PAREN_RE.sub('', working).strip()
        next_pass = LANG_LIST_PAREN_RE.sub('', next_pass).strip()
        if next_pass == working:
            break
        working = next_pass
    return working


def peel_rev_and_hardware_parens(text: str) -> str:
    """B18 — strip revision / hardware / status parentheticals."""
    if not text:
        return ''
    working = text
    while True:
        next_pass = REV_PAREN_RE.sub('', working).strip()
        if next_pass == working:
            break
        working = next_pass
    return working


def _is_metadata_paren_inner(inner: str) -> bool:
    s = (inner or '').strip()
    if not s:
        return False
    if re.fullmatch(r'\d{4}', s):
        return True
    if _METADATA_REGION_SHORTHAND_RE.fullmatch(s):
        return True
    if not _METADATA_PUBLISHER_RE.fullmatch(s):
        return False
    head = s.split(',')[0].strip().lower()
    region_heads = {
        'usa', 'europe', 'japan', 'world', 'u', 'e', 'j', 'ue', 'ju', 'eu', 'jp',
        'asia', 'brazil', 'korea', 'australia', 'france', 'germany', 'spain',
        'italy', 'netherlands', 'sweden', 'china', 'hong kong', 'taiwan', 'russia',
    }
    if head in region_heads or head.startswith('rev'):
        return False
    return True


def peel_metadata_parens(text: str) -> str:
    """B19 — strip trailing GoodTools metadata glued parens (year, publisher, Jp-US)."""
    if not text:
        return ''
    working = text.strip()
    while True:
        if not working.endswith(')'):
            break
        open_idx = working.rfind('(')
        if open_idx < 0:
            break
        inner = working[open_idx + 1 : -1]
        if not _is_metadata_paren_inner(inner):
            break
        head = working[:open_idx].strip()
        if not head:
            break
        working = head
    return working


def peel_remaining_simple_parens(text: str) -> str:
    """Strip leftover short parentheticals (DAT normalize + console B19 fallback)."""
    if not text:
        return ''
    working = text
    while True:
        next_pass = REMAINING_SIMPLE_PAREN_RE.sub('', working).strip()
        if next_pass == working:
            break
        working = next_pass
    return working


def normalize_rom_peel_core(name: str | None) -> str:
    """Run B15–B19 without title-case (lowercase-safe for DAT keys)."""
    text = (name or '').strip()
    if not text:
        return ''
    text = peel_rom_extensions(text)
    text = peel_dump_brackets(text)
    text = peel_region_and_lang_parens(text)
    text = peel_rev_and_hardware_parens(text)
    text = peel_metadata_parens(text)
    text = peel_remaining_simple_parens(text)
    text = MULTI_SPACE_RE.sub(' ', text.replace('_', ' ')).strip()
    return text


def normalize_set_title_from_peel(name: str | None) -> str:
    """Lowercase DAT / ownership key — wraps shared peel core."""
    return normalize_rom_peel_core(name).lower()


def _detect_propose_only(raw: str) -> bool:
    return bool(_PROPOSE_BRACKET_FLAGS_RE.search(raw) or _PROPOSE_STATUS_PAREN_RE.search(raw))


def _detect_multicart(raw: str) -> bool:
    return bool(_MULTICART_RE.search(raw))


def _detect_article_suffix(cleaned: str) -> str | None:
    for suffix in _ARTICLE_SUFFIXES:
        if cleaned.endswith(suffix):
            return suffix[2:].strip()
    return None


def should_use_console_rom_peel(
    library,
    full_disk_path: str,
    settings: dict | None = None,
) -> bool:
    """True when identify should use console ROM peel instead of PC parse_game_label."""
    platform = getattr(library, 'platform', None)
    if platform not in CONSOLE_ROM_PEEL_PILOT_PLATFORMS:
        return False
    scan_mode = (settings or {}).get('scan_mode')
    if scan_mode == 'files':
        return True
    if scan_mode == 'folders':
        return False
    return os.path.isfile(full_disk_path or '')


def parse_console_rom_label(
    raw: str,
    *,
    platform: LibraryPlatform | None = None,
) -> dict[str, Any]:
    """
    Parse a console ROM file basename into a cleaned IGDB search title.

    Stages B15–B20 (docs/strategy/name-resolution.md console slice).
    Returns transforms[] trail (W20-2 parity) plus propose-only / multicart flags.
    """
    del platform  # reserved for future platform-specific rules
    raw_label = _basename(raw)
    transforms: list[dict[str, str]] = []
    propose_only = _detect_propose_only(raw_label)
    is_multicart = _detect_multicart(raw_label)

    if not raw_label:
        return {
            'raw': '',
            'cleaned_name': '',
            'transforms': [],
            'propose_only': propose_only,
            'is_multicart': is_multicart,
            'article_suffix': None,
            'bare_franchise': False,
            'steam_app_id': None,
            'had_vr_suffix': False,
        }

    working = raw_label

    after = peel_rom_extensions(working)
    working = _record_transform(transforms, 'B15', working, after, 'strip_extension')

    after = peel_dump_brackets(working)
    working = _record_transform(transforms, 'B16', working, after, 'dump_brackets')

    after = peel_region_and_lang_parens(working)
    working = _record_transform(transforms, 'B17', working, after, 'region_lang_parens')

    after = peel_rev_and_hardware_parens(working)
    working = _record_transform(transforms, 'B18', working, after, 'rev_hardware_parens')

    after = peel_metadata_parens(working)
    working = _record_transform(transforms, 'B19', working, after, 'metadata_parens')

    after = peel_remaining_simple_parens(working)
    working = _record_transform(transforms, 'B19', working, after, 'remaining_parens')

    before_b20 = working
    working = MULTI_SPACE_RE.sub(' ', working.replace('_', ' ')).strip()
    working = normalize_smart_apostrophes(working)
    working = inject_franchise_apostrophes(working)
    working = rom_title_case(working)
    working = _record_transform(transforms, 'B20', before_b20, working, 'normalize_title')

    article_suffix = _detect_article_suffix(working)

    return {
        'raw': raw_label,
        'cleaned_name': working,
        'transforms': transforms,
        'propose_only': propose_only or is_multicart,
        'is_multicart': is_multicart,
        'article_suffix': article_suffix,
        'bare_franchise': False,
        'steam_app_id': None,
        'had_vr_suffix': False,
    }
