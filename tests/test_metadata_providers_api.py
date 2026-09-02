"""Admin metadata provider toggles API (Steam / GOG / Epic)."""

from __future__ import annotations

import json
from uuid import uuid4

import pytest

from oneirodex import cache, db
from oneirodex.models import GlobalSettings, User
from oneirodex.utils.metadata_providers import (
    get_metadata_providers_config,
    resolve_metadata_providers,
    stage_d_source_ids,
)


@pytest.fixture
def admin_user(db_session):
    unique = str(uuid4())[:8]
    admin = User(
        user_id=str(uuid4()),
        name=f'MetaProvAdmin_{unique}',
        email=f'metaprov_admin_{unique}@test.com',
        role='admin',
        is_email_verified=True,
    )
    admin.set_password('testpass123')
    db_session.add(admin)
    db_session.commit()
    return admin


@pytest.fixture
def clean_settings(db_session):
    db_session.query(GlobalSettings).delete()
    db_session.commit()
    cache.clear()


def _login(client, user):
    with client.session_transaction() as sess:
        sess['_user_id'] = str(user.id)
        sess['_fresh'] = True


def test_get_metadata_providers_defaults(client, admin_user, clean_settings, app):
    _login(client, admin_user)
    response = client.get('/api/admin/integrations/metadata-providers')
    assert response.status_code == 200
    data = response.get_json()
    assert data['providers'] == {'steam': True, 'gog': True, 'epic': True}
    assert 'steam' in data['notes']
    assert stage_d_source_ids() == ('steam', 'gog', 'epic')


def test_put_metadata_providers_persists(client, admin_user, clean_settings, app):
    _login(client, admin_user)
    put = client.put(
        '/api/admin/integrations/metadata-providers',
        data=json.dumps({'providers': {'steam': False, 'epic': True}}),
        content_type='application/json',
    )
    assert put.status_code == 200
    body = put.get_json()
    assert body['providers']['steam'] is False
    assert body['providers']['gog'] is True
    assert body['providers']['epic'] is True

    get = client.get('/api/admin/integrations/metadata-providers')
    again = get.get_json()
    assert again['providers']['steam'] is False
    assert resolve_metadata_providers()['steam'] is False
    assert stage_d_source_ids() == ('gog', 'epic')

    row = db.session.query(GlobalSettings).first()
    assert row.settings['metadata_providers']['steam'] is False


def test_put_flat_body_accepted(client, admin_user, clean_settings, app):
    _login(client, admin_user)
    put = client.put(
        '/api/admin/integrations/metadata-providers',
        data=json.dumps({'gog': False}),
        content_type='application/json',
    )
    assert put.status_code == 200
    assert put.get_json()['providers']['gog'] is False
    assert get_metadata_providers_config()['providers']['gog'] is False


def test_put_empty_body_is_400(client, admin_user, clean_settings, app):
    _login(client, admin_user)
    response = client.put(
        '/api/admin/integrations/metadata-providers',
        data='{}',
        content_type='application/json',
    )
    assert response.status_code == 400
    body = response.get_json()
    assert body['ok'] is False


def test_put_only_unknown_keys_is_400(client, admin_user, clean_settings, app):
    """A typo used to match no provider, change nothing, and still answer 200."""
    _login(client, admin_user)
    response = client.put(
        '/api/admin/integrations/metadata-providers',
        data=json.dumps({'steamm': False}),
        content_type='application/json',
    )
    assert response.status_code == 400
    body = response.get_json()
    assert body['ok'] is False
    assert body['error_code'] == 'bad_request'
    assert 'steamm' in body['error']
    # The bad request must not have touched the stored flags.
    assert get_metadata_providers_config()['providers']['steam'] is True


def test_put_mixed_known_and_unknown_keys_still_applies(client, admin_user, clean_settings, app):
    """Only an all-unknown body is rejected — a known key still saves."""
    _login(client, admin_user)
    response = client.put(
        '/api/admin/integrations/metadata-providers',
        data=json.dumps({'gog': False, 'nonsense': True}),
        content_type='application/json',
    )
    assert response.status_code == 200
    assert response.get_json()['providers']['gog'] is False


def test_get_returns_the_shared_envelope(client, admin_user, clean_settings, app):
    """New routes go through api_ok, not a bare jsonify."""
    _login(client, admin_user)
    body = client.get('/api/admin/integrations/metadata-providers').get_json()
    assert body['ok'] is True
    assert body['error'] is None
    assert body['error_code'] is None
    assert set(body['providers']) == {'steam', 'gog', 'epic'}


def test_metadata_providers_requires_admin(client, clean_settings, app, db_session):
    unique = str(uuid4())[:8]
    user = User(
        user_id=str(uuid4()),
        name=f'MetaProvUser_{unique}',
        email=f'metaprov_user_{unique}@test.com',
        role='user',
        is_email_verified=True,
    )
    user.set_password('testpass123')
    db_session.add(user)
    db_session.commit()
    _login(client, user)
    response = client.get('/api/admin/integrations/metadata-providers')
    assert response.status_code in (302, 403)
