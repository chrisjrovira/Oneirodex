"""Tests for GOW-1/GOW-2 remote play (Sunshine/Wolf BYO host)."""

from __future__ import annotations

from uuid import uuid4

import pytest

from gametheca.models import GlobalSettings, User


def _login(client, db_session, *, role='admin'):
    user = User(
        user_id=str(uuid4()),
        name=f'rp_{uuid4().hex[:8]}',
        email=f'rp_{uuid4().hex[:8]}@test.local',
        role=role,
        is_email_verified=True,
    )
    user.set_password('testpass123')
    db_session.add(user)
    db_session.commit()
    with client.session_transaction() as sess:
        sess['_user_id'] = str(user.id)
        sess['_fresh'] = True
    return user


def test_global_settings_has_remote_play_columns():
    assert hasattr(GlobalSettings, 'enable_remote_play')
    assert hasattr(GlobalSettings, 'remote_play_settings')


def test_remote_play_disabled_by_default(client, app, db_session, monkeypatch):
    monkeypatch.setitem(app.config, 'ENABLE_REMOTE_PLAY', False)
    # Test DB may retain enable_remote_play=True from earlier saves
    row = db_session.query(GlobalSettings).order_by(GlobalSettings.id).first()
    if row is not None:
        row.enable_remote_play = False
        row.remote_play_settings = {}
        db_session.commit()
    _login(client, db_session, role='member')
    resp = client.get('/api/remote-play/status')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['enabled'] is False
    assert data['configured'] is False


def test_member_status_when_configured(client, app, db_session, global_settings, monkeypatch):
    monkeypatch.setitem(app.config, 'ENABLE_REMOTE_PLAY', True)
    monkeypatch.setitem(app.config, 'ALLOW_PRIVATE_LAN_URLS', True)
    global_settings.enable_remote_play = True
    db_session.commit()
    with app.app_context():
        from gametheca.utils.remote_play import save_remote_play_config

        save_remote_play_config({
            'enabled': True,
            'provider': 'sunshine',
            'sunshine_base_url': 'http://192.168.1.50:47989',
            'app_hint': 'Steam',
            'pin_hint': 'Pair first',
            'host_label': 'GPU PC',
        })
    _login(client, db_session, role='member')
    resp = client.get('/api/remote-play/status')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['enabled'] is True
    assert data['configured'] is True
    assert data['moonlight_host'] == '192.168.1.50'
    assert data['moonlight_port'] == 47989
    assert data['app_hint'] == 'Steam'
    assert '192.168.1.50' in (data.get('copy_hint') or '')


def test_admin_put_config(client, app, db_session, global_settings, monkeypatch):
    monkeypatch.setitem(app.config, 'ENABLE_REMOTE_PLAY', False)
    monkeypatch.setitem(app.config, 'ALLOW_PRIVATE_LAN_URLS', True)
    _login(client, db_session, role='admin')
    resp = client.put(
        '/api/admin/remote-play/config',
        json={
            'enabled': True,
            'provider': 'wolf',
            'wolf_base_url': 'http://10.0.0.5:8080',
            'token_hint': 'Wolf token from admin',
        },
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['status'] == 'saved'
    assert data['db_enabled'] is True
    assert data['wolf_base_url'] == 'http://10.0.0.5:8080'
    assert data['moonlight_host'] == '10.0.0.5'


def test_save_validates_lan_url(app, db_session, global_settings, monkeypatch):
    monkeypatch.setitem(app.config, 'ALLOW_PRIVATE_LAN_URLS', False)
    # An UPDATE on the existing singleton, not a second INSERT — the value is
    # what this test needs, a fresh row is not.
    global_settings.enable_remote_play = True
    db_session.commit()
    with app.app_context():
        from gametheca.utils.remote_play import save_remote_play_config

        with pytest.raises(ValueError, match='ALLOW_PRIVATE_LAN_URLS'):
            save_remote_play_config({
                'enabled': True,
                'sunshine_base_url': 'http://192.168.1.10:47989',
            })


def test_admin_config_requires_admin(client, app, db_session, monkeypatch):
    monkeypatch.setitem(app.config, 'ALLOW_PRIVATE_LAN_URLS', True)
    _login(client, db_session, role='member')
    resp = client.get('/api/admin/remote-play/config')
    assert resp.status_code in (403, 302)


def test_build_copy_hint():
    from gametheca.utils.remote_play import build_copy_hint

    hint = build_copy_hint({
        'configured': True,
        'moonlight_host': '192.168.1.2',
        'moonlight_port': 47989,
        'host_label': 'Lab',
        'app_hint': 'RetroArch',
        'pin_hint': '1234',
    })
    assert '192.168.1.2' in hint
    assert 'Lab' in hint
    assert 'RetroArch' in hint
