"""SPA shell must load the Vite CSS bundle (Phase 0 chrome rewrite)."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_member_spa_links_member_app_css():
    spa = (ROOT / 'oneirodex' / 'templates' / 'site' / 'member_spa.html').read_text(
        encoding='utf-8',
    )
    empty = (ROOT / 'oneirodex' / 'templates' / 'base_empty.html').read_text(
        encoding='utf-8',
    )
    needle = "dist/member-app/member-app.css"
    assert needle in spa or needle in empty
    assert needle in empty
    assert 'member-app.js' in spa


def test_entrypoint_warns_on_missing_member_app_css():
    sh = (ROOT / 'entrypoint.sh').read_text(encoding='utf-8')
    assert 'member-app.css' in sh
    assert 'od-tokens.css' in sh


def test_default_accent_is_green():
    tokens = (
        ROOT / 'oneirodex' / 'setup' / 'default_theme' / 'css' / 'od-tokens.css'
    ).read_text(encoding='utf-8')
    assert '--od-accent: #2fd67b;' in tokens
    assert '--od-glass-bg:' in tokens
    assert '--od-platform-accent:' in tokens
    assert '--od-tile-gap:' in tokens


def test_member_spa_shell_loads_admin_delete_scripts():
    empty = (ROOT / 'oneirodex' / 'templates' / 'base_empty.html').read_text(
        encoding='utf-8',
    )
    assert 'js/popup_menu.js' in empty
    assert 'js/delete_game_modal.js' in empty
    assert "partials/delete_game_modal.html" in empty
