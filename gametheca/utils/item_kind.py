"""Library item kind taxonomy for games vs gaming-adjacent software.

Orthogonal to LibraryPlatform and IGDB Category (release shape).
Kinds: game | experience | emulator | tool (default game).
"""

from __future__ import annotations

import re

ITEM_KINDS = frozenset({'game', 'experience', 'emulator', 'tool'})
DEFAULT_ITEM_KIND = 'game'

ITEM_KIND_LABELS = {
    'game': 'Game',
    # W22-M6 — plain-language labels; API/DB tokens unchanged.
    'experience': 'Soft title',
    'emulator': 'Emulator',
    'tool': 'Utility',
}

# Aliases accepted from UI / proposals / browse query params.
ITEM_KIND_ALIASES = {
    'app': 'tool',
    'utility': 'tool',
    'utilities': 'tool',
    'software': 'tool',
    'emu': 'emulator',
    'emulators': 'emulator',
    'experiences': 'experience',
    'soft title': 'experience',
    'soft_title': 'experience',
    'soft-title': 'experience',
    'softtitles': 'experience',
    'games': 'game',
    'tools': 'tool',
}

# Steam storesearch / appdetails ``type`` values we treat as non-main-game software.
STEAM_SOFTWARE_TYPES = frozenset({'software', 'application', 'tool'})

# Generic name tokens that must never auto-match as an IGDB/Steam *game*.
# Capability language only — no Class A / scene brand tokens.
_DENY_AUTO_GAME_RE = re.compile(
    r'(?i)\b(?:'
    r'converter|ripper|patcher|unpacker|extractor|checksum|'
    r'metrics|benchmark|profiler|debugger|hex\s*editor|'
    r'save\s*editor|mod\s*manager|texture\s*tool'
    r')\b'
)

_EMULATOR_HINT_RE = re.compile(
    r'(?i)\b(?:emulator|emu\b|3dsen|citra|dolphin|pcsx|rpcs3|yuzu|ryujinx|vita3k)\b'
)
_EXPERIENCE_HINT_RE = re.compile(
    r'(?i)\b(?:experience|sandbox|painter|fitness|workout|meditation)\b'
)


def coerce_item_kind_token(value: str | None) -> str | None:
    """Return a canonical kind for a known token/alias, else None (unknown)."""
    if not value or not isinstance(value, str):
        return None
    kind = value.strip().lower()
    if not kind:
        return None
    if kind in ITEM_KINDS:
        return kind
    return ITEM_KIND_ALIASES.get(kind)


def parse_item_kinds_param(value: str | None) -> frozenset[str] | None:
    """Parse ``item_kind=`` (single or comma/semicolon list).

    Returns ``None`` when omitted/blank — callers must not filter (all kinds).
    Returns a frozenset of canonical kinds; empty when only unknown tokens given.
    """
    if value is None:
        return None
    if not isinstance(value, str):
        value = str(value)
    text = value.strip()
    if not text:
        return None
    kinds: set[str] = set()
    for part in re.split(r'[,;|]', text):
        resolved = coerce_item_kind_token(part)
        if resolved is not None:
            kinds.add(resolved)
    return frozenset(kinds)


def normalize_item_kind(value: str | None) -> str:
    """Return a canonical item_kind or default ``game``."""
    resolved = coerce_item_kind_token(value)
    return resolved if resolved is not None else DEFAULT_ITEM_KIND


def is_denied_auto_game_match(name: str | None) -> bool:
    """True when the label looks like a converter/editor/utility — not a playable game."""
    if not name:
        return False
    return bool(_DENY_AUTO_GAME_RE.search(name))


def infer_item_kind_from_steam_type(
    steam_type: str | None,
    *,
    name: str | None = None,
) -> str:
    """Map Steam store type (+ optional name hints) to item_kind."""
    stype = (steam_type or '').strip().lower()
    label = name or ''

    if is_denied_auto_game_match(label):
        return 'tool'
    if _EMULATOR_HINT_RE.search(label):
        return 'emulator'
    if stype in STEAM_SOFTWARE_TYPES:
        if _EXPERIENCE_HINT_RE.search(label):
            return 'experience'
        # VR console-style frontends often ship as Steam software
        if _EMULATOR_HINT_RE.search(label):
            return 'emulator'
        return 'tool'
    if stype in ('game', 'dlc', 'demo', 'music', ''):
        if _EXPERIENCE_HINT_RE.search(label) and stype != 'game':
            return 'experience'
        return DEFAULT_ITEM_KIND
    if _EXPERIENCE_HINT_RE.search(label):
        return 'experience'
    return DEFAULT_ITEM_KIND


def suggest_item_kind(name: str | None, *, steam_type: str | None = None) -> str:
    """Best-effort kind for proposals / Unmatched mark-as actions."""
    return infer_item_kind_from_steam_type(steam_type, name=name)


def steam_type_is_software(steam_type: str | None) -> bool:
    """True when Steam classifies the app as software/application/tool."""
    return (steam_type or '').strip().lower() in STEAM_SOFTWARE_TYPES
