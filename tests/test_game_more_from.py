"""More-from developer/publisher shelves — vault only, ACL, hide when thin."""

from uuid import uuid4

from oneirodex.models import Developer, Game, Library, Publisher, User
from oneirodex.platform import LibraryPlatform
from oneirodex.utils.game_more_from import build_more_from
from oneirodex.utils.library_acl import set_user_library_allowlist


def _login(client, user):
    with client.session_transaction() as sess:
        sess['_user_id'] = str(user.id)
        sess['_fresh'] = True


def _user(db_session, role='user'):
    uid = str(uuid4())
    user = User(
        name=f'mf_{uid[:8]}',
        email=f'mf_{uid[:8]}@example.test',
        password_hash='hashed',
        role=role,
        user_id=uid,
        state=True,
    )
    db_session.add(user)
    db_session.commit()
    return user


def _library(db_session, platform=LibraryPlatform.PCWIN):
    library = Library(name=f'MF {uuid4().hex[:6]}', platform=platform)
    db_session.add(library)
    db_session.commit()
    return library


def _credit(db_session, model, name):
    row = model(name=name)
    db_session.add(row)
    db_session.commit()
    return row


def _game(db_session, library, name, *, developer=None, publisher=None, rating=70.0):
    game = Game(
        name=name,
        summary='s',
        rating=rating,
        library_uuid=library.uuid,
        developer_id=developer.id if developer else None,
        publisher_id=publisher.id if publisher else None,
    )
    db_session.add(game)
    db_session.commit()
    return game


def test_more_from_hides_when_fewer_than_two_others(db_session):
    user = _user(db_session)
    library = _library(db_session)
    developer = _credit(db_session, Developer, f'Dev {uuid4().hex[:6]}')
    focus = _game(db_session, library, 'Focus', developer=developer)
    _game(db_session, library, 'Only sibling', developer=developer)

    payload = build_more_from(focus, user)
    assert payload['sections'] == []


def test_more_from_lists_developer_siblings(db_session):
    user = _user(db_session)
    library = _library(db_session)
    developer = _credit(db_session, Developer, f'Valve {uuid4().hex[:6]}')
    focus = _game(db_session, library, 'Half-Life', developer=developer, rating=90)
    other_a = _game(db_session, library, 'Portal', developer=developer, rating=88)
    other_b = _game(db_session, library, 'Left 4 Dead', developer=developer, rating=80)

    payload = build_more_from(focus, user)
    assert len(payload['sections']) == 1
    section = payload['sections'][0]
    assert section['title'].startswith('More from ')
    assert section['has_more'] is False
    assert section['total_count'] == 2
    uuids = {row['uuid'] for row in section['games']}
    assert uuids == {other_a.uuid, other_b.uuid}
    assert focus.uuid not in uuids


def test_more_from_skips_duplicate_publisher_when_same_house(db_session):
    user = _user(db_session)
    library = _library(db_session)
    house = _credit(db_session, Developer, f'House {uuid4().hex[:6]}')
    publisher = _credit(db_session, Publisher, house.name)
    focus = _game(db_session, library, 'A', developer=house, publisher=publisher)
    _game(db_session, library, 'B', developer=house, publisher=publisher)
    _game(db_session, library, 'C', developer=house, publisher=publisher)

    payload = build_more_from(focus, user)
    assert len(payload['sections']) == 1
    assert 'developer' in payload['sections'][0]['identifier']


def test_more_from_does_not_leak_restricted_library(db_session):
    adult = _user(db_session, role='user')
    child = _user(db_session, role='child')
    open_lib = _library(db_session)
    hidden_lib = _library(db_session)
    developer = _credit(db_session, Developer, f'Studio {uuid4().hex[:6]}')
    focus = _game(db_session, open_lib, 'Focus', developer=developer)
    visible = _game(db_session, open_lib, 'Visible sibling', developer=developer)
    hidden = _game(db_session, hidden_lib, 'Hidden sibling', developer=developer)
    extra = _game(db_session, open_lib, 'Second visible', developer=developer)
    set_user_library_allowlist(child.id, [open_lib.uuid])
    db_session.commit()

    adult_uuids = {
        row['uuid']
        for row in build_more_from(focus, adult)['sections'][0]['games']
    }
    child_payload = build_more_from(focus, child)
    child_uuids = {
        row['uuid']
        for row in child_payload['sections'][0]['games']
    }
    assert hidden.uuid in adult_uuids
    assert hidden.uuid not in child_uuids
    assert {visible.uuid, extra.uuid} <= child_uuids


def test_more_from_route_envelope(client, db_session, configured_install):
    user = _user(db_session)
    library = _library(db_session)
    developer = _credit(db_session, Developer, f'API {uuid4().hex[:6]}')
    focus = _game(db_session, library, 'API focus', developer=developer)
    _game(db_session, library, 'API other a', developer=developer)
    _game(db_session, library, 'API other b', developer=developer)
    _login(client, user)

    response = client.get(f'/api/games/{focus.uuid}/more_from')
    assert response.status_code == 200
    body = response.get_json()
    assert body['ok'] is True
    assert body['error'] is None
    assert len(body['sections']) == 1
    assert body['sections'][0]['has_more'] is False


def test_more_from_route_refuses_child_without_library(client, db_session, configured_install):
    child = _user(db_session, role='child')
    library = _library(db_session)
    game = _game(db_session, library, 'Locked')
    _login(client, child)

    response = client.get(f'/api/games/{game.uuid}/more_from')
    assert response.status_code == 403
    body = response.get_json()
    assert body['ok'] is False
    assert body['error_code'] == 'forbidden'
