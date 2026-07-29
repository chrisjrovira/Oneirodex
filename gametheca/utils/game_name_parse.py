"""
Parse raw game folder/file labels into cleaned search names and Steam App ID hints.

Designed for Unraid library naming: common scene/repack bracket tags, trailing (digits) App IDs, etc.
"""
import re

_BRACKET_TAG_RE = re.compile(
    # Match common scene/repack aliases in brackets (functional strip list for scan quality).
    r'\[\s*(?:FitGirl(?:\s+HV)?|Dodi|CODEX|FLT|SKIDROW|EMPRESS|RUNE|PLAZA|HOODLUM|DARKSiDERS)'
    r'\s*(?:Repack)?\s*\]',
    re.IGNORECASE,
)
# Version junk like [1 0 4 1] or [1.0.4.1] in brackets — not useful for IGDB search.
_VERSION_BRACKET_RE = re.compile(
    r'\[\s*\d+(?:[\s._]+\d+)+\s*\]',
    re.IGNORECASE,
)
_STEAM_ID_RE = re.compile(r'\(\s*(\d{4,7})\s*\)\s*$')
# Trailing "(Build 14.09.2017)" / "(build 123)" junk — not a Steam App ID.
_BUILD_PAREN_RE = re.compile(r'\s*\(\s*build\b[^)]*\)\s*$', re.IGNORECASE)
# Trailing "VR MOD ..." tails, with or without a leading hyphen (e.g.
# "Alien Isolation VR MOD - MotherVR 0 8 1" -> "Alien Isolation").
_VR_MOD_TAIL_RE = re.compile(r'\s*-?\s*\bVR\s+MOD\b.*$', re.IGNORECASE)
# Trailing "MotherVR ..." / "- MotherVR ..." tails when VR MOD wasn't already
# matched above (e.g. a bare "- MotherVR 1 2 3" suffix).
_MOTHERVR_TAIL_RE = re.compile(r'\s*-?\s*\bMotherVR\b.*$', re.IGNORECASE)
# Trailing standalone "VR" token (e.g. "A Fishermans Tale VR" -> "A Fishermans Tale").
_TRAILING_VR_RE = re.compile(r'\s+VR\s*$', re.IGNORECASE)
# Tiny alias map for obvious stylized titles that don't survive plain cleanup.
_ALIAS_MAP = {
    'adr1ft': 'Adrift',
}


def strip_repack_tags(raw: str) -> str:
    """Remove common scene/repack bracket tags from a label."""
    if not raw:
        return ''
    return _BRACKET_TAG_RE.sub('', raw).strip()


def strip_version_brackets(raw: str) -> str:
    """Remove bracketed multi-part version junk (e.g. [1 0 4 1])."""
    if not raw:
        return ''
    return _VERSION_BRACKET_RE.sub('', raw).strip()


def strip_build_tail(raw: str) -> str:
    """Remove a trailing '(Build ...)' / '(build ...)' parenthetical."""
    if not raw:
        return ''
    return _BUILD_PAREN_RE.sub('', raw).strip()


def strip_vr_noise_tail(raw: str) -> str:
    """
    Remove trailing VR-repack noise: 'VR MOD ...', 'MotherVR ...' /
    '- MotherVR ...' tails, and a bare trailing 'VR' token.
    """
    if not raw:
        return ''
    working = _VR_MOD_TAIL_RE.sub('', raw)
    working = _MOTHERVR_TAIL_RE.sub('', working)
    working = _TRAILING_VR_RE.sub('', working)
    return working.strip()


def parse_game_label(raw: str) -> dict:
    """
    Parse a folder or file stem into a cleaned display/search name and optional Steam App ID.

    Returns:
        dict with keys: raw (str), cleaned_name (str), steam_app_id (int|None)
    """
    if not raw or not isinstance(raw, str):
        return {'raw': raw or '', 'cleaned_name': '', 'steam_app_id': None}

    steam_app_id = None
    working = raw.strip()
    working = strip_repack_tags(working)
    working = strip_version_brackets(working)
    working = strip_build_tail(working)
    working = strip_vr_noise_tail(working)

    match = _STEAM_ID_RE.search(working)
    if match:
        steam_app_id = int(match.group(1))
        working = working[: match.start()].strip()

    working = working.replace('_', ' ')
    working = re.sub(r'\s+', ' ', working).strip(' -_')

    aliased = _ALIAS_MAP.get(working.casefold())
    if aliased:
        cleaned = aliased
    else:
        parts = []
        for word in working.split(' '):
            if not word:
                continue
            if word.isupper() or any(ch.isdigit() for ch in word):
                parts.append(word)
            elif word.lower() == word:
                parts.append(word[:1].upper() + word[1:])
            else:
                parts.append(word)

        cleaned = ' '.join(parts)
    return {
        'raw': raw,
        'cleaned_name': cleaned,
        'steam_app_id': steam_app_id,
    }
