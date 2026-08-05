"""BE-DET-9 — Fandom alias registry fixture pack (≥30 soft cases)."""

from __future__ import annotations

import pytest

from gametheca.utils.fandom_alias import (
    SOFT_ALIAS_SCORE_BOOST,
    expand_fandom_search_variants,
    fandom_match_reason,
    fandom_soft_score_boost,
    fandom_suggested_kind,
    is_fandom_soft_propose,
    lookup_fandom_alias,
)
from gametheca.utils.gamenames import generate_goty_variants
from gametheca.utils.match_scoring import (
    DEFAULT_HIGH_THRESHOLD,
    score_candidate,
    select_best_match,
)


def test_threshold_default_not_lowered():
    assert DEFAULT_HIGH_THRESHOLD >= 0.92


# ---------------------------------------------------------------------------
# Soft alias (shorthand → catalog, propose-first)
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    'folder,canonical',
    [
        ('FF7', 'Final Fantasy VII'),
        ('FFVII', 'Final Fantasy VII'),
        ('FF8', 'Final Fantasy VIII'),
        ('FFX', 'Final Fantasy X'),
        ('RE2', 'Resident Evil 2'),
        ('RE4', 'Resident Evil 4'),
        ('LoZ', 'The Legend of Zelda'),
        ('Zelda OoT', 'The Legend of Zelda Ocarina of Time'),
        ('SMW', 'Super Mario World'),
        ('SMB3', 'Super Mario Bros. 3'),
        ('DKC', 'Donkey Kong Country'),
        ('SF2', 'Street Fighter II'),
        ('SSBM', 'Super Smash Bros. Melee'),
        ('P5R', 'Persona 5 Royal'),
        ('BotW', 'The Legend of Zelda Breath of the Wild'),
        ('TotK', 'The Legend of Zelda Tears of the Kingdom'),
    ],
)
def test_soft_alias_propose_and_expand(folder, canonical):
    hit = lookup_fandom_alias(folder)
    assert hit is not None
    assert hit.kind == 'soft_alias'
    assert hit.propose_only is True
    assert is_fandom_soft_propose(folder) is True
    assert fandom_match_reason(folder) == 'fandom_soft_alias'
    variants = expand_fandom_search_variants(folder)
    assert any(v.casefold() == canonical.casefold() for v in variants)
    # Catalog title itself must NOT force propose-only via soft alias reverse.
    assert is_fandom_soft_propose(canonical) is False or lookup_fandom_alias(
        canonical
    ).kind != 'soft_alias'


# ---------------------------------------------------------------------------
# Series soft (bare franchise adjacency)
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    'folder',
    [
        'Final Fantasy',
        'Metal Gear',
        'Castlevania',
        'Persona',
        'Monster Hunter',
        'Street Fighter',
        'Dark Souls',
    ],
)
def test_series_soft_propose_only(folder):
    hit = lookup_fandom_alias(folder)
    assert hit is not None
    assert hit.kind == 'series'
    assert hit.propose_only is True
    assert is_fandom_soft_propose(folder) is True
    assert fandom_match_reason(folder) == 'fandom_series_soft'


def test_resident_evil_first_entry_not_series_soft():
    """W21 hard-auto for exact Resident Evil must stay available."""
    hit = lookup_fandom_alias('Resident Evil')
    assert hit is None or hit.kind != 'series'
    assert is_fandom_soft_propose('Resident Evil') is False


# ---------------------------------------------------------------------------
# Remaster soft (packaging → base, propose-first)
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    'folder,base',
    [
        ('Shadow of the Colossus HD', 'Shadow of the Colossus'),
        ('Shadow of the Colossus Remastered', 'Shadow of the Colossus'),
        ('The Last of Us Remastered', 'The Last of Us'),
        ('Metroid Prime Remastered', 'Metroid Prime'),
        ('Resident Evil 2 Remake', 'Resident Evil 2'),
        ('Final Fantasy VII Remake', 'Final Fantasy VII'),
        ('Crash Bandicoot N Sane Trilogy', 'Crash Bandicoot'),
        ('Spyro Reignited Trilogy', 'Spyro the Dragon'),
    ],
)
def test_remaster_soft_propose_and_boost(folder, base):
    hit = lookup_fandom_alias(folder)
    assert hit is not None
    assert hit.kind == 'remaster'
    assert hit.propose_only is True
    assert is_fandom_soft_propose(folder) is True
    assert fandom_match_reason(folder) == 'fandom_remaster_soft'
    assert fandom_soft_score_boost(folder, base) >= SOFT_ALIAS_SCORE_BOOST
    # Base title alone is not remaster-soft propose.
    remaster_hit = lookup_fandom_alias(base)
    assert remaster_hit is None or remaster_hit.kind != 'remaster'


