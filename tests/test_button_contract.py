"""One button contract across the chrome and the primitives (W27-C1).

Admin and member both render `.od-cbtn` — the small chrome button in the app
bar, context bar and rail — while `.od-btn` is the general primitive. They are
allowed to differ in size and weight; they are not allowed to disagree about
what a button *does*, and they did:

* `.od-cbtn` had no disabled state at all. Notifications disables "Mark all
  read" when nothing is unread, Updates disables refresh while refreshing, and
  Collection detail disables delete mid-delete — none of which looked any
  different from a live button, and all of which still lit up on hover.
* Ops had patched the gap locally for its reorder arrows, so the one place that
  noticed fixed it for itself and nowhere else. That per-page divergence is the
  thing this item is about.
* The two used different focus treatments — different colour, different offset.

These are source assertions over CSS. They cannot prove a button *looks* right;
they pin the rules whose absence caused the defects above, which is the part
that regressed silently. No database needed.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
THEME_CSS = ROOT / 'oneirodex' / 'setup' / 'default_theme' / 'css'

APPBAR = THEME_CSS / 'od-appbar.css'
PRIMITIVES = THEME_CSS / 'od-primitives.css'
OPS = ROOT / 'frontend' / 'admin-app' / 'src' / 'ops.css'


def _read(path: Path) -> str:
    return path.read_text(encoding='utf-8')


def _without_comments(css: str) -> str:
    """Rules only — a comment explaining a moved rule is not the rule."""
    return re.sub(r'/\*.*?\*/', '', css, flags=re.DOTALL)


def _rule_block(css: str, selector: str) -> str:
    """Declarations of the first rule that lists `selector` as a whole selector.

    Substring match was matching `a.od-cbtn:focus-visible { text-decoration }`
    when the test wanted `.od-cbtn:focus-visible { outline: … }`.
    """
    body = _without_comments(css)
    for match in re.finditer(r'([^{}]+)\{([^{}]*)\}', body):
        selectors = [part.strip() for part in match.group(1).split(',')]
        if selector in selectors:
            return match.group(2)
    raise AssertionError(f'no rule found for {selector}')


def test_the_chrome_button_has_a_disabled_state():
    """Its absence is why a disabled 'Mark all read' looked clickable."""
    css = _without_comments(_read(APPBAR))
    assert '.od-cbtn:disabled' in css
    assert ".od-cbtn[aria-disabled='true']" in css

    block = _rule_block(css, '.od-cbtn:disabled')
    assert 'cursor: default' in block
    assert 'opacity' in block


def test_the_chrome_button_does_not_react_to_hover_when_disabled():
    """A control that lights up under the mouse and then refuses to act is
    worse than one that never invited the click."""
    css = _without_comments(_read(APPBAR))
    hover = re.search(
        r"\.od-cbtn:hover:not\(:disabled\):not\(\[aria-disabled='true'\]\)\s*\{",
        css,
    )
    assert hover, 'the disabled-guarded hover rule vanished'


def test_both_button_families_share_one_focus_treatment():
    """Two focus rings in one product is the inconsistency this item names.
    Size and weight may differ between chrome and primitive buttons; which ring
    a keyboard user sees may not."""
    chrome = _rule_block(_read(APPBAR), '.od-cbtn:focus-visible')
    primitive = _rule_block(_read(PRIMITIVES), '.od-btn:focus-visible')

    for block in (chrome, primitive):
        assert '--od-focus-ring' in block
        assert 'outline-offset: 2px' in block


def test_the_focus_ring_survives_a_theme_without_the_token():
    """An undefined custom property invalidates the whole declaration at
    computed-value time, so a bare var() would remove the outline rather than
    degrade it. That failure has already happened once in this codebase."""
    for path, selector in ((APPBAR, '.od-cbtn:focus-visible'), (PRIMITIVES, '.od-btn:focus-visible')):
        block = _rule_block(_read(path), selector)
        assert re.search(r'var\(--od-focus-ring,\s*[^)]+\)', block), path.name


def test_ops_does_not_keep_its_own_copy_of_the_disabled_rule():
    """It only ever had one because it was the first place a .od-cbtn was
    disabled. Leaving it would mean two definitions to keep in step."""
    assert 'od-cbtn:disabled' not in _without_comments(_read(OPS))


# --------------------------------------------------------------------------
# Focus visibility
# --------------------------------------------------------------------------

# Controls that removed their focus outline and put nothing back, so they were
# invisible to a keyboard. Each is pinned by name rather than by a blanket scan:
# `outline: none` is legitimate when a real replacement follows, and roughly a
# dozen inputs here do exactly that with a box-shadow ring. A blanket rule would
# either fail on those or be watered down until it caught nothing.
REPAIRED = [
    (THEME_CSS / 'admin' / 'admin_manage_igdb_settings.css', '.toggle-password'),
    (THEME_CSS / 'form-components.css', '.toggle-password'),
    (THEME_CSS / 'admin' / 'admin-shell.css', '.admin-topbar-link'),
    (THEME_CSS / 'admin' / 'admin_manage_themes.css', '.od-themes-link'),
    (THEME_CSS / 'admin' / 'admin_manage_scanjobs.css', '.scan-jobs-filter-chip'),
    (THEME_CSS / 'settings' / 'od-account.css', '.od-account-nav a'),
    (THEME_CSS / 'od-loading-motifs.css', '.od-loading-motif--preview'),
]


def _focus_blocks(css: str, selector: str) -> list[str]:
    """Every :focus-visible rule matching this selector, not just the first.

    These controls deliberately keep two: the shared block with :hover for the
    tint, and a dedicated one for the ring. Reading only the first finds the
    tint and concludes there is no outline — which is what the first version of
    this test did.
    """
    pattern = re.compile(re.escape(selector) + r':focus-visible[^{},]*(?:,[^{]*)?\{([^}]*)\}')
    return [m.group(1) for m in pattern.finditer(_without_comments(css))]


def test_repaired_controls_have_a_focus_ring():
    """Each of these either killed the outline outright or shared one rule with
    :hover, so the focused control looked exactly like the hovered one."""
    for path, selector in REPAIRED:
        blocks = _focus_blocks(_read(path), selector)
        assert blocks, f'{path.name}: no :focus-visible rule for {selector}'

        outlines = [b for b in blocks if 'outline:' in b]
        assert outlines, f'{path.name}: {selector} sets no outline on focus'
        for block in outlines:
            assert 'outline: none' not in block, (
                f'{path.name}: {selector} still clears its outline'
            )


def test_repaired_controls_use_the_shared_ring():
    """One ring across the product, and the fallback for the same reason as
    .od-btn: a bare var() would remove the outline on a theme missing the token
    rather than degrade it."""
    for path, selector in REPAIRED:
        blocks = _focus_blocks(_read(path), selector)
        assert any(
            re.search(r'var\(--od-focus-ring,\s*[^)]+\)', b) for b in blocks
        ), f'{path.name}: {selector} does not use the shared ring'
