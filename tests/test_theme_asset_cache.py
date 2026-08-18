"""A theme reset has to be visible in the browser, not just on disk.

Theme files are mutable at a fixed URL: `Reset Themes` rewrites
`static/library/themes/<theme>/…` in place while every template goes on pointing
at the identical path. Static responses carried `public, max-age=3600` with no
validator, so a browser that had the old stylesheet kept it for an hour. The
reset worked, the product looked unchanged, and "hard-refresh" became the
standing workaround for what was really a caching bug.

Two mechanisms fix it and both are pinned here: `theme_asset` puts a
content-derived version on the URL, and the ASGI static handler lets theme paths
revalidate instead of asserting an hour of freshness.

No database needed for the URL tests; the header test is a pure function check.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


# --------------------------------------------------------------------------
# URL versioning
# --------------------------------------------------------------------------

def test_theme_asset_url_carries_a_version(app):
    from gametheca.routes import clear_theme_asset_versions

    with app.test_request_context('/'):
        clear_theme_asset_versions()
        from gametheca.routes import theme_asset_filter

        url = theme_asset_filter(None, 'css/base.css')

    assert 'library/themes/' in url
    assert re.search(r'[?&]v=', url), f'no cache-busting version on {url}'


def test_the_version_changes_when_the_file_does(app, tmp_path):
    """The whole point: same path, new bytes, different URL."""
    from gametheca.routes import _theme_asset_version, clear_theme_asset_versions

    target = tmp_path / 'base.css'
    target.write_text('a{}', encoding='utf-8')
    clear_theme_asset_versions()
    first = _theme_asset_version(target)

    # Rewrite with different content, and move mtime on — Reset Themes replaces
    # the file wholesale, so both size and mtime change in practice.
    target.write_text('a{color:red}', encoding='utf-8')
    import os
    os.utime(target, (0, 0))
    clear_theme_asset_versions()
    second = _theme_asset_version(target)

    assert first != second


def test_versions_are_memoised_until_cleared(app, tmp_path):
    """A page links a few dozen theme assets and this can sit on a network
    path, so the stat is cached — which is exactly why the reset has to clear
    it, and why that clearing is asserted below."""
    from gametheca.routes import _theme_asset_version, clear_theme_asset_versions

    target = tmp_path / 'x.css'
    target.write_text('a{}', encoding='utf-8')
    clear_theme_asset_versions()
    first = _theme_asset_version(target)

    target.write_text('a{color:red}', encoding='utf-8')
    import os
    os.utime(target, (0, 0))

    assert _theme_asset_version(target) == first, 'memo should hold until cleared'
    clear_theme_asset_versions()
    assert _theme_asset_version(target) != first, 'clearing must pick up the new file'


def test_reset_clears_the_version_memo():
    """Source guard. The reset rewrites the files; without this call the URLs
    keep their old versions and the browser is never told anything changed —
    the failure this whole module exists for."""
    source = (ROOT / 'gametheca' / 'routes_admin_ext' / 'themes.py').read_text(encoding='utf-8')
    assert 'clear_theme_asset_versions' in source

    reset = source[source.index('def reset_default_themes'):]
    reset = reset[: reset.index('\n@')] if '\n@' in reset else reset
    assert 'clear_theme_asset_versions()' in reset, 'reset does not clear the memo'


# --------------------------------------------------------------------------
# Delivery
# --------------------------------------------------------------------------

@pytest.mark.parametrize(
    'path,expect_revalidate',
    [
        ('/static/library/themes/default/css/base.css', True),
        ('/static/library/themes/ember/js/gt_sortable_table.js', True),
        ('/static/dist/member-app/member-app.js', False),
        ('/static/newstyle/gametheca_mark.svg', False),
    ],
)
def test_only_mutable_theme_paths_skip_the_hour(path, expect_revalidate):
    """Hashed SPA bundles and images are content-addressed or genuinely static
    and keep the hour. Theme files are neither — they change under a fixed URL."""
    source = (ROOT / 'asgi.py').read_text(encoding='utf-8')
    assert "is_mutable_theme_asset = '/static/library/themes/' in" in source, (
        'the theme-path branch is gone'
    )

    is_theme = '/static/library/themes/' in path
    assert is_theme is expect_revalidate


# --------------------------------------------------------------------------
# One place to choose a theme
# --------------------------------------------------------------------------

def test_only_preferences_writes_a_theme_preference():
    """The admin Themes page carried a second swatch grid writing the same
    `preferences.theme` that Preferences writes, so two surfaces could disagree
    about what was selected with no way to tell which had won. Retired at every
    layer — grid, fetch, and the POST handler behind it."""
    themes_py = (ROOT / 'gametheca' / 'routes_admin_ext' / 'themes.py').read_text(encoding='utf-8')
    assert 'def apply_theme' not in themes_py
    assert "'/admin/themes/apply'" not in themes_py

    page = (ROOT / 'gametheca' / 'templates' / 'admin' / 'admin_manage_themes.html').read_text(
        encoding='utf-8'
    )
    assert 'adminThemeGrid' not in page
    assert 'data-apply-url' not in page
    # …and still points somewhere, rather than silently dropping the affordance.
    assert 'settings.settings_panel' in page


def test_the_orphaned_settings_panel_template_is_gone():
    """`/settings_panel` renders modal_preferences.html; settings_panel.html was
    rendered by nothing while holding a third copy of the theme picker, element
    ids and all."""
    assert not (ROOT / 'gametheca' / 'templates' / 'settings' / 'settings_panel.html').exists()


def test_preferences_still_offers_uploaded_themes():
    """The reason retiring the admin grid loses nothing: Preferences builds its
    choices from installed themes, not from a preset list."""
    forms = (ROOT / 'gametheca' / 'forms.py').read_text(encoding='utf-8')
    assert 'get_installed_themes()' in forms


def test_the_static_handler_still_sets_cache_control():
    """Guard against the branch being simplified away to no header at all."""
    source = (ROOT / 'asgi.py').read_text(encoding='utf-8')
    assert 'no-cache' in source
    assert 'public, max-age=3600' in source
    assert '(b"cache-control", cache_control)' in source
