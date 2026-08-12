"""Browse path_status exposure + missing filter + library-add digest notify."""

from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy import delete, select

from gametheca.models import Game, GlobalSettings, Library, User, UserNotification
from gametheca.platform import LibraryPlatform
from gametheca.utils.library_health import (
    PATH_STATUS_MISSING,
    PATH_STATUS_OK,
    path_health_fields,
)
from gametheca.utils.notifications import (
    _flush_library_add_digest,
    _reset_library_add_digests_for_tests,
    notify_admins_new_game,
    schedule_library_add_digest,
)
from gametheca.utils.secondary_scrapers import game_card_flags


@pytest.fixture(autouse=True)
def _reset_digests():
    _reset_library_add_digests_for_tests()
    yield
    _reset_library_add_digests_for_tests()


@pytest.fixture
def path_user(db_session):
    tag = uuid4().hex[:8]
    user = User(
        name=f'path-{tag}',
        email=f'path-{tag}@example.com',
        password_hash='unused',
        role='user',
        user_id=str(uuid4()),
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def admin_staff(db_session):
    tag = uuid4().hex[:8]
    admin = User(
        name=f'adm-{tag}',
        email=f'adm-{tag}@example.com',
        password_hash='unused',
        role='admin',
        user_id=str(uuid4()),
        state=True,
    )
    librarian = User(
        name=f'lib-{tag}',
        email=f'lib-{tag}@example.com',
        password_hash='unused',
        role='librarian',
        user_id=str(uuid4()),
        state=True,
    )
    db_session.add_all([admin, librarian])
    db_session.commit()
    return admin, librarian


@pytest.fixture
def path_library(db_session):
    rows = db_session.execute(select(GlobalSettings).order_by(GlobalSettings.id)).scalars().all()
    if len(rows) > 1:
        keep_id = rows[0].id
        db_session.execute(delete(GlobalSettings).where(GlobalSettings.id != keep_id))
        db_session.commit()
    elif not rows:
        db_session.add(GlobalSettings())
        db_session.commit()
    settings = db_session.execute(select(GlobalSettings).order_by(GlobalSettings.id).limit(1)).scalars().first()
    if settings is not None:
        settings.admin_notify_new_games = True
        db_session.commit()

    library = Library(
        name=f'Path Lib {uuid4().hex[:8]}',
        platform=LibraryPlatform.PCWIN,
        display_order=1,
    )
    db_session.add(library)
    db_session.commit()
    return library


def _login(client, user):
    with client.session_transaction() as sess:
        sess['_user_id'] = str(user.id)
        sess['_fresh'] = True


def test_path_health_fields_and_card_flags():
    class _G:
        path_status = PATH_STATUS_MISSING

    fields = path_health_fields(_G())
    assert fields == {'path_status': 'missing', 'path_missing': True}
    flags = game_card_flags(_G())
    assert flags['path_status'] == 'missing'
    assert flags['path_missing'] is True


def test_browse_games_includes_path_status(client, db_session, path_user, path_library):
    ok = Game(
        uuid=str(uuid4()),
        name='Path OK Title',
        library_uuid=path_library.uuid,
        full_disk_path=f'/test/path/{uuid4().hex}',
        path_status=PATH_STATUS_OK,
    )
    missing = Game(
        uuid=str(uuid4()),
        name='Path Missing Title',
        library_uuid=path_library.uuid,
        full_disk_path=f'/test/path/{uuid4().hex}',
        path_status=PATH_STATUS_MISSING,
    )
    db_session.add_all([ok, missing])
    db_session.commit()

    _login(client, path_user)
    # Scoped to this test's library. /browse_games sorts by name and paginates,
    # so with games left behind by other files the two titles below can simply
    # fall off the first page — which showed up as a KeyError on a title the
    # test had definitely just created.
    response = client.get(f'/browse_games?per_page=50&library_uuid={path_library.uuid}')
    assert response.status_code == 200
    by_name = {g['name']: g for g in response.get_json()['games']}
    assert by_name['Path OK Title']['path_status'] == 'ok'
    assert by_name['Path OK Title']['path_missing'] is False
    assert by_name['Path Missing Title']['path_status'] == 'missing'
    assert by_name['Path Missing Title']['path_missing'] is True


def test_browse_games_path_status_missing_filter(client, db_session, path_user, path_library):
    ok = Game(
        uuid=str(uuid4()),
        name='Keep OK',
        library_uuid=path_library.uuid,
        full_disk_path=f'/test/path/{uuid4().hex}',
        path_status=PATH_STATUS_OK,
    )
    missing = Game(
        uuid=str(uuid4()),
        name='Only Missing',
        library_uuid=path_library.uuid,
        full_disk_path=f'/test/path/{uuid4().hex}',
        path_status=PATH_STATUS_MISSING,
    )
    db_session.add_all([ok, missing])
    db_session.commit()

    _login(client, path_user)
    response = client.get('/browse_games?path_status=missing&per_page=50')
    assert response.status_code == 200
    names = {g['name'] for g in response.get_json()['games']}
    assert 'Only Missing' in names
    assert 'Keep OK' not in names


def test_library_watch_get_put(client, db_session, admin_staff, path_library, monkeypatch):
    admin, _librarian = admin_staff
    monkeypatch.setenv('GT_LIBRARY_WATCH', '1')
    _login(client, admin)

    get_resp = client.get(f'/api/library/{path_library.uuid}')
    assert get_resp.status_code == 200
    body = get_resp.get_json()
    assert body['watch_enabled'] is None
    assert body['watch_effective'] is True
    assert body['watch_global_enabled'] is True

    put_resp = client.put(
        f'/api/library/{path_library.uuid}/watch',
        json={'watch_enabled': False},
    )
    assert put_resp.status_code == 200
    assert put_resp.get_json()['watch_enabled'] is False
    assert put_resp.get_json()['watch_effective'] is False

    db_session.refresh(path_library)
    assert path_library.watch_enabled is False


def test_library_add_digest_notifies_staff(app, db_session, admin_staff, path_library):
    admin, librarian = admin_staff
    g1 = Game(
        uuid=str(uuid4()),
        name='Digest One',
        library_uuid=path_library.uuid,
        full_disk_path=f'/test/digest/{uuid4().hex}',
        path_status=PATH_STATUS_OK,
    )
    g2 = Game(
        uuid=str(uuid4()),
        name='Digest Two',
        library_uuid=path_library.uuid,
        full_disk_path=f'/test/digest/{uuid4().hex}',
        path_status=PATH_STATUS_OK,
    )
    db_session.add_all([g1, g2])
    db_session.commit()

    with app.app_context():
        schedule_library_add_digest(
            library_uuid=path_library.uuid,
            library_name=path_library.name,
            game_uuid=g1.uuid,
            game_name=g1.name,
            debounce_seconds=60,
            app=app,
        )
        schedule_library_add_digest(
            library_uuid=path_library.uuid,
            library_name=path_library.name,
            game_uuid=g2.uuid,
            game_name=g2.name,
            debounce_seconds=60,
            app=app,
        )
        _flush_library_add_digest(path_library.uuid, app)

    rows = db_session.execute(select(UserNotification)).scalars().all()
    staff_ids = {admin.id, librarian.id}
    digests = [r for r in rows if r.kind == 'library_added' and r.user_id in staff_ids]
    assert len(digests) >= 2
    sample = digests[0]
    assert sample.payload.get('count') == 2
    assert sample.payload.get('library_uuid') == path_library.uuid
    assert path_library.name in sample.title


def test_notify_admins_new_game_schedules_digest(app, db_session, admin_staff, path_library):
    game = Game(
        uuid=str(uuid4()),
        name='Notify Path',
        library_uuid=path_library.uuid,
        full_disk_path=f'/test/notify/{uuid4().hex}',
        path_status=PATH_STATUS_OK,
    )
    db_session.add(game)
    db_session.commit()

    with app.app_context():
        _reset_library_add_digests_for_tests()
        notify_admins_new_game(game.uuid, game.name)
        _flush_library_add_digest(path_library.uuid, app)

    rows = db_session.execute(
        select(UserNotification).where(
            UserNotification.kind == 'library_added',
        )
    ).scalars().all()
    matching = [
        r for r in rows
        if (r.payload or {}).get('library_uuid') == path_library.uuid
        and (r.payload or {}).get('count') == 1
        and game.uuid in ((r.payload or {}).get('game_uuids') or [])
    ]
    assert matching, f'expected digest for {path_library.uuid}; got {[r.payload for r in rows]}'
