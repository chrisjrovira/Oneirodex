"""Registration and auth surface of the apply-theme endpoint.

Kept free of database fixtures so the route contract can be checked even when
no test Postgres is reachable.
"""

import pytest
from flask import Flask
from flask_wtf.csrf import CSRFProtect

from gametheca import login_manager
from gametheca.routes_admin_ext import admin2_bp


@pytest.fixture
def bare_app(monkeypatch, tmp_path):
    """A minimal app with only the admin blueprint mounted."""
    app = Flask('bare_admin', root_path=str(tmp_path))
    app.config.update(SECRET_KEY='test-secret-key', TESTING=True, WTF_CSRF_ENABLED=False)
    # No login view registered here, so unauthorized requests answer 401.
    monkeypatch.setattr(login_manager, 'login_view', None, raising=False)
    login_manager.init_app(app)
    app.register_blueprint(admin2_bp)
    return app


def test_apply_theme_route_is_registered(bare_app):
    rule = next(
        (r for r in bare_app.url_map.iter_rules() if r.rule == '/admin/themes/apply'),
        None,
    )

    assert rule is not None
    assert 'POST' in rule.methods
    assert 'GET' not in rule.methods
    assert rule.endpoint == 'admin2.apply_theme'


def test_apply_theme_rejects_anonymous_callers(bare_app):
    response = bare_app.test_client().post('/admin/themes/apply', json={'theme': 'default'})

    assert response.status_code == 401


def test_apply_theme_is_csrf_protected_when_csrf_is_enabled(bare_app):
    """CSRFProtect is applied app-wide, so the route inherits token enforcement."""
    bare_app.config['WTF_CSRF_ENABLED'] = True
    CSRFProtect(bare_app)

    response = bare_app.test_client().post('/admin/themes/apply', json={'theme': 'default'})

    assert response.status_code == 400
