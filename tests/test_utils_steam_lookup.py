"""Tests for Steam App ID title lookup (mocked HTTP)."""

from unittest.mock import MagicMock, patch

from sharewarez.utils.steam_lookup import fetch_steam_title_by_app_id


@patch('sharewarez.utils.steam_lookup.requests.get')
def test_fetch_steam_title_success(mock_get):
    mock_get.return_value = MagicMock(
        status_code=200,
        json=lambda: {'89881': {'success': True, 'data': {'name': 'Barony'}}},
    )
    assert fetch_steam_title_by_app_id(89881) == 'Barony'


@patch('sharewarez.utils.steam_lookup.requests.get')
def test_fetch_steam_title_missing_app(mock_get):
    mock_get.return_value = MagicMock(
        status_code=200,
        json=lambda: {'1': {'success': False}},
    )
    assert fetch_steam_title_by_app_id(1) is None


@patch('sharewarez.utils.steam_lookup.requests.get')
def test_fetch_steam_title_network_error(mock_get):
    import requests
    mock_get.side_effect = requests.RequestException('boom')
    assert fetch_steam_title_by_app_id(89881) is None


def test_fetch_steam_title_invalid_id():
    assert fetch_steam_title_by_app_id(0) is None
    assert fetch_steam_title_by_app_id(-5) is None
