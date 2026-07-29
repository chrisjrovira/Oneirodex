"""Unit tests for custom Discover zone helpers (no database required)."""

from gametheca.utils.discovery_zones import (
    FILTER_TYPES,
    MAX_MANUAL_GAMES,
    normalize_manual_uuids,
    validate_zone_config,
)


def test_normalize_manual_uuids_from_newline_and_comma_string():
    raw = "uuid-a\nuuid-b, uuid-c , uuid-d"
    assert normalize_manual_uuids(raw) == ["uuid-a", "uuid-b", "uuid-c", "uuid-d"]


def test_normalize_manual_uuids_from_list():
    assert normalize_manual_uuids([" uuid-x ", "uuid-y", "uuid-x"]) == ["uuid-x", "uuid-y"]


def test_normalize_manual_uuids_strips_empties_and_duplicates():
    raw = "\n  ,  \n dup \n dup \n unique \n"
    assert normalize_manual_uuids(raw) == ["dup", "unique"]


def test_normalize_manual_uuids_caps_at_max_manual_games():
    uuids = [f"uuid-{index:03d}" for index in range(MAX_MANUAL_GAMES + 10)]
    result = normalize_manual_uuids(uuids)
    assert len(result) == MAX_MANUAL_GAMES
    assert result[0] == "uuid-000"
    assert result[-1] == f"uuid-{MAX_MANUAL_GAMES - 1:03d}"


def test_normalize_manual_uuids_unknown_type_returns_empty():
    assert normalize_manual_uuids(None) == []
    assert normalize_manual_uuids(42) == []


def test_validate_zone_config_filter_rejects_invalid_filter_type():
    config, error = validate_zone_config(
        "filter",
        filter_type="invalid",
        filter_value="something",
    )
    assert config is None
    assert error == f"filter_type must be one of: {', '.join(FILTER_TYPES)}"


def test_validate_zone_config_filter_rejects_empty_filter_value():
    config, error = validate_zone_config(
        "filter",
        filter_type="library",
        filter_value="   ",
    )
    assert config is None
    assert error == "filter_value is required"


def test_validate_zone_config_filter_rejects_unknown_platform_before_db():
    config, error = validate_zone_config(
        "filter",
        filter_type="platform",
        filter_value="NOT_A_REAL_PLATFORM",
    )
    assert config is None
    assert error == 'Unknown platform "NOT_A_REAL_PLATFORM"'


def test_validate_zone_config_filter_accepts_valid_platform_without_db():
    config, error = validate_zone_config(
        "filter",
        filter_type="platform",
        filter_value="PCWIN",
    )
    assert error is None
    assert config == {
        "mode": "filter",
        "filter_type": "platform",
        "filter_value": "PCWIN",
    }


def test_validate_zone_config_rejects_invalid_mode():
    config, error = validate_zone_config("curated")
    assert config is None
    assert error == 'mode must be "manual" or "filter"'
