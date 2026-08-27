"""W20-4 Admin scan/match config API."""

import json
from uuid import uuid4

import pytest

from gametheca import cache, db
from gametheca.models import GlobalSettings, User
from gametheca.utils.scan_match_settings import CORE_DEFAULTS, get_scan_match_config


@pytest.fixture
def admin_user(db_session):
    unique = str(uuid4())[:8]
    admin = User(
        user_id=str(uuid4()),
        name=f'ScanMatchAdmin_{unique}',
        email=f'scanmatch_admin_{unique}@test.com',
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


def test_get_scan_match_config_defaults(client, admin_user, clean_settings, app):
    _login(client, admin_user)
    response = client.get('/api/admin/scan-match/config')
    assert response.status_code == 200
    data = response.get_json()
    assert data['match_high_threshold'] == CORE_DEFAULTS['match_high_threshold']
    assert data['match_ambiguous_gap'] == CORE_DEFAULTS['match_ambiguous_gap']
    assert data['dupe_title_threshold'] == CORE_DEFAULTS['dupe_title_threshold']
    assert data['peel_profile'] == 'conservative'
    assert data['propose_only_scan'] is False
    assert data['enable_year_drop_variant'] is True
    assert data['enable_pack_peel_variant'] is True
    assert data['enable_edition_peel_variant'] is True
    assert data['enable_sequel_numeral_variant'] is True
    assert 'mega_lib' not in data
    assert 'family_walk_depth' not in data


def test_put_scan_match_config_persists_and_affects_get(client, admin_user, clean_settings, app):
    _login(client, admin_user)
    put = client.put(
        '/api/admin/scan-match/config',
        data=json.dumps({
            'propose_only_scan': True,
            'match_high_threshold': 0.88,
            'match_ambiguous_gap': 0.06,
            'dupe_title_threshold': 0.80,
            'peel_profile': 'aggressive',
            'enable_year_drop_variant': False,
        }),
        content_type='application/json',
    )
    assert put.status_code == 200
    body = put.get_json()
    assert body['propose_only_scan'] is True
    assert body['match_high_threshold'] == 0.88
    assert body['peel_profile'] == 'aggressive'
    assert body['enable_year_drop_variant'] is False

    get = client.get('/api/admin/scan-match/config')
    assert get.status_code == 200
    again = get.get_json()
    assert again['match_high_threshold'] == 0.88
    assert again['dupe_title_threshold'] == 0.80
    assert again['propose_only_scan'] is True

    row = db.session.query(GlobalSettings).first()
    assert row is not None
    assert row.propose_only_scan is True
    assert get_scan_match_config()['match_high_threshold'] == 0.88


def test_put_refuses_mega_lib_keys(client, admin_user, clean_settings, app):
    _login(client, admin_user)
    response = client.put(
        '/api/admin/scan-match/config',
        data=json.dumps({'mega_lib': True}),
        content_type='application/json',
    )
    assert response.status_code == 400
    body = response.get_json()
    assert body['ok'] is False
    assert 'mega_lib' in body['error']
    assert body['error_code'] == 'bad_request'


def test_put_scan_match_empty_body_is_400(client, admin_user, clean_settings, app):
    _login(client, admin_user)
    response = client.put(
        '/api/admin/scan-match/config',
        data='{}',
        content_type='application/json',
    )
    assert response.status_code == 400
    body = response.get_json()
    assert body['ok'] is False
    assert body['error'] == 'No fields to update'
    assert body['error_code'] == 'bad_request'


def test_scan_match_config_requires_admin(client, clean_settings, app, db_session):
    unique = str(uuid4())[:8]
    user = User(
        user_id=str(uuid4()),
        name=f'ScanMatchUser_{unique}',
        email=f'scanmatch_user_{unique}@test.com',
        role='user',
        is_email_verified=True,
    )
    user.set_password('testpass123')
    db_session.add(user)
    db_session.commit()
    _login(client, user)
    response = client.get('/api/admin/scan-match/config')
    assert response.status_code in (302, 403)
