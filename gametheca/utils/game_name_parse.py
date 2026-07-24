"""
Parse raw game folder/file labels into cleaned search names and Steam App ID hints.

Designed for Unraid library naming: FitGirl/HV tags, trailing (digits) App IDs, etc.
"""
import re

_BRACKET_TAG_RE = re.compile(
    r'\[\s*(?:FitGirl(?:\s+HV)?|Dodi|CODEX|FLT|SKIDROW|EMPRESS|RUNE|PLAZA|HOODLUM|DARKSiDERS)'
    r'\s*(?:Repack)?\s*\]',
    re.IGNORECASE,
)
_STEAM_ID_RE = re.compile(r'\(\s*(\d{4,7})\s*\)\s*$')


def strip_repack_tags(raw: str) -> str:
    """Remove common scene/repack bracket tags from a label."""
    if not raw:
        return ''
    return _BRACKET_TAG_RE.sub('', raw).strip()


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

    match = _STEAM_ID_RE.search(working)
    if match:
        steam_app_id = int(match.group(1))
        working = working[: match.start()].strip()

    working = working.replace('_', ' ')
    working = re.sub(r'\s+', ' ', working).strip(' -_')

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
