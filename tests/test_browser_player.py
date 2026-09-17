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
    with pytest.raises(ValueError, match='not installed'):
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
        with pytest.raises(ValueError, match='not installed'):
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


# --- BP-2: EmulatorJS is offered only when its release is on disk -------------

def _install_emulatorjs(tmp_path, monkeypatch):
    """Point the detector at a directory that has a loader.js."""
    from oneirodex.utils import emulatorjs as ejs

    data = tmp_path / 'data'
    data.mkdir()
    (data / 'loader.js').write_text('// stub', encoding='utf-8')
    monkeypatch.setattr(ejs, 'default_data_dir', lambda: data)
    return data


def test_emulatorjs_absent_is_not_offered(tmp_path, monkeypatch):
    from oneirodex.utils import emulatorjs as ejs
    from oneirodex.utils.browser_player import available_engines

    monkeypatch.setattr(ejs, 'default_data_dir', lambda: tmp_path / 'nope')
    assert available_engines() == ('webretro',)
    with pytest.raises(ValueError, match='not installed'):
        normalize_browser_player_settings({'browser_player_default': 'emulatorjs'})


def test_emulatorjs_present_is_offered_and_accepted(tmp_path, monkeypatch):
    from oneirodex.utils.browser_player import available_engines

    _install_emulatorjs(tmp_path, monkeypatch)
    assert available_engines() == ('webretro', 'emulatorjs')
    cleaned = normalize_browser_player_settings({'browser_player_default': 'emulatorjs'})
    assert cleaned['browser_player_default'] == 'emulatorjs'
    assert cleaned['browser_players_available'] == ['webretro', 'emulatorjs']


def test_emulatorjs_core_map_covers_only_real_platforms():
    from oneirodex.platform import LibraryPlatform
    from oneirodex.utils.emulatorjs import EJS_CORE_BY_PLATFORM, emulatorjs_core_for_platform

    names = {p.name for p in LibraryPlatform}
    assert set(EJS_CORE_BY_PLATFORM) <= names
    assert emulatorjs_core_for_platform('nes') == 'nes'
    assert emulatorjs_core_for_platform(LibraryPlatform.SEGA_MD) == 'segaMD'
    assert emulatorjs_core_for_platform('PS2') is None
    assert emulatorjs_core_for_platform(None) is None


def test_play_href_routes_to_emulatorjs_only_when_chosen_installed_and_supported(
    app, db_session, tmp_path, monkeypatch,
):
    from oneirodex.utils.browser_player import browser_play_href, set_browser_player_settings

    with app.app_context():
        # Not installed: the admin cannot even choose it, so WebRetro it is.
        assert browser_play_href(game_uuid='g1', core='fceumm', platform_key='NES').startswith(
            '/static/vendor/webretro/webretro.html?'
        )

        _install_emulatorjs(tmp_path, monkeypatch)
        set_browser_player_settings({'browser_player_default': 'emulatorjs'})
        with app.test_request_context('/'):
            href = browser_play_href(game_uuid='g1', core='fceumm', platform_key='NES')
            assert href == '/static/vendor/emulatorjs/play.html?guid=g1&core=nes&platform=NES'
            # A system EmulatorJS has no core for stays on WebRetro, silently.
            fallback = browser_play_href(game_uuid='g2', core='pcsx2', platform_key='PS2')
            assert fallback.startswith('/static/vendor/webretro/webretro.html?')
            assert 'core=pcsx2' in fallback

        set_browser_player_settings({'browser_player_default': 'webretro'})


def test_emulatorjs_play_shell_keeps_the_household_lock():
    """ROM from this origin, data from this origin, no third-party frame."""
    from pathlib import Path

    shell = Path('oneirodex/static/vendor/emulatorjs/play.html').read_text(encoding='utf-8')
    assert "'/api/downloadrom/'" in shell
    assert "EJS_pathtodata = '/static/vendor/emulatorjs/data/'" in shell
    assert 'EJS_threads = false' in shell
    assert 'cdn.emulatorjs.org' not in shell


