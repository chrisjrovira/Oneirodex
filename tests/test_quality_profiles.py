"""Quality / release profile CRUD + scoring (P1-12)."""

from __future__ import annotations

from uuid import uuid4

import pytest
from flask_login import login_user
from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified

from gametheca.models import GlobalSettings, User
from gametheca.utils.functions import load_scanning_filter_patterns
from gametheca.utils.quality_profiles import (
    active_exclude_terms_for_scan,
    create_quality_profile,
    get_quality_profile,
    list_quality_profiles,
    save_quality_profile,
    score_release_title,
    _save_store,
    _migrate_raw,
)


@pytest.fixture
def admin(db_session):
    uid = str(uuid4())
    row = User(
        name=f'adm_{uid[:8]}',
        email=f'adm_{uid[:8]}@example.com',
        role='admin',
        user_id=uid,
        state=True,
    )
    row.set_password('password123')
    db_session.add(row)
    db_session.commit()
    return row


def _login(client, app, user):
    with client.session_transaction() as sess:
        sess['_user_id'] = str(user.get_id())
        sess['_fresh'] = True
    with app.test_request_context():
        login_user(user)


def _ensure_settings(db_session):
    settings = db_session.execute(select(GlobalSettings).limit(1)).scalars().first()
    if not settings:
        settings = GlobalSettings()
        db_session.add(settings)
        db_session.commit()
    return settings


def _seed_flat_profile(app, db_session, payload: dict):
    """Write a legacy flat profile then let helpers migrate/persist to v2."""
    settings = _ensure_settings(db_session)
    settings.quality_profiles = payload
    flag_modified(settings, 'quality_profiles')
    db_session.commit()
    db_session.expire_all()
    with app.app_context():
        # Force migration persist + return active fields.
        return save_quality_profile(payload)


def test_quality_profile_crud_and_score(app, db_session, client, admin):
    _ensure_settings(db_session)
    _login(client, app, admin)

    with app.app_context():
        seeded = _seed_flat_profile(app, db_session, {
            'preferred_groups': ['FITGIRL'],
            'blocked_groups': ['DODI'],
            'prefer_repack': True,
            'min_size_mb': None,
            'max_size_mb': None,
        })
        assert seeded['preferred_groups'] == ['FITGIRL']

    listed = client.get('/api/quality-profiles')
    assert listed.status_code == 200
    body = listed.get_json()
    assert 'profiles' in body
    assert body['preferred_groups'] == ['FITGIRL']
    assert len(body['profiles']) >= 1
    active_id = body['active_id']

    created = client.post('/api/quality-profiles', json={
        'name': 'Strict PC',
        'preferred_groups': ['GOG'],
        'preferred_patterns': ['-repack'],
        'blocked_groups': [],
        'excluded_terms': ['CAM', 'TS'],
        'min_size_mb': 100,
        'max_size_mb': 80000,
        'prefer_repack': True,
        'activate': True,
    })
    assert created.status_code == 201
    profile = created.get_json()
    assert profile['name'] == 'Strict PC'
    assert profile['excluded_terms'] == ['CAM', 'TS']
    new_id = profile['id']

    listed2 = client.get('/api/quality-profiles')
    assert listed2.get_json()['active_id'] == new_id

    updated = client.put(f'/api/quality-profiles/{new_id}', json={
        'preferred_groups': ['GOG', 'Steam'],
        'excluded_terms': ['CAM'],
    })
    assert updated.status_code == 200
    assert updated.get_json()['preferred_groups'] == ['GOG', 'Steam']

    score_ok = client.post('/api/quality-profiles/score', json={
        'title': 'Cool Game-GOG-repack',
        'size_bytes': 500 * 1024 * 1024,
        'profile_id': new_id,
    })
    assert score_ok.status_code == 200
    good = score_ok.get_json()
    assert good['allowed'] is True
    assert good['score'] >= 10
    assert any(r.startswith('preferred:') for r in good['reasons'])

    score_bad = client.post('/api/quality-profiles/score', json={
        'title': 'Cool Game CAM',
        'profile_id': new_id,
    })
    bad = score_bad.get_json()
    assert bad['allowed'] is False
    assert any(r.startswith('excluded:') for r in bad['reasons'])

    client.put('/api/quality-profiles/active', json={'id': active_id})
    deleted = client.delete(f'/api/quality-profiles/{new_id}')
    assert deleted.status_code == 200
    ids = {p['id'] for p in deleted.get_json()['profiles']}
    assert new_id not in ids


