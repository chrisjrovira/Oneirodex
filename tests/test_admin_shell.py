"""DB-free guards for Phase 3 admin chrome shell."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEMPLATES = ROOT / 'gametheca' / 'templates'
ADMIN_TEMPLATES = TEMPLATES / 'admin'
BASE_ADMIN = TEMPLATES / 'base_admin.html'


def test_base_admin_exists_without_member_sidebar():
    assert BASE_ADMIN.is_file()
    text = BASE_ADMIN.read_text(encoding='utf-8')
    assert 'id="sidebar"' not in text
    assert 'admin-shell' in text
    assert 'admin-topbar' in text
    assert 'id="content"' in text


def test_base_admin_has_top_nav_links():
    text = BASE_ADMIN.read_text(encoding='utf-8')
    expected = (
        "url_for('site.admin_dashboard')",
        "url_for('library.libraries')",
        "url_for('main.scan_management')",
        "url_for('admin2.settings')",
        "url_for('admin2.manage_users')",
        "url_for('admin2.integrations')",
        "url_for('info.admin_ops')",
        "url_for('library.library')",
    )
    for needle in expected:
        assert needle in text, f'missing nav endpoint: {needle}'
    assert 'Dashboard' in text
    assert 'Libraries' in text
    assert 'Scans' in text
    assert 'Settings' in text
    assert 'Users' in text
    assert 'Integrations' in text
    assert 'System' in text
    assert 'Back to library' in text


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


def test_admin_shell_css_exists_and_is_linked():
    css = ROOT / 'gametheca' / 'setup' / 'default_theme' / 'css' / 'admin' / 'admin-shell.css'
    assert css.is_file()
    shell = css.read_text(encoding='utf-8')
    assert '.admin-topbar' in shell
    assert '--gt-text-muted' in shell
    base = BASE_ADMIN.read_text(encoding='utf-8')
    assert "css/admin/admin-shell.css'|theme_asset" in base
