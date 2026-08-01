"""W20-4 Scan/match policy settings — defaults + override affects scoring."""

from types import SimpleNamespace

from gametheca.utils.duplicate_check import (
    DEFAULT_TITLE_THRESHOLD,
    explain_duplicate_match,
    should_mark_as_duplicate,
)
from gametheca.utils.gamenames import generate_goty_variants
from gametheca.utils.game_name_parse import parse_game_label
from gametheca.utils.match_scoring import (
    DEFAULT_AMBIGUOUS_GAP,
    DEFAULT_HIGH_THRESHOLD,
    classify_confidence,
    select_best_match,
)
from gametheca.utils.scan_match_settings import (
    CORE_DEFAULTS,
    normalize_peel_profile,
    resolve_scan_match_policy,
)


def test_core_defaults_match_hardcoded_constants():
    assert CORE_DEFAULTS['match_high_threshold'] == DEFAULT_HIGH_THRESHOLD == 0.92
    assert CORE_DEFAULTS['match_ambiguous_gap'] == DEFAULT_AMBIGUOUS_GAP == 0.08
    assert CORE_DEFAULTS['dupe_title_threshold'] == DEFAULT_TITLE_THRESHOLD == 0.85
    assert CORE_DEFAULTS['peel_profile'] == 'conservative'
    assert CORE_DEFAULTS['enable_year_drop_variant'] is True
    assert CORE_DEFAULTS['enable_pack_peel_variant'] is True
    assert CORE_DEFAULTS['enable_edition_peel_variant'] is True
    assert CORE_DEFAULTS['enable_sequel_numeral_variant'] is True


def test_resolve_policy_falls_back_when_unset():
    policy = resolve_scan_match_policy({})
    assert policy['match_high_threshold'] == 0.92
    assert policy['match_ambiguous_gap'] == 0.08
    assert policy['dupe_title_threshold'] == 0.85
    assert policy['peel_profile'] == 'conservative'
    assert policy['propose_only_scan'] is False


def test_resolve_policy_accepts_overrides_and_camel_aliases():
    policy = resolve_scan_match_policy({
        'matchHighThreshold': 0.80,
        'match_ambiguous_gap': 0.05,
        'dupeTitleThreshold': 0.70,
        'peelProfile': 'AGGRESSIVE',
        'proposeOnlyScan': True,
        'enable_year_drop_variant': False,
    })
    assert policy['match_high_threshold'] == 0.80
    assert policy['match_ambiguous_gap'] == 0.05
    assert policy['dupe_title_threshold'] == 0.70
    assert policy['peel_profile'] == 'aggressive'
    assert policy['propose_only_scan'] is True
    assert policy['enable_year_drop_variant'] is False


def test_resolve_policy_clamps_thresholds():
    policy = resolve_scan_match_policy({
        'match_high_threshold': 1.5,
        'match_ambiguous_gap': -0.2,
    })
    assert policy['match_high_threshold'] == 1.0
    assert policy['match_ambiguous_gap'] == 0.0


def test_normalize_peel_profile():
    assert normalize_peel_profile('aggressive') == 'aggressive'
    assert normalize_peel_profile('nope') == 'conservative'
    assert normalize_peel_profile(None) == 'conservative'


def test_override_high_threshold_affects_classify_and_select():
    """Lowering the high threshold turns a borderline score into high confidence."""
    scores = [0.90, 0.70]
    assert classify_confidence(scores) == 'low'
    assert classify_confidence(scores, high_threshold=0.85) == 'high'

    # Near-miss title: folder missing the sequel digit → score < 0.99, often ≥ 0.85.
    candidates = [
        {'id': 1, 'name': 'Pathologic 2'},
        {'id': 2, 'name': 'Totally Different Game'},
    ]
    best_strict, conf_strict = select_best_match(
        'Pathologic',
        candidates,
        high_threshold=0.99,
        ambiguous_gap=0.08,
    )
    assert conf_strict == 'low'
    assert best_strict is None

    best_relaxed, conf_relaxed = select_best_match(
        'Pathologic',
        candidates,
        high_threshold=0.80,
        ambiguous_gap=0.08,
    )
    assert conf_relaxed == 'high'
    assert best_relaxed['id'] == 1


def test_dupe_threshold_override_affects_explain():
    existing = SimpleNamespace(
        name='Alan Wake',
        uuid='u-1',
        full_disk_path='/storage/_a/Alan Wake',
    )
    # Complete Collection vs Alan Wake is below default 0.85.
    assert not should_mark_as_duplicate(
        existing,
        '/storage/_a/Alan Wake Complete Collection',
        'Alan Wake Complete Collection',
    )
    # Extremely low threshold forces duplicate.
    match = explain_duplicate_match(
        existing,
        '/storage/_a/Alan Wake Complete Collection',
        'Alan Wake Complete Collection',
        title_threshold=0.10,
    )
    assert match['is_duplicate'] is True
    assert match['threshold'] == 0.10


def test_variant_toggles_disable_year_and_edition_peel():
    full = generate_goty_variants('Alone in the Dark 2024')
    assert 'Alone in the Dark' in full or any(
        v.casefold() == 'alone in the dark' for v in full
    )

    no_year = generate_goty_variants(
        'Alone in the Dark 2024',
        policy={'enable_year_drop_variant': False},
    )
    assert not any(v.casefold() == 'alone in the dark' for v in no_year)

    edition_full = generate_goty_variants("Cool Game Collector's Edition")
    assert any(v.casefold() == 'cool game' for v in edition_full)

    edition_off = generate_goty_variants(
        "Cool Game Collector's Edition",
        policy={'enable_edition_peel_variant': False},
    )
    assert not any(v.casefold() == 'cool game' for v in edition_off)


def test_aggressive_peel_strips_edition_from_cleaned_name():
    conservative = parse_game_label("Some Game Collector's Edition", peel_profile='conservative')
    aggressive = parse_game_label("Some Game Collector's Edition", peel_profile='aggressive')
    assert "collector" in conservative['cleaned_name'].casefold()
    assert aggressive['cleaned_name'].casefold() == 'some game'
    assert aggressive['peel_profile'] == 'aggressive'
