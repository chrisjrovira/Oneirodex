"""Unit tests for folder label parsing (FitGirl tags, Steam App IDs). No DB required."""

from gametheca.utils.game_name_parse import (
    parse_game_label,
    strip_repack_tags,
    strip_version_brackets,
    strip_build_tail,
    strip_vr_noise_tail,
)


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


def test_version_bracket_junk_stripped():
    r = parse_game_label("Some Game [1 0 4 1]")
    assert r['cleaned_name'] == "Some Game"
    assert "[1" not in r['cleaned_name']
    assert strip_version_brackets("Game [1.0.4.1]") == "Game"


def test_strip_repack_tags_alone():
    assert "[FitGirl" not in strip_repack_tags("Game [FitGirl HV Repack]")
    assert strip_repack_tags("Plain Game") == "Plain Game"


def test_raw_preserved():
    raw = "ctrl alt ego (89861)"
    r = parse_game_label(raw)
    assert r['raw'] == raw
    assert r['steam_app_id'] == 89861


# --- Real-folder regression fixtures (easy titles that were staying Unmatched) ---

def test_abyssus_fitgirl_repack():
    r = parse_game_label("Abyssus [FitGirl Repack]")
    assert r['cleaned_name'] == "Abyssus"
    assert r['steam_app_id'] is None


def test_assassins_creed_odyssey_hv_repack():
    r = parse_game_label("Assassin's Creed Odyssey [FitGirl HV Repack]")
    assert r['cleaned_name'] == "Assassin's Creed Odyssey"
    assert r['steam_app_id'] is None


def test_fishermans_tale_vr_stripped():
    r = parse_game_label("A Fishermans Tale VR")
    assert r['cleaned_name'] == "A Fishermans Tale"
    assert "VR" not in r['cleaned_name']


def test_agatha_christie_death_on_the_nile_lowercase_with_steam_id():
    r = parse_game_label("agatha christie death on the nile (85933)")
    assert r['steam_app_id'] == 85933
    assert r['cleaned_name'] == "Agatha Christie Death On The Nile"


def test_adr1ft_build_tail_and_alias():
    r = parse_game_label("ADR1FT (Build 14.09.2017)")
    assert r['cleaned_name'] == "Adrift"
    assert r['steam_app_id'] is None


def test_alone_in_the_dark_2024_unaffected():
    r = parse_game_label("Alone in the Dark 2024")
    assert r['cleaned_name'] == "Alone In The Dark 2024"
    assert r['steam_app_id'] is None


def test_alien_isolation_vr_mod_mothervr_tail_stripped():
    r = parse_game_label("Alien Isolation VR MOD - MotherVR 0 8 1")
    assert r['cleaned_name'] == "Alien Isolation"
    assert "VR" not in r['cleaned_name']
    assert "MotherVR" not in r['cleaned_name']


def test_strip_build_tail_alone():
    assert strip_build_tail("ADR1FT (Build 14.09.2017)") == "ADR1FT"
    assert strip_build_tail("Plain Game") == "Plain Game"


def test_strip_vr_noise_tail_alone():
    assert strip_vr_noise_tail("A Fishermans Tale VR") == "A Fishermans Tale"
    assert strip_vr_noise_tail("Alien Isolation VR MOD - MotherVR 0 8 1") == "Alien Isolation"
    assert strip_vr_noise_tail("Plain Game") == "Plain Game"