# --- BP-2 member half: the member's engine choice -------------------------------


def test_resolve_engine_is_pure_and_honest():
    from oneirodex.utils.browser_player import resolve_engine

    both = ('webretro', 'emulatorjs')
    allow = {'browser_player_allow_member_choice': True, 'browser_player_default': 'webretro'}
    deny = {'browser_player_allow_member_choice': False, 'browser_player_default': 'webretro'}
    # Member choice wins only when the admin allows it AND it is installed.
    assert resolve_engine(settings=allow, preference='emulatorjs', available=both) == 'emulatorjs'
    assert resolve_engine(settings=deny, preference='emulatorjs', available=both) == 'webretro'
    assert resolve_engine(settings=allow, preference='emulatorjs', available=('webretro',)) == 'webretro'
    # No preference -> admin default; an uninstalled admin default -> WebRetro.
    ejs_default = {'browser_player_allow_member_choice': True, 'browser_player_default': 'emulatorjs'}
    assert resolve_engine(settings=ejs_default, preference=None, available=both) == 'emulatorjs'
    assert resolve_engine(settings=ejs_default, preference=None, available=('webretro',)) == 'webretro'
    # A member explicitly choosing WebRetro over an EmulatorJS default is honoured.
    assert resolve_engine(settings=ejs_default, preference='webretro', available=both) == 'webretro'


def test_member_preference_routes_play_href(app, db_session, tmp_path, monkeypatch):
    """The Play link and the payload's `browser_player` agree, per member."""
    from oneirodex.models import UserPreference

    _install_emulatorjs(tmp_path, monkeypatch)
    uid = str(uuid4())
    member = User(
        name=f'bpmember_{uid[:8]}', email=f'bpmember_{uid[:8]}@example.com',
        role='user', user_id=uid, state=True,
    )
    member.set_password('password123')
    db_session.add(member)
    db_session.flush()
    db_session.add(UserPreference(user_id=member.id, browser_player_engine='emulatorjs'))
    db_session.commit()

    # get_browser_player_settings() caches on `g` for the app context, and the
    # `app` fixture keeps one pushed for the whole test — so the cache has to
    # be dropped by hand between the two halves. Real requests get a fresh one.
    from flask import g

    with app.app_context():
        set_browser_player_settings({
            'browser_player_default': 'webretro',
            'browser_player_allow_member_choice': False,
        })
    with app.test_request_context('/'):
        login_user(member)
        fields = play_engine_fields()
        assert fields['browser_player'] == 'webretro'
        assert fields['browser_player_member_choice'] is False
        assert fields['browser_player_preference'] is None
        assert browser_play_href(game_uuid='g1', core='fceumm', platform_key='NES').startswith(
            '/static/vendor/webretro/'
        )

    with app.app_context():
        set_browser_player_settings({'browser_player_allow_member_choice': True})
    g.pop('_browser_player_settings', None)
    with app.test_request_context('/'):
        login_user(member)
        fields = play_engine_fields()
        assert fields['browser_player'] == 'emulatorjs'
        assert fields['browser_player_default'] == 'webretro'
        assert fields['browser_player_member_choice'] is True
        assert fields['browser_player_preference'] == 'emulatorjs'
        assert browser_play_href(game_uuid='g1', core='fceumm', platform_key='NES') == (
            '/static/vendor/emulatorjs/play.html?guid=g1&core=nes&platform=NES'
        )

    with app.app_context():
        set_browser_player_settings({'browser_player_allow_member_choice': False})


def test_member_choice_is_not_offered_with_one_engine(app, db_session):
    """Allowing choice with only WebRetro installed offers nothing to choose."""
    with app.app_context():
        set_browser_player_settings({'browser_player_allow_member_choice': True})
        with app.test_request_context('/'):
            fields = play_engine_fields()
            assert fields['browser_players_available'] == ['webretro']
            assert fields['browser_player_member_choice'] is False
        set_browser_player_settings({'browser_player_allow_member_choice': False})
