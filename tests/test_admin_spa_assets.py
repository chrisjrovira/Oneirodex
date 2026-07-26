"""Admin SPA asset wiring."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_admin_spa_dist_built():
    dist = ROOT / 'gametheca' / 'static' / 'dist' / 'admin-app'
    assert (dist / 'admin-app.js').is_file()
    assert (dist / 'admin-app.css').is_file()


def test_entrypoint_warns_on_missing_admin_app():
    sh = (ROOT / 'entrypoint.sh').read_text(encoding='utf-8')
    assert 'admin-app.js' in sh
    assert 'admin-app.css' in sh


def test_dockerfile_builds_admin_app():
    text = (ROOT / 'Dockerfile').read_text(encoding='utf-8')
    assert 'frontend/admin-app' in text
    assert 'dist/admin-app' in text
