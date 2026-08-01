"""Unit tests for IGDB candidate confidence scoring (no DB)."""

from gametheca.utils.match_scoring import score_candidate, classify_confidence, normalize_for_score


def test_normalize_strips_noise():
    assert normalize_for_score("Alan Wake - Remastered") == normalize_for_score("Alan Wake Remastered")


def test_exact_match_high_score():
    assert score_candidate("Barony", "Barony") >= 0.99


def test_cleaned_title_vs_igdb_title():
    score = score_candidate("Assassin's Creed Shadows", "Assassin's Creed Shadows")
    assert score >= 0.95


def test_unrelated_low_score():
    assert score_candidate("Barony", "Cyberpunk 2077") < 0.5


def test_steam_title_boosts_when_aligned():
    base = score_candidate("ctrl alt ego", "CTRL ALT EGO")
    boosted = score_candidate("ctrl alt ego", "CTRL ALT EGO", steam_title="CTRL ALT EGO")
    assert boosted >= base


def test_peeled_pathologic_scores_high():
    assert score_candidate("Pathologic 2", "Pathologic 2") >= 0.99


def test_peeled_alien_isolation_vs_igdb():
    assert score_candidate("Alien Isolation", "Alien: Isolation") >= 0.85


def test_steam_title_helps_noisy_folder_label():
    """Stage B: Steam store title bump when folder peel differs from IGDB casing."""
    score = score_candidate(
        "49 Keys",
        "49 Keys",
        steam_title="49 Keys",
    )
    assert score >= 0.99


def test_beachhead_peel_scores_clean():
    assert score_candidate("BeachHead", "Beach Head 2000") > score_candidate(
        "BeachHead-SCENEGRP", "Beach Head 2000"
    )


def test_classify_high_when_clear_winner():
    assert classify_confidence([0.96, 0.70]) == "high"


def test_classify_low_when_ambiguous():
    assert classify_confidence([0.94, 0.93]) == "low"


def test_classify_low_when_best_below_threshold():
    assert classify_confidence([0.85, 0.40]) == "low"


def test_classify_high_single_strong_candidate():
    assert classify_confidence([0.97]) == "high"
