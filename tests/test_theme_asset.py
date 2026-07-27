"""theme_asset must resolve files from the Flask app root, not process CWD."""
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from flask import Flask


@pytest.fixture
def theme_app(tmp_path):
    app_root = tmp_path / 'gametheca_pkg'
    aurora = app_root / 'static' / 'library' / 'themes' / 'aurora' / 'css'
    aurora.mkdir(parents=True)
    (aurora / 'base.css').write_text('/* aurora */', encoding='utf-8')
    default = app_root / 'static' / 'library' / 'themes' / 'default' / 'css'
    default.mkdir(parents=True)
    (default / 'base.css').write_text('/* default */', encoding='utf-8')

    app = Flask(__name__, root_path=str(app_root))
    app.config['SERVER_NAME'] = 'localhost'
    app.config['APPLICATION_ROOT'] = '/'
    app.config['PREFERRED_URL_SCHEME'] = 'http'
    return app


def test_theme_asset_finds_file_when_cwd_is_not_repo_root(theme_app, tmp_path, monkeypatch):
    elsewhere = tmp_path / 'not_the_repo'
    elsewhere.mkdir()
    monkeypatch.chdir(elsewhere)

    fake_user = MagicMock()
    fake_user.is_authenticated = True
    fake_user.preferences = MagicMock()
    fake_user.preferences.theme = 'aurora'

    from gametheca.routes import theme_asset_filter

    with theme_app.app_context(), theme_app.test_request_context('/'):
        with patch('flask_login.current_user', fake_user):
            url = theme_asset_filter('css/base.css')

    assert 'library/themes/aurora/css/base.css' in url