def test_score_exclude_and_scan_terms(app, db_session):
    with app.app_context():
        _seed_flat_profile(app, db_session, {
            'preferred_groups': ['FITGIRL'],
            'blocked_groups': ['DODI'],
            'preferred_patterns': ['proper'],
            'excluded_terms': ['x264'],
            'prefer_repack': True,
            'min_size_mb': None,
            'max_size_mb': None,
        })
        good = score_release_title('Game-FITGIRL-proper')
        blocked = score_release_title('Game-DODI')
        excluded = score_release_title('Game.x264')
        terms = active_exclude_terms_for_scan()
        insensitive, _sensitive = load_scanning_filter_patterns()

    assert good['score'] >= 13
    assert blocked['allowed'] is False
    assert excluded['allowed'] is False
    assert 'DODI' in terms
    assert 'x264' in terms
    assert any('DODI' in p for p in insensitive)
    assert any('x264' in p for p in insensitive)


def test_legacy_put_updates_active(app, db_session, client, admin):
    _ensure_settings(db_session)
    _login(client, app, admin)
    with app.app_context():
        # Reset to a clean single active profile via store write.
        _save_store(_migrate_raw({
            'preferred_groups': ['A'],
            'blocked_groups': [],
            'prefer_repack': True,
        }))
        create_quality_profile({'name': 'B', 'preferred_groups': ['B'], 'activate': True})

    resp = client.put('/api/quality-profiles', json={
        'preferred_groups': ['LEGACY'],
        'blocked_groups': ['NOPE'],
        'excluded_terms': ['SAMPLE'],
    })
    assert resp.status_code == 200
    body = resp.get_json()
    assert body['preferred_groups'] == ['LEGACY']
    assert body['excluded_terms'] == ['SAMPLE']
    with app.app_context():
        active = get_quality_profile()
        listed = list_quality_profiles()
    assert active['preferred_groups'] == ['LEGACY']
    assert listed['active_id'] == active['id']


def test_quality_profiles_list_spa_contract(app, db_session, client, admin):
    """GET /api/quality-profiles is JSON-friendly for the admin React page."""
    _ensure_settings(db_session)
    _login(client, app, admin)
    with app.app_context():
        _save_store(_migrate_raw({
            'preferred_groups': ['SPA'],
            'blocked_groups': ['X'],
            'preferred_patterns': ['repack'],
            'excluded_terms': ['CAM'],
            'prefer_repack': True,
        }))

    resp = client.get('/api/quality-profiles')
    assert resp.status_code == 200
    body = resp.get_json()
    assert isinstance(body, dict)
    assert isinstance(body.get('active_id'), str) and body['active_id']
    assert isinstance(body.get('profiles'), list) and len(body['profiles']) >= 1
    for key in (
        'preferred_groups',
        'blocked_groups',
        'preferred_patterns',
        'excluded_terms',
    ):
        assert isinstance(body.get(key), list)

    active = None
    for profile in body['profiles']:
        assert isinstance(profile.get('id'), str) and profile['id']
        assert isinstance(profile.get('name'), str)
        for key in (
            'preferred_groups',
            'blocked_groups',
            'preferred_patterns',
            'excluded_terms',
        ):
            assert isinstance(profile.get(key), list)
        if profile['id'] == body['active_id']:
            active = profile
    assert active is not None
    assert body.get('id') == body['active_id']
