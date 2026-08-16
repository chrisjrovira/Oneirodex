"""DB-free guards for React admin SPA shell (base_admin)."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEMPLATES = ROOT / 'gametheca' / 'templates'
ADMIN_TEMPLATES = TEMPLATES / 'admin'
BASE_ADMIN = TEMPLATES / 'base_admin.html'
ADMIN_APP_SRC = ROOT / 'frontend' / 'admin-app' / 'src'
BRAND_MARK = 'gametheca_mark.svg'


def test_base_admin_exists_without_member_sidebar():
    assert BASE_ADMIN.is_file()
    text = BASE_ADMIN.read_text(encoding='utf-8')
    assert 'id="sidebar"' not in text
    assert 'admin-app-root' in text
    assert 'admin-legacy-content' in text
    assert 'dist/admin-app/admin-app.js' in text
    assert 'dist/admin-app/admin-app.css' in text


def test_base_admin_loads_spa_assets():
    text = BASE_ADMIN.read_text(encoding='utf-8')
    assert 'admin-spa' in text
    assert 'csrf-token' in text


def test_the_admin_brand_mark_is_rendered_by_exactly_one_chrome_component():
    """The mark has now moved twice, and each move broke this guard.

    It first asserted against base_admin.html, was repointed at `AdminTopNav`
    when admin bar one became React, then broke again when GT-B2 moved the
    brand to `AdminSideRail` — repeating it in the top bar was the duplication
    that made admin feel like two navs. Naming the file is what keeps breaking:
    each rewrite re-pinned a location, and the location is the part that
    changes. What the guard actually protects is that admin chrome renders the
    brand exactly once — never zero (a shell with no brand at all) and never
    twice (the GT-B2 duplication coming back). So count instead of naming, and
    a future move of the mark between chrome components stays green on its own.
    """
    sources = sorted(
        path
        for pattern in ('*.jsx', '*.js')
        for path in ADMIN_APP_SRC.rglob(pattern)
        if not path.name.endswith(('.test.jsx', '.test.js'))
    )
    rendering = [
        path.relative_to(ADMIN_APP_SRC).as_posix()
        for path in sources
        if BRAND_MARK in path.read_text(encoding='utf-8')
    ]
    assert len(rendering) == 1, (
        f'expected exactly one admin chrome component to render {BRAND_MARK}, '
        f'found {len(rendering)}: {rendering}'
    )
    # A reference alone is hollow if the asset it points at is gone.
    assert (ROOT / 'gametheca' / 'static' / 'newstyle' / BRAND_MARK).is_file()


def test_admin_dashboard_extends_base_admin():
    dash = (ADMIN_TEMPLATES / 'admin_dashboard.html').read_text(encoding='utf-8')
    assert '{% extends "base_admin.html" %}' in dash
    assert '{% extends "base.html" %}' not in dash


def test_no_hardcoded_default_theme_js_in_admin_templates():
    remaining = []
    for path in sorted(ADMIN_TEMPLATES.glob('*.html')):
        text = path.read_text(encoding='utf-8')
        if 'library/themes/default/js' in text or "library/themes/' + current_theme" in text:
            remaining.append(path.name)
        if "filename='library/themes/" in text or 'filename="library/themes/' in text:
            remaining.append(path.name)
    assert remaining == [], f'hardcoded theme paths remain in: {remaining}'


def test_admin_app_package_exists():
    pkg = ROOT / 'frontend' / 'admin-app' / 'package.json'
    assert pkg.is_file()
    assert 'admin-app' in pkg.read_text(encoding='utf-8')
