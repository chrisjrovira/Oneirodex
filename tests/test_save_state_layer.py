"""Save-state layer (Phase 4): resume on tiles, slot vocabulary, the shell's prompt.

Storage existed (`EmulatorSave`, `/api/games/<uuid>/saves`); what was missing
was the member-facing half — a tile that says *Resume*, a shell that asks
before loading, an auto-state on quit, named quick saves. The backend bits are
behavioural tests; the shell bits are source assertions, because a missing
resume bar still renders a playable room and nothing else would notice.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from uuid import uuid4

from oneirodex.models import EmulatorSave, Game, Library, User
from oneirodex.platform import LibraryPlatform
from oneirodex.utils.emulator_saves import (
    AUTO_STATE_SLOT,
    CLOUD_SRAM_SLOT,
    CLOUD_STATE_SLOT,
    QUICK_SAVE_PREFIX,
    is_state_slot,
    latest_state_by_game,
)

ROOT = Path(__file__).resolve().parents[1]
WEBRETRO = ROOT / 'oneirodex' / 'static' / 'vendor' / 'webretro'


def _library(db_session):
    library = Library(name=f'NES {uuid4().hex[:8]}', platform=LibraryPlatform.NES, display_order=1)
    db_session.add(library)
    db_session.commit()
    return library


def _game(db_session, library):
    game = Game(
        uuid=str(uuid4()),
        name=f'Save probe {uuid4().hex[:6]}',
        library_uuid=library.uuid,
        full_disk_path=f'/test/saves/{uuid4().hex}.nes',
    )
    db_session.add(game)
    db_session.commit()
    return game


def _user(db_session):
    tag = uuid4().hex[:8]
    user = User(
        name=f'saves-{tag}', email=f'saves-{tag}@example.com', password_hash='unused',
        role='user', user_id=str(uuid4()), state=True,
    )
    user.set_password('password123')
    db_session.add(user)
    db_session.commit()
    return user


def _row(db_session, user, game, slot, *, filename='cloud.state', age_minutes=0):
    when = datetime.now(timezone.utc) - timedelta(minutes=age_minutes)
    row = EmulatorSave(
        user_id=user.id, game_uuid=game.uuid, slot_name=slot, filename=filename,
        size_bytes=3, storage_path=f'/nonexistent/{uuid4().hex}', encrypted=False,
        created_at=when, updated_at=when,
    )
    db_session.add(row)
    db_session.commit()
    return row


def _login(client, user):
    with client.session_transaction() as sess:
        sess['_user_id'] = str(user.id)
        sess['_fresh'] = True


# --- slot vocabulary ---------------------------------------------------------


def test_state_slots_are_states_and_sram_is_not():
    def row(slot, filename='cloud.state'):
        return EmulatorSave(slot_name=slot, filename=filename)

    assert is_state_slot(row(AUTO_STATE_SLOT))
    assert is_state_slot(row(CLOUD_STATE_SLOT))
    assert is_state_slot(row('cloud1'))  # legacy Wave 7 placeholder
    assert is_state_slot(row(QUICK_SAVE_PREFIX + 'before-boss'))
    assert not is_state_slot(row(CLOUD_SRAM_SLOT, 'cloud.srm'))
    # An older ad-hoc slot is judged by what it holds.
    assert is_state_slot(row('slot1', 'game.state'))
    assert not is_state_slot(row('slot1', 'game.srm'))


# --- latest state per game, one query ----------------------------------------


def test_latest_state_by_game_picks_the_newest_state_and_skips_sram(db_session):
    user = _user(db_session)
    library = _library(db_session)
    played = _game(db_session, library)
    sram_only = _game(db_session, library)
    untouched = _game(db_session, library)

    _row(db_session, user, played, CLOUD_STATE_SLOT, age_minutes=60)
    newest = _row(db_session, user, played, AUTO_STATE_SLOT, age_minutes=5)
    _row(db_session, user, played, CLOUD_SRAM_SLOT, filename='cloud.srm', age_minutes=1)
    _row(db_session, user, sram_only, CLOUD_SRAM_SLOT, filename='cloud.srm')

    latest = latest_state_by_game(user.id, [played.uuid, sram_only.uuid, untouched.uuid])
    assert set(latest) == {played.uuid}
    assert latest[played.uuid]['slot_name'] == AUTO_STATE_SLOT
    assert latest[played.uuid]['updated_at'] == newest.updated_at.isoformat()

    # Someone else's states are not mine.
    other = _user(db_session)
    assert latest_state_by_game(other.id, [played.uuid]) == {}
    assert latest_state_by_game(None, [played.uuid]) == {}
    assert latest_state_by_game(user.id, []) == {}


def test_saves_api_lists_newest_first_and_flags_states(client, db_session, configured_install):
    user = _user(db_session)
    library = _library(db_session)
    game = _game(db_session, library)
    _row(db_session, user, game, CLOUD_STATE_SLOT, age_minutes=30)
    _row(db_session, user, game, CLOUD_SRAM_SLOT, filename='cloud.srm', age_minutes=20)
    _row(db_session, user, game, QUICK_SAVE_PREFIX + 'lab', age_minutes=2)

    _login(client, user)
    body = client.get(f'/api/games/{game.uuid}/saves').get_json()
    slots = [(row['slot_name'], row['is_state']) for row in body['saves']]
    assert slots == [
        (QUICK_SAVE_PREFIX + 'lab', True),
        (CLOUD_SRAM_SLOT, False),
        (CLOUD_STATE_SLOT, True),
    ]


def test_browse_tile_carries_resume_state(client, db_session, configured_install):
    """The tile reads `resume_state` to say Resume instead of Play."""
    user = _user(db_session)
    library = _library(db_session)
    played = _game(db_session, library)
    fresh = _game(db_session, library)
    _row(db_session, user, played, AUTO_STATE_SLOT, age_minutes=3)

    _login(client, user)
    response = client.get(f'/browse_games?library_uuid={library.uuid}&per_page=50')
    assert response.status_code == 200, response.get_json()
    games = {row['uuid']: row for row in response.get_json()['games']}
    assert games[played.uuid]['resume_state']['slot_name'] == AUTO_STATE_SLOT
    assert games[played.uuid]['resume_state']['updated_at']
    assert games[fresh.uuid]['resume_state'] is None


def test_uploading_a_state_updates_the_resume_summary(client, db_session, configured_install, tmp_path, app):
    """Store a state through the API and the tile summary follows it."""
    app.config['EMULATOR_SAVES_PATH'] = str(tmp_path)
    user = _user(db_session)
    library = _library(db_session)
    game = _game(db_session, library)
    _login(client, user)

    response = client.post(
        f'/api/games/{game.uuid}/saves',
        data={'slot': AUTO_STATE_SLOT, 'file': (BytesIO(b'state-bytes'), 'cloud.state')},
        content_type='multipart/form-data',
    )
    assert response.status_code == 201, response.get_json()
    latest = latest_state_by_game(user.id, [game.uuid])
    assert latest[game.uuid]['slot_name'] == AUTO_STATE_SLOT


# --- the shell ---------------------------------------------------------------


def test_shell_asks_before_loading_and_saves_on_leave():
    shell = (WEBRETRO / 'webretro.html').read_text(encoding='utf-8')
    bridge = (WEBRETRO / 'od-bridge.js').read_text(encoding='utf-8')

    # Boot pull imports with autoLoad:false and the resume bar is the only
    # path to od-load-state from a pulled state.
    assert 'autoLoad: false' in shell
    assert 'id="od-resume-bar"' in shell
    assert "getElementById('od-resume-yes')" in shell
    assert 'data.autoLoad !== false' in bridge
    assert 'autoLoaded = autoLoad ? tryLoadState() : false' in bridge

    # Auto-state on quit: Back / Power go through the autosave, capped, with
    # keepalive so the upload survives the navigation.
    assert 'function goBackToLibrary()' in shell
    assert "autoSaveState({ keepalive: true })" in shell
    assert 'keepalive: !!(opts && opts.keepalive)' in shell
    assert "document.addEventListener('visibilitychange'" in shell

    # Named quick saves + the slot vocabulary the backend understands.
    assert 'id="od-saves-panel"' in shell
    assert 'id="od-saves-form"' in shell
    assert f"var AUTO_SLOT = '{AUTO_STATE_SLOT}'" in shell
    assert f"var SYNC_SLOT = '{CLOUD_STATE_SLOT}'" in shell
    assert f"var SRAM_SLOT = '{CLOUD_SRAM_SLOT}'" in shell
    assert f"var QS_PREFIX = '{QUICK_SAVE_PREFIX}'" in shell

    # A `?resume=<slot>` deep link from a tile or the details page is honoured.
    assert "String(args.resume || '')" in shell


def test_shell_never_auto_loads_a_pulled_state():
    """The pre-layer behaviour — `autoLoaded` straight after the boot pull —
    must not come back: the member decides."""
    shell = (WEBRETRO / 'webretro.html').read_text(encoding='utf-8')
    assert 'Cloud saves restored (state loaded)' not in shell
