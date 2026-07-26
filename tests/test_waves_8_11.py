"""Waves 8–11 unit tests (no DB)."""

from gametheca.utils.acquire_scoring import rank_acquire_hits, score_acquire_hit, title_looks_like_newer_repack
from gametheca.utils.frontend_export import build_es_de_gamelist, build_pegasus_metadata
from gametheca.utils.plugins import get_plugin, list_plugins


def test_acquire_scoring_ranks_seeders_and_gog():
    hits = [
        {'title': 'Some Game Crack Only', 'seeders': 1, 'size': 1000},
        {'title': 'Some Game GOG Repack', 'seeders': 40, 'size': 4 * 1024 ** 3},
    ]
    ranked = rank_acquire_hits(hits, query='Some Game')
    assert ranked[0]['title'].startswith('Some Game GOG')
    assert ranked[0]['score'] > ranked[1]['score']
    assert score_acquire_hit(hits[1], query='Some Game')['is_repack'] is True


def test_newer_repack_heuristic():
    assert title_looks_like_newer_repack('Game FitGirl Repack', 'Game') is True
    assert title_looks_like_newer_repack('Game', 'Game') is False


def test_esde_and_pegasus_export():
    games = [{'name': 'Alpha', 'path': './alpha.nes', 'uuid': 'u1', 'summary': 'A'}]
    xml = build_es_de_gamelist(games, system='NES')
    assert b'<gameList>' in xml
    assert b'Alpha' in xml
    text = build_pegasus_metadata(games, collection='NES')
    assert 'collection: NES' in text
    assert 'game: Alpha' in text


def test_plugin_registry():
    plugins = list_plugins()
    assert len(plugins) >= 10
    assert get_plugin('emu.webretro')['name'] == 'WebRetro'
    assert get_plugin('missing') is None
