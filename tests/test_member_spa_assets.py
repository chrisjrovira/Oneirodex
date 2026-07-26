"""SPA shell must load the Vite CSS bundle (Phase 0 chrome rewrite)."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_member_spa_links_member_app_css():
    spa = (ROOT / 'gametheca' / 'templates' / 'site' / 'member_spa.html').read_text(
        encoding='utf-8',
    )
    empty = (ROOT / 'gametheca' / 'templates' / 'base_empty.html').read_text(
        encoding='utf-8',
    )
    needle = "dist/member-app/member-app.css"
    assert needle in spa or needle in empty
    assert needle in empty
    assert 'member-app.js' in spa


def test_entrypoint_warns_on_missing_member_app_css():
    sh = (ROOT / 'entrypoint.sh').read_text(encoding='utf-8')
    assert 'member-app.css' in sh
    assert 'gt-tokens.css' in sh
