"""theme_asset must resolve per render, from the Flask app root — not process CWD."""
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
            url = theme_asset_filter(None, 'css/base.css')

    assert 'library/themes/aurora/css/base.css' in url


def test_theme_asset_is_not_constant_folded(theme_app):
    """A theme change must reach the *next* render, not the next restart.

    Every call site passes a literal, and Jinja constant-folds a filter applied
    to a constant at compile time. Flask then caches the compiled template for
    the life of the process, so without `@pass_context` the first render's theme
    was baked into every later one: `data-theme` on <html> tracked the new
    preference (a variable lookup, never folded) while every stylesheet link
    stayed on the old one. That is the whole of "changing the theme does nothing
    on reload".

    Rendering the same template source twice with different preferences is the
    only honest check — asserting on the decorator would pass against a filter
    that had been re-marked and still folded.
    """
    from gametheca.routes import theme_asset_filter

    # The marker is what makes the fold illegal; assert it is still the *reason*
    # rather than a decoration, then prove the behaviour it buys.
    assert getattr(theme_asset_filter, 'jinja_pass_arg', None) is not None

    theme_app.jinja_env.filters['theme_asset'] = theme_asset_filter
    template = theme_app.jinja_env.from_string("{{ 'css/base.css'|theme_asset }}")

    fake_user = MagicMock()
    fake_user.is_authenticated = True
    fake_user.preferences = MagicMock()

    rendered = []
    with theme_app.app_context(), theme_app.test_request_context('/'):
        with patch('flask_login.current_user', fake_user):
            for theme in ('aurora', 'default'):
                fake_user.preferences.theme = theme
                rendered.append(template.render())

    assert 'themes/aurora/css/base.css' in rendered[0]
    # The same compiled template, a different preference: the second render must
    # follow the preference rather than repeat the first render's answer.
    assert 'themes/default/css/base.css' in rendered[1]


def test_pass_context_makes_the_fold_impossible(theme_app):
    """Pin the Jinja mechanism, so an upgrade that changes it fails loudly here.

    `nodes._FilterTestCommon.as_const` raises `Impossible` for a filter marked
    `_PassArg.context`. If a future Jinja drops that rule, the filter above
    starts folding again and the theme silently sticks — a failure that is very
    hard to attribute from the symptom.
    """
    from jinja2 import nodes

    from gametheca.routes import theme_asset_filter

    theme_app.jinja_env.filters['theme_asset'] = theme_asset_filter
    parsed = theme_app.jinja_env.parse("{{ 'css/base.css'|theme_asset }}")
    filter_node = next(parsed.find_all(nodes.Filter))

    with theme_app.app_context(), theme_app.test_request_context('/'):
        with pytest.raises(nodes.Impossible):
            filter_node.as_const()
