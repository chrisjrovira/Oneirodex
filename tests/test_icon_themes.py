"""Icon pack registry unit tests."""

from __future__ import annotations

from gametheca.utils.icon_themes import BUILTIN_PACKS, PACK_CSS, CORE_ICON_KEYS


def test_builtin_packs_have_css():
    assert len(BUILTIN_PACKS) >= 6
    for pack in BUILTIN_PACKS:
        assert pack['id'] in PACK_CSS
        assert 'gt-icon' in PACK_CSS[pack['id']] or pack['id'] == 'outline'


def test_core_icon_keys_cover_nav():
    for key in ('library', 'download', 'discover', 'settings', 'favorites'):
        assert key in CORE_ICON_KEYS


def test_setup_icon_themes_seeded():
    from pathlib import Path
    root = Path(__file__).resolve().parents[1] / 'gametheca' / 'setup' / 'icon_themes'
    for pack in BUILTIN_PACKS:
        assert (root / pack['id'] / 'manifest.json').is_file()
        assert (root / pack['id'] / 'pack.css').is_file()
