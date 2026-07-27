"""Unit tests for operator-owned patch catalog (no network)."""

from pathlib import Path

import pytest

from gametheca.utils.patch_catalog.local_yaml import (
    load_catalog_file,
    normalize_title,
    score_entry,
)
from gametheca.utils.patch_catalog.registry import (
    get_patch_provider,
    reset_patch_catalog_cache,
    search_all_patch_providers,
)
from gametheca.utils.patch_catalog.stub import StubRemotePatchCatalogProvider

FIXTURE = Path(__file__).parent / 'fixtures' / 'patch_catalog.json'


def test_normalize_and_score_titles():
    assert normalize_title('Final Fantasy III!') == 'final fantasy iii'
    entry = {'title': 'Final Fantasy', 'title_aliases': ['FF6', 'Final Fantasy III']}
    assert score_entry('final fantasy iii', entry) >= 70
    assert score_entry('chrono trigger', entry) == 0


def test_load_catalog_json_fixture():
    data = load_catalog_file(str(FIXTURE))
    assert data['version'] == 1
    assert len(data['entries']) == 2


def test_stub_provider_never_enabled():
    stub = StubRemotePatchCatalogProvider()
    assert stub.is_enabled() is False
    assert stub.search('anything') == []


def test_local_yaml_search_with_app(app, monkeypatch):
    reset_patch_catalog_cache()
    monkeypatch.setitem(app.config, 'ENABLE_PATCH_CATALOG', True)
    monkeypatch.setitem(app.config, 'PATCH_CATALOG_PATH', str(FIXTURE))
    with app.app_context():
        provider = get_patch_provider('local_yaml')
        assert provider.is_enabled() is True
        hits = provider.search('Final Fantasy III')
        assert len(hits) >= 1
        assert hits[0].source_url.startswith('https://example.test/')
        merged = search_all_patch_providers('Mother')
        assert merged == []  # not in fixture
        merged = search_all_patch_providers('Chrono')
        assert any(h.title == 'Chrono Trigger' for h in merged)


def test_local_disabled_without_flag(app, monkeypatch):
    reset_patch_catalog_cache()
    monkeypatch.setitem(app.config, 'ENABLE_PATCH_CATALOG', False)
    monkeypatch.setitem(app.config, 'PATCH_CATALOG_PATH', str(FIXTURE))
    with app.app_context():
        assert get_patch_provider('local_yaml').is_enabled() is False
        assert search_all_patch_providers('Final Fantasy') == []
