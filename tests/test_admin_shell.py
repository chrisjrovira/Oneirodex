"""DB-free guards for React admin SPA shell (base_admin)."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEMPLATES = ROOT / 'gametheca' / 'templates'
ADMIN_TEMPLATES = TEMPLATES / 'admin'
BASE_ADMIN = TEMPLATES / 'base_admin.html'


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


def test_the_admin_brand_mark_is_rendered_by_the_spa():
    """This used to assert `gametheca_mark.svg` appeared in base_admin.html.

    The mark moved into `AdminTopNav` when admin bar one became React, so the
    old assertion had been failing against a template that is correct — it was
    pinning where the mark used to live rather than that it exists. Checked in
    the SPA that base_admin loads, the guard still means something: the shell
    would otherwise render an admin bar with no brand at all.
    """
    top_nav = (
        ROOT / 'frontend' / 'admin-app' / 'src' / 'AdminTopNav.jsx'
    ).read_text(encoding='utf-8')
    assert 'gametheca_mark.svg' in top_nav


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
