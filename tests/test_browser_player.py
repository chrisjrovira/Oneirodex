"""BP-0/BP-1 browser player settings — defaults, honesty (no unwired engines), NES pilot."""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest
from flask_login import login_user

from oneirodex.models import GlobalSettings, User
from oneirodex.utils.browser_player import (
    DEFAULTS,
    SHIPPED_ENGINES,
    browser_play_href,
    get_browser_player_settings,
    normalize_browser_player_settings,
    play_engine_fields,
    set_browser_player_settings,
)
from oneirodex.utils.play_url import browse_play_fields


@pytest.fixture
def admin_user(db_session):
    uid = str(uuid4())
    row = User(
        name=f'bpadmin_{uid[:8]}',
        email=f'bpadmin_{uid[:8]}@example.com',
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


def _ensure_settings(db_session, **kwargs):
    row = db_session.query(GlobalSettings).order_by(GlobalSettings.id).first()
    if not row:
        row = GlobalSettings()
        db_session.add(row)
        db_session.flush()
    for key, value in kwargs.items():
        setattr(row, key, value)
    db_session.commit()
    return row


def test_normalize_defaults():
    cleaned = normalize_browser_player_settings({})
    assert cleaned['browser_player_default'] == 'webretro'
    assert cleaned['browser_players_available'] == list(SHIPPED_ENGINES)
    assert cleaned['webrcade_sidecar_url'] == ''
    assert cleaned['webrcade_feed_export'] is False
    assert cleaned['browser_player_allow_member_choice'] is False
    assert cleaned['nostalgist_nes_pilot'] is False


def test_normalize_rejects_unwired_engine():
    with pytest.raises(ValueError, match='not wired'):
        normalize_browser_player_settings({'browser_player_default': 'emulatorjs'})


def test_normalize_rejects_unknown_engine():
    with pytest.raises(ValueError, match='Unsupported'):
        normalize_browser_player_settings({'browser_player_default': 'afterplay'})


def test_normalize_sidecar_url_must_be_http():
    with pytest.raises(ValueError, match='http'):
        normalize_browser_player_settings({'webrcade_sidecar_url': 'javascript:alert(1)'})
    cleaned = normalize_browser_player_settings(
        {'webrcade_sidecar_url': 'https://webrcade.lan:8443/'},
    )
    assert cleaned['webrcade_sidecar_url'] == 'https://webrcade.lan:8443'


def test_play_engine_fields_without_app():
    fields = play_engine_fields()
    assert fields['browser_player'] == 'webretro'
    assert fields['browser_players_available'] == ['webretro']
    assert fields['nostalgist_nes_pilot'] is False


def test_browse_play_fields_include_engine(monkeypatch):
    library = SimpleNamespace(platform=SimpleNamespace(name='NES'))
    game = SimpleNamespace(uuid='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', library=library)
    monkeypatch.setattr(
        'oneirodex.utils.emulator_profiles.resolve_emulators_for_platform',
        lambda _p: {'emulators': ['nestopia'], 'preferred': 'nestopia'},
    )
    fields = browse_play_fields(game)
    assert fields['browser_player'] == 'webretro'
    assert fields['browser_players_available'] == ['webretro']
    assert fields['nostalgist_nes_pilot'] is False
    assert 'webretro.html' in fields['play_url']


def test_browser_play_href_nes_pilot(monkeypatch):
    monkeypatch.setattr(
        'oneirodex.utils.browser_player.nostalgist_nes_pilot_enabled',
        lambda: True,
    )
    href = browser_play_href(
        game_uuid='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        core='nestopia',
        platform_key='NES',
    )
    assert href.startswith('/static/vendor/nostalgist/play.html?')
    assert 'core=nestopia' in href
    assert 'platform=NES' in href
    snes = browser_play_href(
        game_uuid='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        core='snes9x',
        platform_key='SNES',
    )
    assert 'webretro.html' in snes


def test_browse_play_fields_nes_pilot_url(monkeypatch):
    library = SimpleNamespace(platform=SimpleNamespace(name='NES'))
    game = SimpleNamespace(uuid='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', library=library)
    monkeypatch.setattr(
        'oneirodex.utils.emulator_profiles.resolve_emulators_for_platform',
        lambda _p: {'emulators': ['nestopia'], 'preferred': 'nestopia'},
    )
    monkeypatch.setattr(
        'oneirodex.utils.browser_player.nostalgist_nes_pilot_enabled',
        lambda: True,
    )
    fields = browse_play_fields(game)
    assert 'nostalgist/play.html' in fields['play_url']
    # Honesty: available engines stay webretro-only until EmulatorJS ships.
    assert fields['browser_players_available'] == ['webretro']


def test_get_and_set_browser_player_settings(app, db_session):
    with app.app_context():
        _ensure_settings(db_session, settings={})
        assert get_browser_player_settings()['browser_player_default'] == DEFAULTS[
            'browser_player_default'
        ]
        saved = set_browser_player_settings({
            'webrcade_sidecar_url': 'http://192.168.50.116:8080',
            'webrcade_feed_export': True,
        })
        assert saved['webrcade_sidecar_url'] == 'http://192.168.50.116:8080'
        assert saved['webrcade_feed_export'] is True
        row = db_session.query(GlobalSettings).order_by(GlobalSettings.id).first()
        assert row.settings['browser_player']['webrcade_feed_export'] is True
        with pytest.raises(ValueError, match='not wired'):
            set_browser_player_settings({'browser_player_default': 'emulatorjs'})


def test_browser_player_settings_api(client, app, db_session, admin_user):
    _login(client, app, admin_user)
    _ensure_settings(db_session, settings={})
    get_resp = client.get('/api/browser-player-settings')
    assert get_resp.status_code == 200
    body = get_resp.get_json()
    assert body['ok'] is True
    assert body['browser_player_default'] == 'webretro'
    assert body['browser_players_available'] == ['webretro']
    assert body['nostalgist_nes_pilot'] is False

    put_resp = client.put(
        '/api/browser-player-settings',
        json={'browser_player_allow_member_choice': True},
    )
    assert put_resp.status_code == 200
    put_body = put_resp.get_json()
    assert put_body['ok'] is True
    assert put_body['browser_player_allow_member_choice'] is True

    pilot = client.put(
        '/api/browser-player-settings',
        json={'nostalgist_nes_pilot': True},
    )
    assert pilot.status_code == 200
    assert pilot.get_json()['nostalgist_nes_pilot'] is True
    again = client.get('/api/browser-player-settings')
    assert again.get_json()['nostalgist_nes_pilot'] is True

    bad = client.put(
        '/api/browser-player-settings',
        json={'browser_player_default': 'emulatorjs'},
    )
    assert bad.status_code == 400
    assert bad.get_json()['ok'] is False
