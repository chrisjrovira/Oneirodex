"""BE-DET-9 — Fandom alias registry (soft alias · series · remaster · EN↔JP).

Capability tables live in code/tests only. Soft paths are propose-first:
never invent IGDB IDs from an alias alone; hard auto still requires the
existing Stage E / score ≥0.92 path. Public docs stay capability language.
"""

from __future__ import annotations

from dataclasses import dataclass
import re

# Soft alias hits clear proposal ranking but identify must stay propose-first.
SOFT_ALIAS_SCORE_BOOST = 0.95
# Cap additive fandom queries so Stage C budget stays ~8–12 unique variants.
FANDOM_VARIANT_BUDGET = 4

_KIND_SOFT_ALIAS = 'soft_alias'
_KIND_SERIES = 'series'
_KIND_REMASTER = 'remaster'
_KIND_REGIONAL = 'regional_en_jp'
_KIND_SOFT_TITLE = 'soft_title'

# Soft alternate spellings / fan shorthand → retail catalog form (propose-first
# only when the *query* is the shorthand left side — not the catalog title).
_SOFT_ALIAS_PAIRS: tuple[tuple[str, str], ...] = (
    ('FF7', 'Final Fantasy VII'),
    ('FFVII', 'Final Fantasy VII'),
    ('FF8', 'Final Fantasy VIII'),
    ('FFX', 'Final Fantasy X'),
    ('RE2', 'Resident Evil 2'),
    ('RE4', 'Resident Evil 4'),
    ('RE Remake', 'Resident Evil'),
    ('LoZ', 'The Legend of Zelda'),
    ('Zelda OoT', 'The Legend of Zelda Ocarina of Time'),
    ('Zelda MM', 'The Legend of Zelda Majora\'s Mask'),
    ('SMW', 'Super Mario World'),
    ('SMB3', 'Super Mario Bros. 3'),
    ('DKC', 'Donkey Kong Country'),
    ('SF2', 'Street Fighter II'),
    ('SSBM', 'Super Smash Bros. Melee'),
    ('P5R', 'Persona 5 Royal'),
    ('MH Rise', 'Monster Hunter Rise'),
    ('BotW', 'The Legend of Zelda Breath of the Wild'),
    ('TotK', 'The Legend of Zelda Tears of the Kingdom'),
)

# Bare / soft series heads — propose-first (extends C11 adjacency; no sequel invent).
# Do not list first-entry retail titles that W21 hard-auto must keep (e.g. Resident Evil).
_SERIES_SOFT_LABELS: frozenset[str] = frozenset({
    'final fantasy',
    'mega man',
    'metal gear',
    'dragon quest',
    'the legend of zelda',
    'legend of zelda',
    'castlevania',
    'chrono',
    'persona',
    'monster hunter',
    'street fighter',
    'tekken',
    'dark souls',
    'souls',
})

# Remaster / remake packaging → preferred catalog search (propose-first on left).
# W21 primary-head peel (folder base → remaster SKU candidate) stays hard auto.
_REMASTER_SOFT_PAIRS: tuple[tuple[str, str], ...] = (
    ('Shadow of the Colossus HD', 'Shadow of the Colossus'),
    ('Shadow of the Colossus Remastered', 'Shadow of the Colossus'),
    ('The Last of Us Remastered', 'The Last of Us'),
    ('The Last of Us Part I', 'The Last of Us'),
    ('Crash Bandicoot N Sane Trilogy', 'Crash Bandicoot'),
    ('Spyro Reignited Trilogy', 'Spyro the Dragon'),
    ('Resident Evil 2 Remake', 'Resident Evil 2'),
    ('Resident Evil 3 Remake', 'Resident Evil 3'),
    ('Resident Evil 4 Remake', 'Resident Evil 4'),
    ('Demon\'s Souls Remake', 'Demon\'s Souls'),
    ('Final Fantasy VII Remake', 'Final Fantasy VII'),
    ('Metroid Prime Remastered', 'Metroid Prime'),
    ('Links Awakening Remake', 'The Legend of Zelda Link\'s Awakening'),
    ('Link\'s Awakening Remake', 'The Legend of Zelda Link\'s Awakening'),
)

# Regional retail pairs: (primary EN, regional JP/alt). Propose-first on the
# regional/JP side only; EN primary keeps hard auto when score clears 0.92.
_REGIONAL_EN_JP_PAIRS: tuple[tuple[str, str], ...] = (
    ('Resident Evil', 'Biohazard'),
    ('Resident Evil 2', 'Biohazard 2'),
    ('Resident Evil 3', 'Biohazard 3'),
    ('Resident Evil 4', 'Biohazard 4'),
    ('Mega Man', 'Rockman'),
    ('Mega Man 2', 'Rockman 2'),
    ('Mega Man X', 'Rockman X'),
    ('EarthBound', 'Mother 2'),
    ('Secret of Mana', 'Seiken Densetsu 2'),
    ('Trials of Mana', 'Seiken Densetsu 3'),
    ('Dragon Quest', 'Dragon Warrior'),
    ('The Legend of Zelda', 'Zelda no Densetsu'),
    ('Okami', 'Ookami'),
    ('Phoenix Wright Ace Attorney', 'Gyakuten Saiban'),
    ('Fire Emblem Awakening', 'Fire Emblem Kakusei'),
    ('Xenoblade Chronicles', 'Xenoblade'),
    ('Harvest Moon', 'Bokujou Monogatari'),
    ('Story of Seasons', 'Bokujou Monogatari'),
)

