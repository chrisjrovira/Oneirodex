"""Icon pack registry unit tests."""

from __future__ import annotations

from pathlib import Path

from gametheca.utils.icon_themes import (
    BUILTIN_PACKS,
    CORE_ICON_KEYS,
    DRAWING_PACKS,
    PACK_CSS,
    PACK_GLYPH_KEYS,
    pack_glyph_override_css,
)

REPO = Path(__file__).resolve().parents[1]
SETUP = REPO / 'gametheca' / 'setup' / 'icon_themes'


def test_builtin_packs_have_css():
    assert len(BUILTIN_PACKS) >= 6
    for pack in BUILTIN_PACKS:
        assert pack['id'] in PACK_CSS
        assert 'gt-icon' in PACK_CSS[pack['id']] or pack['id'] == 'outline'


def test_core_icon_keys_cover_nav():
    for key in ('library', 'download', 'discover', 'settings', 'favorites'):
        assert key in CORE_ICON_KEYS


def test_setup_icon_themes_seeded():
    for pack in BUILTIN_PACKS:
        assert (SETUP / pack['id'] / 'manifest.json').is_file()
        assert (SETUP / pack['id'] / 'pack.css').is_file()
    assert (SETUP / 'previews.css').is_file()


def test_drawing_packs_ship_library_discover_systems_svgs():
    for pack_id in DRAWING_PACKS:
        for key in PACK_GLYPH_KEYS:
            svg = SETUP / pack_id / 'icons' / f'{key}.svg'
            assert svg.is_file(), svg
            text = svg.read_text(encoding='utf-8')
            assert '<svg' in text
        css = SETUP / pack_id / 'pack.css'
        body = css.read_text(encoding='utf-8')
        assert f'[data-icon="library"]' in body
        assert pack_glyph_override_css(pack_id) in PACK_CSS[pack_id]


def test_member_rail_icon_exposes_data_icon():
    text = (REPO / 'frontend' / 'member-app' / 'src' / 'chrome' / 'railIcons.jsx').read_text(
        encoding='utf-8'
    )
    assert 'data-icon={name}' in text
