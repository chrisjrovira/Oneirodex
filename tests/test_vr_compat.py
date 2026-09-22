"""Rider R3 (v11 H-T, P3): ``Game.vr_compat`` beside the derived ``is_vr``.

Catalogue data only: a stored value from a librarian, else ``native_vr``
when the perspectives say VR, else unknown. Never a guessed ``flat``.
"""
from __future__ import annotations

from uuid import uuid4

import pytest
from flask_login import login_user
from sqlalchemy import select

from oneirodex.models import Game, Library, PlayerPerspective, User
from oneirodex.platform import LibraryPlatform
from oneirodex.utils.browse_filters import apply_badge_filters
from oneirodex.utils.secondary_scrapers import VR_PERSPECTIVE_NAME, game_card_flags, game_vr_compat


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


@pytest.fixture
def member(db_session):
    uid = str(uuid4())
    row = User(
        name=f'mem_{uid[:8]}',
        email=f'mem_{uid[:8]}@example.com',
        role='user',
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


def _vr_perspective(db_session):
    row = db_session.execute(
        select(PlayerPerspective).filter_by(name=VR_PERSPECTIVE_NAME).limit(1),
    ).scalars().first()
    if row is None:
        row = PlayerPerspective(name=VR_PERSPECTIVE_NAME)
        db_session.add(row)
        db_session.flush()
    return row


@pytest.fixture
def games(db_session, tmp_path):
    lib = Library(name=f'VRLib_{uuid4().hex[:6]}', platform=LibraryPlatform.PCWIN)
    db_session.add(lib)
    db_session.flush()
    vr = _vr_perspective(db_session)
    native = Game(uuid=str(uuid4()), name=f'Native {uuid4().hex[:6]}', library_uuid=lib.uuid, full_disk_path=str(tmp_path / 'n'))
    native.player_perspectives.append(vr)
    injector = Game(uuid=str(uuid4()), name=f'Injector {uuid4().hex[:6]}', library_uuid=lib.uuid, full_disk_path=str(tmp_path / 'i'), vr_compat='injector_profile')
    flat = Game(uuid=str(uuid4()), name=f'Flat {uuid4().hex[:6]}', library_uuid=lib.uuid, full_disk_path=str(tmp_path / 'f'), vr_compat='flat')
    unknown = Game(uuid=str(uuid4()), name=f'Unknown {uuid4().hex[:6]}', library_uuid=lib.uuid, full_disk_path=str(tmp_path / 'u'))
    db_session.add_all([native, injector, flat, unknown])
    db_session.commit()
    return {'native': native, 'injector': injector, 'flat': flat, 'unknown': unknown, 'lib': lib}


def test_vr_compat_is_derived_unless_stored(games):
    assert game_vr_compat(games['native']) == 'native_vr'
    assert game_vr_compat(games['injector']) == 'injector_profile'
    assert game_vr_compat(games['flat']) == 'flat'
    assert game_vr_compat(games['unknown']) is None
    flags = game_card_flags(games['native'])
    assert flags['is_vr'] is True and flags['vr_compat'] == 'native_vr'
    assert game_card_flags(games['unknown'])['vr_compat'] is None


def test_browse_filter_vr_compat(db_session, games):
    lib = games['lib']

    def uuids(arg):
        query = select(Game).where(Game.library_uuid == lib.uuid)
        query = apply_badge_filters(query, {'vr_compat': arg})
        return {g.uuid for g in db_session.execute(query).scalars().all()}

    assert uuids('native_vr') == {games['native'].uuid}
    assert uuids('injector_profile') == {games['injector'].uuid}
    assert uuids('flat') == {games['flat'].uuid}
    assert uuids('nonsense') == {g.uuid for k, g in games.items() if k != 'lib'}


def test_patch_vr_compat_is_librarian_only(client, app, member, games):
    _login(client, app, member)
    resp = client.patch(f'/api/games/{games["unknown"].uuid}/vr_compat', json={'vr_compat': 'flat'})
    assert resp.status_code in (302, 403)


def test_patch_vr_compat_roundtrip_and_clear(client, app, admin, db_session, games):
    _login(client, app, admin)
    target = games['unknown']

    resp = client.patch(f'/api/games/{target.uuid}/vr_compat', json={'vr_compat': 'injector_profile'})
    assert resp.status_code == 200, resp.get_json()
    body = resp.get_json()
    assert body['ok'] is True and body['vr_compat'] == 'injector_profile'
    db_session.refresh(target)
    assert target.vr_compat == 'injector_profile'

    resp = client.patch(f'/api/games/{target.uuid}/vr_compat', json={'vr_compat': None})
    assert resp.status_code == 200
    assert resp.get_json()['vr_compat'] is None
    db_session.refresh(target)
    assert target.vr_compat is None

    resp = client.patch(f'/api/games/{target.uuid}/vr_compat', json={'vr_compat': 'dll_shim'})
    assert resp.status_code == 422

    resp = client.patch(f'/api/games/{uuid4()}/vr_compat', json={'vr_compat': 'flat'})
    assert resp.status_code == 404


def test_vr_hub_admits_stored_vr_compat_and_filters(client, app, admin, games):
    """P4: the /vr hub lists perspective-tagged *and* librarian-stored titles,
    a stored `flat` removes a title, and `?vr_compat=` narrows the hub."""
    _login(client, app, admin)
    app.config['ENABLE_VR_BROWSE'] = True

    def hub(query=''):
        resp = client.get(f'/api/vr/catalog?per_page=100{query}')
        assert resp.status_code == 200
        return {g['uuid']: g['vr_compat'] for g in resp.get_json()['games'] if g['uuid'] in {x.uuid for k, x in games.items() if k != 'lib'}}

    everything = hub()
    assert everything == {games['native'].uuid: 'native_vr', games['injector'].uuid: 'injector_profile'}
    assert games['flat'].uuid not in everything and games['unknown'].uuid not in everything
    assert set(hub('&vr_compat=native_vr')) == {games['native'].uuid}
    assert set(hub('&vr_compat=injector_profile')) == {games['injector'].uuid}

    detail = client.get(f'/api/vr/games/{games["injector"].uuid}')
    assert detail.status_code == 200 and detail.get_json()['vr_compat'] == 'injector_profile'
    assert client.get(f'/api/vr/games/{games["flat"].uuid}').status_code == 404
