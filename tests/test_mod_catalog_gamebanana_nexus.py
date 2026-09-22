"""INSP-22 / H2c: GameBanana (keyless) and Nexus Mods (browse behind
NEXUS_API_KEY) as catalogue sources. Mocked transport only."""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

import pytest

from oneirodex.utils.mod_catalog import catalog_search, gamebanana, nexus, source_configured, source_ids

GB_MATCH = {'_aRecords': [{'_idRow': 8694, '_sName': 'Sonic Mania'}, {'_idRow': 1, '_sName': 'Sonic Mania Plus'}]}
GB_FEED = {
    '_aRecords': [
        {
            '_idRow': 1,
            '_sModelName': 'Mod',
            '_sName': 'Classic Heroes',
            '_sProfileUrl': 'https://gamebanana.com/mods/1',
            '_sVersion': '1.4',
            '_sDescription': 'Play as the classic trio',
            '_aSubmitter': {'_sName': 'someone'},
            '_aRootCategory': {'_sName': 'Skins'},
            '_nDownloadCount': 1234,
            '_tsDateModified': 1735689600,
        },
        {'_idRow': 2, '_sModelName': 'Sound', '_sName': 'A sound', '_sProfileUrl': 'https://gamebanana.com/sounds/2'},
        {'_idRow': 3, '_sModelName': 'Mod', '_sName': 'No URL'},
        {'_idRow': 4, '_sModelName': 'Mod', '_sName': 'Level Pack', '_sProfileUrl': 'https://gamebanana.com/mods/4'},
    ]
}
NX_GAMES = [
    {'domain_name': 'skyrimspecialedition', 'name': 'Skyrim Special Edition'},
    {'domain_name': 'stardewvalley', 'name': 'Stardew Valley'},
]
NX_TRENDING = [
    {'mod_id': 266, 'name': 'SkyUI', 'version': '5.2', 'summary': 'Interface', 'author': 'schlangster',
     'mod_downloads': 99, 'updated_timestamp': 1735689600, 'status': 'published', 'available': True},
    {'mod_id': 1, 'name': 'Hidden', 'status': 'hidden'},
]
NX_LATEST = [
    {'mod_id': 266, 'name': 'SkyUI', 'version': '5.2', 'status': 'published'},
    {'mod_id': 500, 'name': 'New Thing', 'version': '0.1', 'summary': 'fresh', 'status': 'published'},
]


def _resp(payload, status=200):
    return SimpleNamespace(status_code=status, json=lambda: payload)


@pytest.fixture
def live(monkeypatch):
    monkeypatch.setenv('MOD_CATALOG_IN_TESTS', '1')
    monkeypatch.delenv('ENABLE_MOD_CATALOG', raising=False)
    monkeypatch.delenv('NEXUS_API_KEY', raising=False)
    gamebanana._GAMES.clear()
    nexus._GAMES = None
    yield
    gamebanana._GAMES.clear()
    nexus._GAMES = None


def test_gamebanana_resolves_the_game_and_keeps_only_mods(app, live):
    def fake(method, url, **kw):
        if url.endswith('/Util/Game/NameMatch'):
            assert kw['params']['_sName'] == 'Sonic Mania'
            return _resp(GB_MATCH)
        assert '/Game/8694/Subfeed' in url and kw['params']['_csvModelInclusions'] == 'Mod'
        return _resp(GB_FEED)

    with app.app_context(), patch.object(gamebanana, 'safe_request', side_effect=fake):
        hits = gamebanana.search('Sonic Mania')
        filtered = gamebanana.search('Sonic Mania', query='level')
    assert hits is not None and [h.name for h in hits] == ['Classic Heroes', 'Level Pack']
    first = hits[0]
    assert first.url == 'https://gamebanana.com/mods/1' and first.author == 'someone'
    assert first.categories == ['Skins'] and first.updated == '2025-01-01' and first.downloads == 1234
    assert first.loader == ''
    assert [h.name for h in filtered] == ['Level Pack']


def test_gamebanana_none_without_a_page_or_answer(app, live):
    with app.app_context(), patch.object(gamebanana, 'safe_request', return_value=_resp({'_aRecords': []})):
        assert gamebanana.search('Unknown Game') is None
    with app.app_context(), patch.object(gamebanana, 'safe_request', side_effect=OSError('offline')):
        assert gamebanana.search('Sonic Mania') is None


def test_nexus_is_unavailable_without_a_key(app, live):
    assert source_configured('nexus') is False
    with app.app_context(), patch.object(nexus, 'safe_request') as req:
        assert nexus.search('Skyrim Special Edition') is None
        result = catalog_search('nexus', 'Skyrim Special Edition')
        req.assert_not_called()
    assert result['status'] == 'unavailable' and result['hits'] is None
    assert 'NEXUS_API_KEY' in result['note']


def test_nexus_browses_trending_then_latest_with_the_key_in_a_header(app, live, monkeypatch):
    monkeypatch.setenv('NEXUS_API_KEY', 'nx-secret')
    assert source_configured('nexus') is True
    calls = []

    def fake(method, url, **kw):
        calls.append(url)
        assert kw['headers']['apikey'] == 'nx-secret'
        if url.endswith('/v1/games.json'):
            return _resp(NX_GAMES)
        if url.endswith('/trending.json'):
            return _resp(NX_TRENDING)
        return _resp(NX_LATEST)

    with app.app_context(), patch.object(nexus, 'safe_request', side_effect=fake):
        hits = nexus.search('Skyrim Special Edition')
    assert hits is not None and [h.name for h in hits] == ['SkyUI', 'New Thing']
    assert hits[0].url == 'https://www.nexusmods.com/skyrimspecialedition/mods/266'
    assert hits[0].updated == '2025-01-01' and hits[0].author == 'schlangster'
    assert any('/games/skyrimspecialedition/mods/trending.json' in u for u in calls)
    assert not any('nx-secret' in u for u in calls)
    with app.app_context(), patch.object(nexus, 'safe_request', side_effect=fake):
        assert nexus.search('Some Other Game') is None
        assert [h.name for h in nexus.search('Stardew Valley', query='zzz')] == []


def test_all_four_sources_are_registered(app, live):
    assert source_ids() == ['thunderstore', 'modrinth', 'gamebanana', 'nexus']
    for sid in ('thunderstore', 'modrinth', 'gamebanana'):
        assert source_configured(sid) is True