# Soft-title adjacency labels / tails — Kind Soft title + propose-only.
_SOFT_TITLE_EXACT: frozenset[str] = frozenset({
    'otst',
    'home theater',
    'home theatre',
    'painting vr',
    'fitness vr',
})
_SOFT_TITLE_TAIL_RE = re.compile(
    r'(?i)\b(?:'
    r'vr\s+experience|experience\s+pack|companion\s+app|'
    r'dlc\s+hub|soundtrack\s+player|photo\s+mode\s+tool'
    r')\s*$'
)
_SOFT_TITLE_TOKEN_RE = re.compile(
    r'(?i)\b(?:otst|soft\s*title|experience\s+hub)\b'
)


@dataclass(frozen=True)
class FandomAliasHit:
    """One registry resolution for a cleaned folder / search label."""

    kind: str
    query: str
    canonical: str
    variants: tuple[str, ...]
    propose_only: bool
    match_reason: str
    suggested_kind: str | None = None


def normalize_alias_key(name: str | None) -> str:
    """Lowercase space-collapsed key for registry lookup."""
    if not name:
        return ''
    text = re.sub(r'\s+', ' ', str(name).strip().casefold())
    text = re.sub(r"[^a-z0-9'\s]+", '', text)
    return re.sub(r'\s+', ' ', text).strip()


def _forward_index(pairs: tuple[tuple[str, str], ...]) -> dict[str, str]:
    """Map left-side key → right-side display form (first-seen wins)."""
    out: dict[str, str] = {}
    for left, right in pairs:
        lk = normalize_alias_key(left)
        if not lk or not (right or '').strip():
            continue
        if normalize_alias_key(right) == lk:
            continue
        out.setdefault(lk, right.strip())
    return out


def _reverse_lists(pairs: tuple[tuple[str, str], ...]) -> dict[str, list[str]]:
    """Map right-side key → left-side display forms (for additive search only)."""
    out: dict[str, list[str]] = {}
    for left, right in pairs:
        rk = normalize_alias_key(right)
        if not rk or not (left or '').strip():
            continue
        if normalize_alias_key(left) == rk:
            continue
        out.setdefault(rk, [])
        text = left.strip()
        if text not in out[rk]:
            out[rk].append(text)
    return out


_SOFT_ALIAS_FORWARD = _forward_index(_SOFT_ALIAS_PAIRS)
_SOFT_ALIAS_REVERSE = _reverse_lists(_SOFT_ALIAS_PAIRS)
_REMASTER_FORWARD = _forward_index(_REMASTER_SOFT_PAIRS)
_REMASTER_REVERSE = _reverse_lists(_REMASTER_SOFT_PAIRS)
# Regional: JP/alt → EN primary (propose-first); EN → JP search-only reverse.
_REGIONAL_JP_TO_EN = _forward_index(
    tuple((jp, en) for en, jp in _REGIONAL_EN_JP_PAIRS)
)
_REGIONAL_EN_TO_JP = _reverse_lists(
    tuple((jp, en) for en, jp in _REGIONAL_EN_JP_PAIRS)
)


def _is_series_soft(cleaned: str) -> bool:
    key = normalize_alias_key(cleaned)
    if not key:
        return False
    if key in _SERIES_SOFT_LABELS:
        return True
    if key.startswith('the ') and key[4:] in _SERIES_SOFT_LABELS:
        return True
    return False


def _soft_title_hit(cleaned: str) -> bool:
    key = normalize_alias_key(cleaned)
    if key in _SOFT_TITLE_EXACT:
        return True
    if _SOFT_TITLE_TAIL_RE.search(cleaned or ''):
        return True
    if _SOFT_TITLE_TOKEN_RE.search(cleaned or ''):
        return True
    return False


