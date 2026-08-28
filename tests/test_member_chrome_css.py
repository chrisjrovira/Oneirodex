"""Member chrome contracts: rail size, pager, chromeless top-bar controls.

Filesystem-only — no app, no database.
"""

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
THEME = REPO_ROOT / 'gametheca' / 'setup' / 'default_theme' / 'css'


def _read(name: str) -> str:
    return (THEME / name).read_text(encoding='utf-8')


def _rule(css: str, selector: str) -> str:
    match = re.search(
        re.escape(selector) + r'\s*\{([^}]*)\}',
        css,
    )
    assert match, f'missing rule for {selector}'
    return match.group(1)


def test_expanded_rail_icons_are_unscaled_with_matching_labels():
    """Icons stay 1x the column; the column itself is small; labels match."""
    density = _read('gt-density.css')
    shell = _read('gt-shell.css')
    assert '--gt-rail-icon-scale: 1;' in density
    assert '--gt-rail-icon-w: 0.7rem;' in density
    assert 'font-size: var(--gt-font-xs)' in _rule(shell, '.gt-rail__link')
    assert 'var(--gt-rail-icon-scale, 1)' in shell
    assert 'var(--gt-rail-icon-scale, 1.8)' not in shell


def test_expanded_brand_mark_is_independent_of_the_icon_column():
    """Shrinking destination glyphs must not shrink the logo."""
    density = _read('gt-density.css')
    shell = _read('gt-shell.css')
    assert '--gt-rail-mark-expanded: 5.5rem;' in density
    body = _rule(shell, '.gt-rail__brand--mark-only .gt-rail__mark')
    assert '--gt-rail-mark-expanded' in body
    assert 'var(--gt-rail-icon-w)' not in body


def test_library_pager_stays_at_the_foot_without_following_or_a_surface():
    """Pager is the library footer, not a sticky overlay with glass chrome."""
    css = _read('games/library_browser.css')
    body = _rule(css, '.pagination-controls')
    assert 'position: sticky' not in body
    assert 'backdrop-filter' not in body
    assert 'border-top' not in body
    assert 'background: transparent' in body or 'background: none' in body


def test_topbar_account_hamburger_and_filters_have_no_resting_outline():
    appbar = _read('gt-appbar.css')
    shell = _read('gt-shell.css')
    blob = appbar + '\n' + shell
    assert '.gt-cbtn.gt-topbar__account' in blob
    assert '.gt-cbtn.gt-topbar__rail-toggle' in blob
    assert 'border-color: transparent' in blob
    avatar = _rule(shell, '.gt-topbar__account-avatar')
    assert 'box-shadow: none' in avatar
