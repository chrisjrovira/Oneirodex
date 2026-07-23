"""Unit tests for folder label parsing (FitGirl tags, Steam App IDs). No DB required."""

from sharewarez.utils.game_name_parse import parse_game_label, strip_repack_tags


def test_fitgirl_repack_stripped():
    r = parse_game_label("Assassin's Creed Shadows [FitGirl Repack]")
    assert r['cleaned_name'] == "Assassin's Creed Shadows"
    assert r['steam_app_id'] is None


def test_fitgirl_hv_repack_stripped():
    r = parse_game_label("Borderlands 4 [FitGirl HV Repack]")
    assert "FitGirl" not in r['cleaned_name']
    assert "Repack" not in r['cleaned_name']
    assert "Borderlands 4" in r['cleaned_name']


def test_fitgirl_lowercase_tag():
    r = parse_game_label("Alan Wake 2 [Fitgirl Repack]")
    assert r['cleaned_name'] == "Alan Wake 2"
    assert r['steam_app_id'] is None


def test_steam_app_id_extracted_and_stripped():
    r = parse_game_label("barony (89881)")
    assert r['steam_app_id'] == 89881
    assert r['cleaned_name'].lower() == "barony"


def test_steam_app_id_with_fitgirl_not_typical_but_id_trailing():
    r = parse_game_label("Abandon Ship (81735)")
    assert r['steam_app_id'] == 81735
    assert "Abandon Ship" in r['cleaned_name']


def test_remastered_kept_for_disambiguation():
    r = parse_game_label("Alan Wake - Remastered [FitGirl Repack]")
    assert "Alan Wake" in r['cleaned_name']
    assert "Remastered" in r['cleaned_name'] or "Remaster" in r['cleaned_name']


def test_strip_repack_tags_alone():
    assert "[FitGirl" not in strip_repack_tags("Game [FitGirl HV Repack]")
    assert strip_repack_tags("Plain Game") == "Plain Game"


def test_raw_preserved():
    raw = "ctrl alt ego (89861)"
    r = parse_game_label(raw)
    assert r['raw'] == raw
    assert r['steam_app_id'] == 89861
