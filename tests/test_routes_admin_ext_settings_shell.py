"""
Unit tests for the Settings shell hub at GET /admin/settings.

Covers: auth guards, default section, ?section= highlighting/validation,
and that every shell section deep-links to an existing, registered route.
"""

import pytest
from uuid import uuid4

from gametheca.models import User
from gametheca.routes_admin_ext.settings import (
    SETTINGS_SHELL_SECTIONS, DEFAULT_SETTINGS_SHELL_SECTION
)


@pytest.fixture
def admin_user(db_session):
    """Create an admin user."""
    unique_id = str(uuid4())[:8]
    admin = User(
        user_id=str(uuid4()),
        name=f'TestAdmin_{unique_id}',
        email=f'admin_{unique_id}@test.com',
        role='admin',
        is_email_verified=True
    )
    admin.set_password('testpass123')
    db_session.add(admin)
    db_session.commit()
    return admin


@pytest.fixture
def regular_user(db_session):
    """Create a regular user."""
    unique_id = str(uuid4())[:8]
    user = User(
        user_id=str(uuid4()),
        name=f'TestUser_{unique_id}',
        email=f'user_{unique_id}@test.com',
        role='user',
        is_email_verified=True
    )
    user.set_password('testpass123')
    db_session.add(user)
    db_session.commit()
    return user


def login(client, user):
    with client.session_transaction() as sess:
        sess['_user_id'] = str(user.id)
        sess['_fresh'] = True


class TestSettingsShellSections:
    """Test the SETTINGS_SHELL_SECTIONS configuration itself."""

    def test_has_exactly_four_sections_in_order(self):
        assert list(SETTINGS_SHELL_SECTIONS.keys()) == [
            'server', 'attract', 'integrations', 'themes'
        ]

    def test_default_section_is_server(self):
        assert DEFAULT_SETTINGS_SHELL_SECTION == 'server'

    def test_each_section_has_required_fields(self):
        for key, section in SETTINGS_SHELL_SECTIONS.items():
            assert section['label']
            assert section['icon']
            assert section['description']
            assert section['endpoint']

    def test_each_section_endpoint_resolves(self, app):
        """Every section endpoint must be a real, registered route."""
        with app.app_context():
            from flask import url_for
            for section in SETTINGS_SHELL_SECTIONS.values():
                url_for(section['endpoint'])  # raises if not registered


class TestSettingsShellRoute:
    """Test GET /admin/settings (the shell/hub page)."""

    def test_requires_login(self, client):
        response = client.get('/admin/settings')
        assert response.status_code == 302
        assert 'login' in response.location

    def test_requires_admin(self, client, regular_user):
        login(client, regular_user)
        response = client.get('/admin/settings')
        assert response.status_code == 302

    def test_default_section_renders_server(self, client, admin_user):
        login(client, admin_user)
        response = client.get('/admin/settings')
        assert response.status_code == 200
        body = response.get_data(as_text=True)
        assert 'Server Settings' in body
        assert 'Attract Mode' in body
        assert 'Integrations' in body
        assert 'Themes' in body

    def test_section_query_param_selects_attract(self, client, admin_user):
        login(client, admin_user)
        response = client.get('/admin/settings?section=attract')
        assert response.status_code == 200
        body = response.get_data(as_text=True)
        assert 'idle-screen trailer slideshow' in body

    def test_invalid_section_falls_back_to_default(self, client, admin_user):
        login(client, admin_user)
        response = client.get('/admin/settings?section=bogus')
        assert response.status_code == 200
        body = response.get_data(as_text=True)
        # Falls back to the server section's description
        assert 'Scan threads, download batching' in body

    def test_cards_deep_link_to_real_admin_urls(self, client, admin_user):
        login(client, admin_user)
        response = client.get('/admin/settings')
        assert response.status_code == 200
        body = response.get_data(as_text=True)
        assert '/admin/new_server_settings' in body
        assert '/admin/attract_mode_settings' in body
        assert '/admin/integrations' in body
        assert '/admin/themes' in body

    def test_post_still_updates_settings(self, client, admin_user):
        """POST behavior for saving settings must be unchanged by the shell."""
        login(client, admin_user)
        response = client.post('/admin/settings', json={'showSystemLogo': False})
        assert response.status_code == 200
        data = response.get_json()
        assert data['message'] == 'Settings updated successfully'
