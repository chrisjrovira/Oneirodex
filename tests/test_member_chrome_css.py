"""Member chrome contracts: rail size, pager, chromeless top-bar controls.

Filesystem-only — no app, no database.
"""

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
THEME = REPO_ROOT / 'gametheca' / 'setup' / 'default_theme' / 'css'


def _read(name: str) -> str:
    return (THEME / name).read_text(encoding='utf-8')


def _strip_comments(css: str) -> str:
    return re.sub(r'/\*.*?\*/', '', css, flags=re.DOTALL)


def _rule(css: str, selector: str) -> str:
    match = re.search(
        re.escape(selector) + r'\s*\{([^}]*)\}',
        css,
    )
    assert match, f'missing rule for {selector}'
    return match.group(1)


def _blocks_for(css: str, selector: str) -> str:
    """Bodies of every rule whose selector list includes `selector`."""
    css = _strip_comments(css)
    bodies = []
    for match in re.finditer(r'([^{}]+)\{([^}]*)\}', css):
        raw = match.group(1).strip()
        if raw.startswith('@'):
            continue
        parts = [part.strip() for part in raw.split(',')]
        if selector in parts:
            bodies.append(match.group(2))
    assert bodies, f'missing rule containing {selector!r}'
    return '\n'.join(bodies)


def test_expanded_rail_icons_are_unscaled_with_matching_labels():
    """Icons stay 1x the column; the column is readable; labels match."""
    density = _read('gt-density.css')
    shell = _read('gt-shell.css')
    assert '--gt-rail-icon-scale: 1;' in density
    assert '--gt-rail-icon-w: 1.125rem;' in density
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
    assert 'position: static' in body
    assert 'backdrop-filter' not in body or 'backdrop-filter: none' in body
    assert 'border-top' not in body
    assert 'border: 0' in body
    assert 'background: transparent' in body
    assert 'box-shadow: none' in body


def test_library_pager_moves_and_perpage_have_no_segment_box():
    """First/Previous/Next/Last and per-page are words, not a framed control."""
    css = _read('games/library_browser.css')
    moves = _blocks_for(css, '.gt-pagination__moves.gt-seg')
    assert 'border: 0' in moves
    assert 'background: transparent' in moves
    assert '1px solid' not in moves
    items = _blocks_for(css, '.gt-pagination__moves .btn-pagination')
    assert 'border: 0' in items
    assert 'background: transparent' in items
    hover = _blocks_for(
        css, '.gt-pagination__moves .btn-pagination:hover:not(:disabled)'
    )
    assert 'border: 0' in hover
    assert 'box-shadow: none' in hover
    perpage = _rule(css, '.dropdown-perpage')
    assert 'border: 0' in perpage
    assert 'backdrop-filter: none' in perpage
    assert 'container-glass' not in perpage
    assert '1px solid' not in perpage
    scoped = _blocks_for(css, '.gt-pagination .dropdown-perpage')
    assert 'border: 0' in scoped
    assert 'background: transparent' in scoped


def test_topbar_account_hamburger_and_filters_have_no_resting_outline():
    """Resting stroke is border: 0, not a transparent 1px that still boxes."""
    appbar = _read('gt-appbar.css')
    shell = _read('gt-shell.css')
    rest = _blocks_for(appbar, '.gt-cbtn.gt-topbar__account')
    assert 'border: 0' in rest
    assert 'background: transparent' in rest
    toggle = _blocks_for(appbar, '.gt-cbtn.gt-topbar__rail-toggle')
    assert 'border: 0' in toggle
    filters = _blocks_for(appbar, '.gt-topbar__cluster .gt-pop > .gt-cbtn')
    assert 'border: 0' in filters
    hover = _blocks_for(
        appbar,
        ".gt-cbtn.gt-topbar__account:hover:not(:disabled):not([aria-disabled='true'])",
    )
    assert 'border: 0' in hover
    assert 'background: color-mix' in hover
    focus = _rule(appbar, '.gt-cbtn:focus-visible')
    assert 'outline:' in focus
    avatar = _rule(shell, '.gt-topbar__account-avatar')
    assert 'box-shadow: none' in avatar
    expanded = _rule(shell, ".gt-topbar__account[aria-expanded='true']")
    assert 'border: 0' in expanded


def test_topbar_cluster_is_not_a_shared_outline():
    """Hamburger + Filters are adjacent, not one merged outlined box."""
    appbar = _read('gt-appbar.css')
    shell = _read('gt-shell.css')
    cluster = _rule(appbar, '.gt-cbtn-group.gt-topbar__cluster')
    assert 'gap:' in cluster
    child = _blocks_for(appbar, '.gt-cbtn-group.gt-topbar__cluster > .gt-cbtn')
    assert 'margin-inline-start: 0' in child
    assert 'border-radius: var(--gt-radius-sm)' in child
    filters = _rule(shell, '.gt-topbar__cluster .gt-pop > .gt-cbtn')
    assert 'margin-inline-start: -1px' not in filters
    assert 'margin-inline-start: 0' in filters
    assert 'border-radius: 0' not in filters


def test_tile_hover_has_no_accent_glow_and_grows_from_center():
    """Enlarge is scale + drop shadow; no coloured bloom; origin is the tile centre."""
    components = _strip_comments(_read('components.css'))
    hover = _blocks_for(components, '.game-card:hover')
    assert 'transform: scale(var(--gt-tile-hover-scale, 1.25))' in hover
    assert 'transform-origin: center center' in hover
    assert 'z-index: 40' in hover
    assert '0 0 33px' not in hover
    shadow = ';'.join(
        part for part in hover.split(';') if 'box-shadow' in part
    )
    assert 'var(--shadow-dark-strong)' in shadow
    assert 'var(--gt-accent)' not in shadow

    overlay = _rule(components, ".game-card[data-overlay-open='true']")
    assert 'z-index: 50' in overlay

    shell = _read('gt-shell.css')
    assert 'padding-block-start: max(var(--gt-stack), var(--gt-tile-hover-bleed-y))' in shell
    assert 'padding-inline: max(var(--gt-gutter), var(--gt-tile-hover-bleed-x))' in shell
    assert '#main-content.gt-shell__main:has(.gt-library-selection)' in shell
    assert 'padding-top: 0.15rem !important' in shell
    # Cover is 3:4 — upward growth tracks height; side growth tracks width.
    assert '* 4 / 3 *' in shell
    assert '--gt-tile-hover-bleed-y:' in shell
    assert '--gt-tile-hover-bleed-x:' in shell

    era = _read('gt-era.css')
    assert 'transform-origin: center center' in era
