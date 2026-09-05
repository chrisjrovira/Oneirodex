"""The two-bar chrome must look identical in React and in Jinja (UIR-4).

Admin's page bodies are Jinja and the member SPA is React, and the two builds
cannot import from each other. So the *stylesheet* is the shared artifact and
both renderers emit the same class names against it.

That arrangement only holds if the class names stay in step. Renaming
`od-seg__item` in one place and not the other would not break either build, it
would just quietly make admin look different again — which is precisely the
drift this refresh exists to end. These tests fail instead.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
CSS = ROOT / 'oneirodex' / 'setup' / 'default_theme' / 'css' / 'od-appbar.css'
JINJA = ROOT / 'oneirodex' / 'templates' / 'partials' / 'chrome.html'
REACT = ROOT / 'frontend' / 'member-app' / 'src' / 'chrome' / 'ContextBar.jsx'

# The contract: every class the context bar is built from.
CONTEXT_BAR_CLASSES = (
    'od-contextbar',
    'od-contextbar__views',
    'od-contextbar__actions',
    'od-contextbar__count',
    'od-seg',
    'od-seg__item',
)


def _read(path: Path) -> str:
    return path.read_text(encoding='utf-8')


@pytest.mark.parametrize('css_class', CONTEXT_BAR_CLASSES)
def test_class_is_defined_in_the_shared_stylesheet(css_class):
    assert f'.{css_class}' in _read(CSS), (
        f'{css_class} is used by a renderer but has no rule in od-appbar.css'
    )


@pytest.mark.parametrize('css_class', CONTEXT_BAR_CLASSES)
def test_both_renderers_emit_the_class(css_class):
    jinja, react = _read(JINJA), _read(REACT)
    assert css_class in jinja, f'Jinja macro is missing {css_class}'
    assert css_class in react, f'React ContextBar is missing {css_class}'


def test_admin_react_pages_retire_their_titles_too():
    """base_admin.html has always set the v2 marker, so the admin SPA inherited
    it and none of the effect — member pages lost their headings while every
    admin h1 stayed. "Library and admin should look the same" is the point of
    the refresh, and that was the most visible way to fail it."""
    css = _read(CSS)
    assert ":root[data-chrome='v2'] .od-admin-page > h1" in css
    assert ":root[data-chrome='v2'] .od-admin-page > .od-admin-lede" in css


def test_stylesheet_is_linked_by_every_shell():
    """A shell that forgets the link renders the bars unstyled."""
    for shell in ('base.html', 'base_empty.html', 'base_admin.html'):
        markup = _read(ROOT / 'oneirodex' / 'templates' / shell)
        assert 'od-appbar.css' in markup, f'{shell} does not link od-appbar.css'


def test_v2_marker_is_set_by_the_jinja_shells():
    """Page-header retirement keys off data-chrome; without it admin keeps its
    headings while the member SPA loses them — the exact mismatch to avoid."""
    for shell in ('base.html', 'base_admin.html'):
        markup = _read(ROOT / 'oneirodex' / 'templates' / shell)
        assert 'data-chrome="v2"' in markup, f'{shell} never sets the v2 marker'
        assert 'enable_new_chrome' in markup, f'{shell} sets the marker unconditionally'


def test_the_chrome_stylesheet_stays_syncable_into_every_theme():
    """Every theme must keep tracking edits to od-appbar.css.

    Two mechanisms carry it there: `theme_asset` falls back to `default` when a
    theme has no copy, and `sync_preset_themes` overwrites any copy whose
    content has drifted. Both work — *unless* the file is listed in
    PRESET_MANAGED_FILES, which is the opt-out for files a preset legitimately
    owns (its colours). od-appbar.css there would freeze all nine presets at
    whatever the CSS looked like the day they were installed.

    Note this deliberately does not inspect static/library/themes: that tree is
    generated at boot and every preset holding a synced copy is correct.
    """
    from oneirodex.utils.preset_themes import PRESET_MANAGED_FILES

    assert 'css/od-appbar.css' not in PRESET_MANAGED_FILES, (
        'od-appbar.css is protected from theme sync — presets will not track '
        'changes to the shared chrome'
    )
    # And the only tracked source of it is the default theme, so there is one
    # place to edit.
    sources = sorted((ROOT / 'oneirodex' / 'setup').glob('*/css/od-appbar.css'))
    assert [p.parent.parent.name for p in sources] == ['default_theme']


SCANJOBS = ROOT / 'oneirodex' / 'templates' / 'admin' / 'admin_manage_scanjobs.html'


def test_in_page_views_stay_in_page():
    """Libraries & scans is one document with eight panes, so its segments must
    keep Bootstrap's client-side switch. Turning them into real navigations to
    gain a prettier strip would trade a working feature for a cosmetic one."""
    markup = _read(SCANJOBS)
    assert "data_toggle='tab'" in markup, 'scan management views became page loads'
    assert 'data_toggle' in _read(JINJA), 'the macro no longer supports in-page views'


def test_in_page_views_satisfy_what_bootstrap_actually_binds_to():
    """Both of these were checked against the vendored bootstrap 5.3.2 bundle.

    The plugin binds via `closest('.list-group, .nav, [role="tablist"]')` and
    silently does nothing when that misses, and `_getActiveElem()` keys off
    Bootstrap's own `active` class to find the pane to hide. A segmented strip
    that renders beautifully and switches nothing is the failure mode here, and
    it produces no console error to point at.
    """
    macro = _read(JINJA)
    assert "'tablist' if data_toggle else 'group'" in macro
    # Selection is marked with Bootstrap's class in tab mode, not ours: the
    # plugin moves `active` on every switch and never touches `is-active`,
    # which would leave the highlight welded to the first segment while the
    # panes changed underneath it. Confirmed in a browser, not assumed.
    assert "{{ ' active' if data_toggle else ' is-active' }}" in macro
    assert '.od-seg__item.active' in _read(CSS), (
        'the stylesheet no longer styles the class bootstrap actually sets'
    )

    bundle = ROOT / 'oneirodex' / 'static' / 'vendor' / 'bootstrap' / '5.3.2' / 'js'
    bundle = bundle / 'bootstrap.bundle.min.js'
    if not bundle.is_file():
        pytest.skip('bootstrap bundle not vendored in this checkout')
    source = _read(bundle)
    # If a future bump changes either contract, this test should fail loudly
    # rather than let the strip quietly stop working.
    assert '.list-group, .nav, [role="tablist"]' in source
    assert 'Fs="active"' in source


INTEGRATIONS = ROOT / 'oneirodex' / 'templates' / 'admin' / 'integrations.html'
INTEGRATIONS_JS = (
    ROOT / 'oneirodex' / 'setup' / 'default_theme' / 'js' / 'integrations_tabs.js'
)


def test_integrations_keeps_the_ids_its_controller_and_aria_depend_on():
    """integrations_tabs.js restores the open tab from the URL fragment via
    getElementById, and every pane's aria-labelledby points at a trigger id.
    Rendering bar two without those ids opens the page with no pane at all —
    silently, since a missing element is just a no-op there."""
    markup = _read(INTEGRATIONS)
    for anchor_id in ('email-tab', 'igdb-tab', 'community-tab', 'artwork-tab', 'oidc-tab'):
        assert f"'{anchor_id}'" in markup, f'{anchor_id} no longer reaches the context bar'
    assert "views_id='integrationTabs'" in markup, (
        'the controller scopes its query to #integrationTabs'
    )
    assert 'view[3]' in _read(JINJA), 'the macro can no longer carry an anchor id'


def test_the_integrations_controller_reads_either_strip():
    """Old triggers are `<button data-bs-target>`, bar two's are `<a href>`.
    A selector naming `button`, or a read of only `data-bs-target`, works for
    exactly one of them — and the flag means both must work."""
    js = _read(INTEGRATIONS_JS)
    assert '#integrationTabs [data-bs-toggle="tab"]' in js
    assert 'button[data-bs-toggle="tab"]' not in js
    assert "getAttribute('data-bs-target') || triggerEl.getAttribute('href')" in js


def test_lazy_loaded_panels_are_found_by_target_not_by_id():
    """The image queue only fetches on `shown.bs.tab`. The old strip's anchor
    carried id="imageQueue-tab"; bar two's segment does not, so an id lookup
    would leave the panel permanently empty under the new chrome — with no
    error anywhere to say why.

    The selector lives in `od_admin_scanjobs_inline.js` (extracted off the
    template so CSP can enforce). Pin the JS, not a string that used to sit
    inline in the Jinja.
    """
    markup = _read(SCANJOBS)
    js = _read(ROOT / 'oneirodex' / 'static' / 'js' / 'od_admin_scanjobs_inline.js')
    assert "getElementById('imageQueue-tab')" not in markup
    assert "getElementById('imageQueue-tab')" not in js
    assert '[data-bs-toggle="tab"][href="#imageQueue"]' in js


def test_both_admin_strips_survive_until_the_flag_is_permanent():
    """The flag is still opt-in, so every converted page must render correctly
    with it off too — otherwise turning it off is not actually a way back."""
    markup = _read(SCANJOBS)
    assert 'enable_new_chrome' in markup
    assert 'admin_manage_scanjobs-nav-tabs' in markup, 'the fallback strip was deleted'


def test_jinja_views_are_links_not_buttons():
    """In Jinja a view switch is a navigation. Rendering it as a <button> would
    break middle-click, open-in-new-tab and copy-link for no benefit."""
    macro = _read(JINJA)
    seg = macro[macro.index('od-seg__item'):]
    assert '<a class="od-seg__item' in macro or 'a class="od-seg__item' in seg
    assert 'href=' in seg


LIBRARIES = ROOT / 'oneirodex' / 'templates' / 'admin' / 'admin_manage_libraries.html'
SCANJOBS_CSS = ROOT / 'oneirodex' / 'setup' / 'default_theme' / 'css' / 'admin' / 'admin_manage_scanjobs.css'


def test_libraries_panel_is_not_a_card_inside_the_page_card():
    """Libraries & scans already has a page shell. A Bootstrap .card around the
    libraries table was a second frame — the nested-tables complaint."""
    markup = _read(LIBRARIES)
    assert "{% include 'admin/partials/admin_libraries_panel.html' %}" in markup
    assert '<div class="card">' not in markup


def test_scan_jobs_and_unmatched_are_not_nested_glass_cards():
    """One primary list per pane: jobs / unmatched sit on the page shell, not
    inside another blurred card."""
    css = _read(SCANJOBS_CSS)
    jobs = css.split('.scan-jobs-card {', 1)[1].split('}', 1)[0]
    assert 'background: transparent' in jobs
    unmatched = css.split('.admin_manage_scanjobs-unmatched-panel {', 1)[1].split('}', 1)[0]
    assert 'background: transparent' in unmatched
    panel = css.split('.admin_manage_scanjobs-nav-panel {', 1)[1].split('}', 1)[0]
    assert 'background: transparent' in panel