def lookup_fandom_alias(cleaned_name: str | None) -> FandomAliasHit | None:
    """
    Resolve the strongest soft registry hit for a cleaned label.

    Priority: soft_title → regional JP/alt → remaster (left) → soft alias (left)
    → series. Soft paths always set propose_only=True.

    Primary EN regional titles and remaster/soft-alias *targets* do not force
    propose-only (hard auto / W21 remaster peel still apply).
    """
    raw = (cleaned_name or '').strip()
    if not raw:
        return None
    key = normalize_alias_key(raw)
    if not key:
        return None

    if _soft_title_hit(raw):
        return FandomAliasHit(
            kind=_KIND_SOFT_TITLE,
            query=raw,
            canonical=raw,
            variants=(raw,),
            propose_only=True,
            match_reason='fandom_soft_title',
            suggested_kind='experience',
        )

    regional_en = _REGIONAL_JP_TO_EN.get(key)
    if regional_en:
        return FandomAliasHit(
            kind=_KIND_REGIONAL,
            query=raw,
            canonical=regional_en,
            variants=(regional_en, raw),
            propose_only=True,
            match_reason='fandom_regional_en_jp',
        )

    remaster = _REMASTER_FORWARD.get(key)
    if remaster:
        return FandomAliasHit(
            kind=_KIND_REMASTER,
            query=raw,
            canonical=remaster,
            variants=(remaster, raw),
            propose_only=True,
            match_reason='fandom_remaster_soft',
        )

    soft = _SOFT_ALIAS_FORWARD.get(key)
    if soft:
        return FandomAliasHit(
            kind=_KIND_SOFT_ALIAS,
            query=raw,
            canonical=soft,
            variants=(soft, raw),
            propose_only=True,
            match_reason='fandom_soft_alias',
        )

    if _is_series_soft(raw):
        return FandomAliasHit(
            kind=_KIND_SERIES,
            query=raw,
            canonical=raw,
            variants=(raw,),
            propose_only=True,
            match_reason='fandom_series_soft',
        )

    return None


def is_fandom_soft_propose(cleaned_name: str | None) -> bool:
    """True when identify must stay propose-first for this label."""
    hit = lookup_fandom_alias(cleaned_name)
    return bool(hit and hit.propose_only)


def expand_fandom_search_variants(
    cleaned_name: str | None,
    *,
    budget: int = FANDOM_VARIANT_BUDGET,
) -> list[str]:
    """
    Additive search copies from the registry (canonical + reverse forms).

    Does not replace the caller's primary cleaned label; empty when no extras.
    Reverse soft-alias / remaster / EN→JP forms are search-only.
    """
    raw = (cleaned_name or '').strip()
    if not raw:
        return []
    key = normalize_alias_key(raw)
    if not key:
        return []

    candidates: list[str] = []
    hit = lookup_fandom_alias(raw)
    if hit:
        candidates.extend(hit.variants)

    # Search-only reverse forms when the folder is already the catalog / EN title.
    for extra in _SOFT_ALIAS_REVERSE.get(key, ()):
        candidates.append(extra)
    for extra in _REMASTER_REVERSE.get(key, ()):
        candidates.append(extra)
    for extra in _REGIONAL_EN_TO_JP.get(key, ()):
        candidates.append(extra)

    out: list[str] = []
    seen = {key}
    for variant in candidates:
        text = (variant or '').strip()
        if not text:
            continue
        vkey = normalize_alias_key(text)
        if not vkey or vkey in seen:
            continue
        seen.add(vkey)
        out.append(text)
        if len(out) >= max(0, int(budget)):
            break
    return out


def fandom_soft_score_boost(
    cleaned_name: str | None,
    candidate_name: str | None,
) -> float:
    """
    Soft score used for proposal ranking when registry links two titles.

    Only boosts when the *folder* side is a soft-propose query (JP/alt,
    shorthand, remaster packaging, series, soft-title). Never boosts EN
    primary / catalog targets into hard auto via a regional alt alone.
    Never invents an IGDB id.
    """
    left = (cleaned_name or '').strip()
    right = (candidate_name or '').strip()
    if not left or not right:
        return 0.0
    if not is_fandom_soft_propose(left):
        return 0.0
    lk = normalize_alias_key(left)
    rk = normalize_alias_key(right)
    if not lk or not rk or lk == rk:
        return 0.0

    # Soft alias: shorthand → catalog
    mapped = _SOFT_ALIAS_FORWARD.get(lk)
    if mapped and normalize_alias_key(mapped) == rk:
        return SOFT_ALIAS_SCORE_BOOST

    # Remaster soft: packaging → base
    mapped = _REMASTER_FORWARD.get(lk)
    if mapped and normalize_alias_key(mapped) == rk:
        return SOFT_ALIAS_SCORE_BOOST

    # Regional JP/alt → EN primary
    mapped = _REGIONAL_JP_TO_EN.get(lk)
    if mapped and normalize_alias_key(mapped) == rk:
        return SOFT_ALIAS_SCORE_BOOST

    # Series soft: identical series head only (no sequel invent).
    if _is_series_soft(left) and lk == rk:
        return SOFT_ALIAS_SCORE_BOOST

    return 0.0


def fandom_match_reason(cleaned_name: str | None) -> str | None:
    """Short match_reason code for Unmatched / proposal sidecars."""
    hit = lookup_fandom_alias(cleaned_name)
    return hit.match_reason if hit else None


def fandom_suggested_kind(cleaned_name: str | None) -> str | None:
    """Optional Soft title suggestion when soft-title adjacency hits."""
    hit = lookup_fandom_alias(cleaned_name)
    return hit.suggested_kind if hit else None
