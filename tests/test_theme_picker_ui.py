"""The theme picker's swatch colours and markup.

Swatch chips are hardcoded in CSS because they must render on pages whose view
functions we do not control, so this module pins every one of them to the
Python definitions in gametheca.utils.preset_themes — the source of truth for
what accent a theme actually ships with.  These tests are file-only: no app,
no database.
"""

import re
from pathlib import Path

import pytest

from gametheca.utils.preset_themes import PRESET_SLUGS, PRESET_THEMES, preset_tokens

REPO_ROOT = Path(__file__).resolve().parents[1]
THEME_SOURCE = REPO_ROOT / 'gametheca' / 'setup' / 'default_theme'
FORM_COMPONENTS_CSS = THEME_SOURCE / 'css' / 'form-components.css'
GT_TOKENS_CSS = THEME_SOURCE / 'css' / 'gt-tokens.css'
TEMPLATES = REPO_ROOT / 'gametheca' / 'templates'


def read(path: Path) -> str:
    return path.read_text(encoding='utf-8')


def swatch_colours() -> dict:
    """Every `.theme-swatch-<slug>` fill colour in the CSS.

    Chip rules define `--gt-swatch-fill` (a token) and paint `background` from
    it, so css-token-lint treats the hex as a definition rather than a use.
    """
    colours = {}
    for match in re.finditer(
        r'\.theme-swatch-([a-z0-9_-]+)\s*\{([^}]*)\}',
        read(FORM_COMPONENTS_CSS),
    ):
        slug, body = match.group(1), match.group(2)
        fill = re.search(r'--gt-swatch-fill:\s*(#[0-9a-fA-F]{3,8})', body)
        if fill:
            colours[slug] = fill.group(1).strip().lower()
    return colours


def default_accent() -> str:
    match = re.search(r'--gt-accent:\s*([^;]+);', read(GT_TOKENS_CSS))
    assert match, '--gt-accent missing from gt-tokens.css'
    return match.group(1).strip().lower()


@pytest.mark.parametrize('preset', PRESET_THEMES, ids=[p['slug'] for p in PRESET_THEMES])
def test_preset_swatch_matches_the_generated_accent(preset):
    """A swatch must be painted the accent its theme is generated with."""
    expected = preset_tokens(preset)['gt-accent'].lower()

    assert swatch_colours().get(preset['slug']) == expected


def test_default_swatch_matches_the_default_theme_accent():
    assert swatch_colours().get('default') == default_accent()


def test_every_theme_has_exactly_one_swatch_rule():
    """No orphan rules for removed themes, no preset left without a chip."""
    painted = set(swatch_colours()) - {'chip', 'grid', 'label'}

    assert painted == {'default', *PRESET_SLUGS}


def test_swatch_colours_are_the_only_hex_literals_in_form_components():
    css = read(FORM_COMPONENTS_CSS)
    swatch_block = css[css.index('=== THEME SWATCH PICKER ==='):]
    non_swatch = css[:css.index('=== THEME SWATCH PICKER ===')]

    assert not re.search(r'#[0-9a-fA-F]{3,8}\b', non_swatch)
    hexes = re.findall(r'#[0-9a-f]{6}\b', swatch_block)
    assert sorted(hexes) == sorted(swatch_colours().values())


def test_preferences_modal_renders_selectable_swatches():
    html = read(TEMPLATES / 'settings' / 'modal_preferences.html')

    assert 'id="themeSwatchGrid"' in html
    assert 'data-theme="{{ item.slug }}"' in html
    assert 'theme_picker_groups' in html
    assert 'theme-card-preview' in html
    # Dict groups: `group.items` is the bound method, not the list.
    assert "group['items']" in html
    assert 'for item in group.items' not in html
    # Selection is server-rendered too, so the picker reads correctly even
    # before any JavaScript touches it.
    assert "form.theme.data == item.slug" in html


def test_admin_manage_themes_sends_you_to_preferences_to_choose():
    """This page used to carry its own swatch grid writing `preferences.theme`,
    duplicating Preferences and giving two answers to "which theme is selected".
    Retired — but the page must still say where choosing happens, or the
    affordance is simply missing rather than moved."""
    html = read(TEMPLATES / 'admin' / 'admin_manage_themes.html')

    assert 'adminThemeGrid' not in html
    assert 'apply_theme' not in html
    assert 'settings.settings_panel' in html
