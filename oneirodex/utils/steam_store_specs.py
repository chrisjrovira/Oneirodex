"""Fill-only Steam specs: system requirements and a languages matrix.

Steam ``appdetails`` ships min/rec HTML blobs and a starred language string.
We store plain text on ``Game.store_specs`` and never invent rows for titles
that never hit Steam. ROM peel chips stay a separate filename truth.
"""

from __future__ import annotations

import html
import re
from typing import Any

_TAG_RE = re.compile(r'<[^>]+>')
_BR_RE = re.compile(r'<br\s*/?>', re.IGNORECASE)
_BLOCK_END_RE = re.compile(r'</(?:p|div|li|tr|h[1-6])>', re.IGNORECASE)
_AUDIO_FOOTNOTE_RE = re.compile(r'languages with full audio', re.IGNORECASE)
_MULTI_NL_RE = re.compile(r'\n{3,}')

_OS_KEYS = ('windows', 'mac', 'linux')
_STEAM_REQ_KEYS = (
    ('pc_requirements', 'windows'),
    ('mac_requirements', 'mac'),
    ('linux_requirements', 'linux'),
)

_TEXT_CAP = 8000
_LANG_NAME_CAP = 80


def strip_steam_html(raw: str | None) -> str:
    """Turn a Steam HTML blob into wrapped plain text. Never execute markup."""
    if not raw or not isinstance(raw, str):
        return ''
    text = _BR_RE.sub('\n', raw)
    text = _BLOCK_END_RE.sub('\n', text)
    text = _TAG_RE.sub('', text)
    text = html.unescape(text)
    text = _MULTI_NL_RE.sub('\n\n', text)
    return text.strip()[:_TEXT_CAP]


def parse_requirement_block(blob: Any) -> dict[str, str]:
    """``{minimum, recommended}`` from a Steam OS requirements object."""
    if not isinstance(blob, dict):
        return {}
    out: dict[str, str] = {}
    minimum = strip_steam_html(blob.get('minimum') if isinstance(blob.get('minimum'), str) else None)
    recommended = strip_steam_html(
        blob.get('recommended') if isinstance(blob.get('recommended'), str) else None
    )
    if minimum:
        out['minimum'] = minimum
    if recommended:
        out['recommended'] = recommended
    return out


def parse_supported_languages(raw: str | None) -> list[dict[str, Any]]:
    """Steam ``supported_languages`` → ``{name, interface, audio, subtitles}``.

    Listed names are interface + subtitles. A trailing ``*`` (Steam's full-audio
    mark) sets ``audio``. The footnote line is dropped, not treated as a language.
    """
    if not raw or not isinstance(raw, str):
        return []
    text = _BR_RE.sub('\n', raw)
    text = _TAG_RE.sub('', text)
    text = html.unescape(text)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return []
    list_line = next((line for line in lines if not _AUDIO_FOOTNOTE_RE.search(line)), '')
    if not list_line:
        return []

    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for part in list_line.split(','):
        token = part.strip()
        if not token or _AUDIO_FOOTNOTE_RE.search(token):
            continue
        audio = token.endswith('*')
        name = token.rstrip('*').strip()[:_LANG_NAME_CAP]
        key = name.lower()
        if not name or key in seen:
            continue
        seen.add(key)
        rows.append({
            'name': name,
            'interface': True,
            'audio': audio,
            'subtitles': True,
        })
    return rows


def store_specs_from_steam_details(details: dict | None) -> dict | None:
    """Normalize the unused ``appdetails`` requirement / language fields."""
    if not details:
        return None
    reqs: dict[str, dict[str, str]] = {}
    for src, dest in _STEAM_REQ_KEYS:
        block = parse_requirement_block(details.get(src))
        if block:
            reqs[dest] = block
    languages = parse_supported_languages(details.get('supported_languages'))
    if not reqs and not languages:
        return None
    out: dict[str, Any] = {}
    if reqs:
        out['system_requirements'] = reqs
    if languages:
        out['languages'] = languages
    return out


def _has_requirements(specs: dict | None) -> bool:
    reqs = (specs or {}).get('system_requirements') or {}
    if not isinstance(reqs, dict):
        return False
    return any(
        isinstance(block, dict) and (block.get('minimum') or block.get('recommended'))
        for block in reqs.values()
    )


def merge_store_specs(existing: dict | None, incoming: dict | None) -> dict | None:
    """Fill missing requirement / language keys. Never replace a populated side."""
    if not incoming:
        return existing if existing else None
    if not existing:
        return incoming
    current_reqs = existing.get('system_requirements') if isinstance(existing.get('system_requirements'), dict) else {}
    current_langs = existing.get('languages') if isinstance(existing.get('languages'), list) else []
    next_reqs = current_reqs
    next_langs = current_langs
    if not _has_requirements(existing) and _has_requirements(incoming):
        next_reqs = incoming.get('system_requirements') or {}
    if not current_langs and incoming.get('languages'):
        next_langs = incoming.get('languages') or []
    result: dict[str, Any] = {}
    if next_reqs:
        result['system_requirements'] = next_reqs
    if next_langs:
        result['languages'] = next_langs
    return result or None


def public_store_specs(raw: Any) -> dict | None:
    """Sanitize stored JSON for the details payload. No HTML, no extra keys."""
    if not isinstance(raw, dict):
        return None
    reqs: dict[str, dict[str, str]] = {}
    source_reqs = raw.get('system_requirements')
    if isinstance(source_reqs, dict):
        for key in _OS_KEYS:
            block = source_reqs.get(key)
            if not isinstance(block, dict):
                continue
            minimum = str(block.get('minimum') or '').strip()[:_TEXT_CAP]
            recommended = str(block.get('recommended') or '').strip()[:_TEXT_CAP]
            if minimum or recommended:
                cleaned: dict[str, str] = {}
                if minimum:
                    cleaned['minimum'] = minimum
                if recommended:
                    cleaned['recommended'] = recommended
                reqs[key] = cleaned
    languages: list[dict[str, Any]] = []
    for row in raw.get('languages') or []:
        if not isinstance(row, dict):
            continue
        name = str(row.get('name') or '').strip()[:_LANG_NAME_CAP]
        if not name:
            continue
        languages.append({
            'name': name,
            'interface': bool(row.get('interface')),
            'audio': bool(row.get('audio')),
            'subtitles': bool(row.get('subtitles')),
        })
    if not reqs and not languages:
        return None
    out: dict[str, Any] = {}
    if reqs:
        out['system_requirements'] = reqs
    if languages:
        out['languages'] = languages
    return out