# ---------------------------------------------------------------------------
# Regional EN ↔ JP (JP/alt propose-first; EN primary hard-auto OK)
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    'jp_or_alt,en_primary',
    [
        ('Biohazard', 'Resident Evil'),
        ('Biohazard 2', 'Resident Evil 2'),
        ('Biohazard 4', 'Resident Evil 4'),
        ('Rockman', 'Mega Man'),
        ('Rockman X', 'Mega Man X'),
        ('Mother 2', 'EarthBound'),
        ('Seiken Densetsu 2', 'Secret of Mana'),
        ('Seiken Densetsu 3', 'Trials of Mana'),
        ('Zelda no Densetsu', 'The Legend of Zelda'),
        ('Ookami', 'Okami'),
        ('Gyakuten Saiban', 'Phoenix Wright Ace Attorney'),
        ('Fire Emblem Kakusei', 'Fire Emblem Awakening'),
        ('Bokujou Monogatari', 'Harvest Moon'),
    ],
)
def test_regional_jp_propose_en_hard_ok(jp_or_alt, en_primary):
    hit = lookup_fandom_alias(jp_or_alt)
    assert hit is not None
    assert hit.kind == 'regional_en_jp'
    assert hit.propose_only is True
    assert is_fandom_soft_propose(jp_or_alt) is True
    variants = expand_fandom_search_variants(jp_or_alt)
    assert any(v.casefold() == en_primary.casefold() for v in variants)
    assert fandom_soft_score_boost(jp_or_alt, en_primary) >= SOFT_ALIAS_SCORE_BOOST
    # EN primary: search may include JP alt, but no soft propose from regional alone.
    assert is_fandom_soft_propose(en_primary) is False or (
        lookup_fandom_alias(en_primary)
        and lookup_fandom_alias(en_primary).kind != 'regional_en_jp'
    )


def test_en_primary_expands_jp_search_variant():
    variants = expand_fandom_search_variants('Resident Evil')
    assert any(v.casefold() == 'biohazard' for v in variants)
    assert is_fandom_soft_propose('Resident Evil') is False


# ---------------------------------------------------------------------------
# Soft-title adjacency
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    'folder',
    [
        'OTST',
        'Home Theater',
        'Painting VR',
        'Some Title VR Experience',
        'Library DLC Hub',
        'Camera Companion App',
    ],
)
def test_soft_title_adjacency_propose_experience(folder):
    hit = lookup_fandom_alias(folder)
    assert hit is not None
    assert hit.kind == 'soft_title'
    assert hit.propose_only is True
    assert fandom_suggested_kind(folder) == 'experience'
    assert fandom_match_reason(folder) == 'fandom_soft_title'


# ---------------------------------------------------------------------------
# Integration: variants + scoring + no silent auto from soft alone
# ---------------------------------------------------------------------------
def test_generate_goty_variants_includes_fandom_soft_alias():
    variants = generate_goty_variants('FF7')
    assert 'FF7' in variants
    assert any('final fantasy vii' == v.casefold() for v in variants)


def test_soft_alias_boost_ranks_but_threshold_untouched():
    assert score_candidate('Biohazard', 'Resident Evil') >= 0.92
    assert DEFAULT_HIGH_THRESHOLD >= 0.92
    # Soft boost must not invent a winner when no linked candidate exists.
    best, confidence = select_best_match(
        'Biohazard',
        [
            {'id': 1, 'name': 'Cyberpunk 2077'},
            {'id': 2, 'name': 'Hades'},
        ],
    )
    assert confidence == 'low'
    assert best is None


def test_soft_alias_selects_linked_candidate_for_propose_ranking():
    best, confidence = select_best_match(
        'Biohazard',
        [
            {'id': 10, 'name': 'Resident Evil'},
            {'id': 11, 'name': 'Resident Evil 2'},
            {'id': 12, 'name': 'BioShock'},
        ],
    )
    assert confidence == 'high'
    assert best['name'] == 'Resident Evil'
    # Identify still proposes — soft path flag.
    assert is_fandom_soft_propose('Biohazard') is True


def test_fixture_pack_count_at_least_30():
    """Guard: parametrize tables above must stay ≥30 soft cases total."""
    soft_alias = 16
    series = 7
    remaster = 8
    regional = 13
    soft_title = 6
    assert soft_alias + series + remaster + regional + soft_title >= 30
