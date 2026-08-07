"""The two-bar chrome must look identical in React and in Jinja (UIR-4).

Admin's page bodies are Jinja and the member SPA is React, and the two builds
cannot import from each other. So the *stylesheet* is the shared artifact and
both renderers emit the same class names against it.

That arrangement only holds if the class names stay in step. Renaming
`gt-seg__item` in one place and not the other would not break either build, it
would just quietly make admin look different again — which is precisely the
drift this refresh exists to end. These tests fail instead.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
CSS = ROOT / 'gametheca' / 'setup' / 'default_theme' / 'css' / 'gt-appbar.css'
JINJA = ROOT / 'gametheca' / 'templates' / 'partials' / 'chrome.html'
REACT = ROOT / 'frontend' / 'member-app' / 'src' / 'chrome' / 'ContextBar.jsx'

# The contract: every class the context bar is built from.
CONTEXT_BAR_CLASSES = (
    'gt-contextbar',
    'gt-contextbar__views',
    'gt-contextbar__actions',
    'gt-contextbar__count',
    'gt-seg',
    'gt-seg__item',
)


def _read(path: Path) -> str:
    return path.read_text(encoding='utf-8')


@pytest.mark.parametrize('css_class', CONTEXT_BAR_CLASSES)
def test_class_is_defined_in_the_shared_stylesheet(css_class):
    assert f'.{css_class}' in _read(CSS), (
        f'{css_class} is used by a renderer but has no rule in gt-appbar.css'
    )


@pytest.mark.parametrize('css_class', CONTEXT_BAR_CLASSES)
def test_both_renderers_emit_the_class(css_class):
    jinja, react = _read(JINJA), _read(REACT)
    assert css_class in jinja, f'Jinja macro is missing {css_class}'
    assert css_class in react, f'React ContextBar is missing {css_class}'


def test_stylesheet_is_linked_by_every_shell():
    """A shell that forgets the link renders the bars unstyled."""
    for shell in ('base.html', 'base_empty.html', 'base_admin.html'):
        markup = _read(ROOT / 'gametheca' / 'templates' / shell)
        assert 'gt-appbar.css' in markup, f'{shell} does not link gt-appbar.css'


def test_v2_marker_is_set_by_the_jinja_shells():
    """Page-header retirement keys off data-chrome; without it admin keeps its
    headings while the member SPA loses them — the exact mismatch to avoid."""
    for shell in ('base.html', 'base_admin.html'):
        markup = _read(ROOT / 'gametheca' / 'templates' / shell)
        assert 'data-chrome="v2"' in markup, f'{shell} never sets the v2 marker'
        assert 'enable_new_chrome' in markup, f'{shell} sets the marker unconditionally'


def test_no_theme_ships_its_own_copy_of_the_chrome_stylesheet():
    """gt-appbar.css relies on theme_asset falling back to `default`, which only
    happens while no installed theme owns the file. If a preset ever ships one,
    that theme silently freezes at whatever the CSS looked like that day."""
    themes = ROOT / 'gametheca' / 'static' / 'library' / 'themes'
    if not themes.is_dir():
        pytest.skip('themes not installed in this checkout')
    owned = [p for p in themes.glob('*/css/gt-appbar.css') if p.parent.parent.name != 'default']
    assert not owned, (
        'These themes ship their own gt-appbar.css and will not track changes: '
        + ', '.join(p.parent.parent.name for p in owned)
    )


def test_jinja_views_are_links_not_buttons():
    """In Jinja a view switch is a navigation. Rendering it as a <button> would
    break middle-click, open-in-new-tab and copy-link for no benefit."""
    macro = _read(JINJA)
    seg = macro[macro.index('gt-seg__item'):]
    assert '<a class="gt-seg__item' in macro or 'a class="gt-seg__item' in seg
    assert 'href=' in seg
