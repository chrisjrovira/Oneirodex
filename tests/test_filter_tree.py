"""The nested AND/OR filter tree and the named filters built on it (INSP-3).

The chip row can only mean *and*. These cover the two things that makes newly
possible -- a real `or`, and a real `not` -- plus the two properties that make
it safe to accept a tree from a browser: it can only name fields the chips
already offer, and its shape is bounded.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from oneirodex import db
from oneirodex.models import Game, Library, User
from oneirodex.platform import LibraryPlatform
from oneirodex.utils.filter_tree import (
    FIELDS,
    MAX_DEPTH,
    MAX_NODES,
    FilterTreeError,
    compile_filter_tree,
    describe_fields,
    parse_filter_tree,
)


# --- parsing ----------------------------------------------------------------


def test_a_leaf_can_only_name_a_field_the_chips_already_offer():
    """The whitelist is the safety property: a tree cannot reach a column the
    chip row cannot, so adding one is a deliberate act rather than a side
    effect of the model gaining a field."""
    with pytest.raises(FilterTreeError) as exc:
        parse_filter_tree({'field': 'full_disk_path', 'value': '/etc'})
    assert 'full_disk_path' in str(exc.value)

    # And the ones that do exist parse.
    for field in FIELDS:
        value = {'vr_compat': 'flat', 'path_status': ['ok'], 'item_kind': ['game'], 'name': 'x'}.get(
            field, True
        )
        parse_filter_tree({'field': field, 'value': value})


def test_a_malformed_tree_says_which_part_is_wrong():
    """A builder with fifteen rows needs the offending row, not 'invalid'."""
    tree = {
        'op': 'and',
        'nodes': [
            {'field': 'is_vr', 'value': True},
            {'op': 'or', 'nodes': [
                {'field': 'new_import', 'value': True},
                {'field': 'nope', 'value': True},
            ]},
        ],
    }
    with pytest.raises(FilterTreeError) as exc:
        parse_filter_tree(tree)
    assert exc.value.path == 'root.1.1'


def test_shape_is_bounded_in_both_directions():
    deep = {'field': 'is_vr', 'value': True}
    for _ in range(MAX_DEPTH + 2):
        deep = {'op': 'and', 'nodes': [deep]}
    with pytest.raises(FilterTreeError) as exc:
        parse_filter_tree(deep)
    assert 'deeper' in str(exc.value)

    wide = {'op': 'or', 'nodes': [{'field': 'is_vr', 'value': True}] * (MAX_NODES + 5)}
    with pytest.raises(FilterTreeError) as exc:
        parse_filter_tree(wide)
    assert 'parts' in str(exc.value)


def test_a_group_with_no_parts_is_refused():
    with pytest.raises(FilterTreeError):
        parse_filter_tree({'op': 'and', 'nodes': []})


def test_an_enum_leaf_refuses_a_value_the_field_does_not_take():
    with pytest.raises(FilterTreeError) as exc:
        parse_filter_tree({'field': 'vr_compat', 'value': 'sideloaded'})
    assert 'sideloaded' in str(exc.value)


def test_a_json_string_is_accepted_because_that_is_what_a_query_param_is():
    tree = parse_filter_tree(json.dumps({'field': 'is_vr', 'value': True}))
    assert tree == {'field': 'is_vr', 'value': True}
    with pytest.raises(FilterTreeError):
        parse_filter_tree('{not json')


def test_describe_fields_tells_a_builder_what_each_field_takes():
    rows = {row['field']: row for row in describe_fields()}
    assert rows['is_vr']['kind'] == 'flag'
    assert 'flat' in rows['vr_compat']['values']
    assert set(rows) == set(FIELDS)


# --- compiling, against real rows -------------------------------------------


def _user(session):
    tag = uuid4().hex[:8]
    user = User(
        name=f'filt-{tag}', email=f'filt-{tag}@example.com', password_hash='unused',
        role='user', user_id=str(uuid4()), state=True,
    )
    user.set_password('password123')
    session.add(user)
    session.commit()
    return user


def _library(session):
    library = Library(uuid=str(uuid4()), name='Filters', platform=LibraryPlatform.NES)
    session.add(library)
    session.flush()
    return library


def _game(session, library, name, **kwargs):
    game = Game(
        uuid=str(uuid4()),
        name=name,
        library_uuid=library.uuid,
        full_disk_path=f'/test/{uuid4().hex}.nes',
        **kwargs,
    )
    session.add(game)
    session.flush()
    return game


def _names(clause):
    rows = db.session.execute(db.select(Game).filter(clause)).scalars().all()
    return sorted(g.name for g in rows)


def test_or_is_the_question_the_chip_row_could_never_ask(db_session):
    """"Behind, OR imported this fortnight" — three chips cannot say this."""
    library = _library(db_session)
    fresh = datetime.now(timezone.utc) - timedelta(days=2)
    old = datetime.now(timezone.utc) - timedelta(days=400)
    behind = _game(db_session, library, 'Behind', freshness_status='behind', date_identified=old)
    recent = _game(db_session, library, 'Recent', date_identified=fresh)
    _game(db_session, library, 'Neither', date_identified=old)

    clause = compile_filter_tree({
        'op': 'or',
        'nodes': [
            {'field': 'freshness_behind', 'value': True},
            {'field': 'new_import', 'value': True},
        ],
    })
    assert _names(clause) == sorted([behind.name, recent.name])


def test_not_excludes_rather_than_widening(db_session):
    library = _library(db_session)
    old = datetime.now(timezone.utc) - timedelta(days=400)
    _game(db_session, library, 'Behind two', freshness_status='behind', date_identified=old)
    keeper = _game(db_session, library, 'Current two', date_identified=old)

    clause = compile_filter_tree({
        'op': 'not',
        'nodes': [{'field': 'freshness_behind', 'value': True}],
    })
    assert keeper.name in _names(clause)
    assert 'Behind two' not in _names(clause)


def test_a_flag_set_to_false_means_not_this_rather_than_ignore_this(db_session):
    """Unticking a row in a builder must narrow, never silently widen."""
    library = _library(db_session)
    old = datetime.now(timezone.utc) - timedelta(days=400)
    _game(db_session, library, 'Behind three', freshness_status='behind', date_identified=old)
    keeper = _game(db_session, library, 'Current three', date_identified=old)

    clause = compile_filter_tree({'field': 'freshness_behind', 'value': False})
    found = _names(clause)
    assert keeper.name in found
    assert 'Behind three' not in found


def test_the_tree_and_the_chip_row_compile_the_same_sql(db_session):
    """One definition per field, so the two faces cannot drift apart."""
    from oneirodex.utils.browse_filters import apply_badge_filters

    library = _library(db_session)
    old = datetime.now(timezone.utc) - timedelta(days=400)
    _game(db_session, library, 'Behind four', freshness_status='behind', date_identified=old)
    _game(db_session, library, 'Current four', date_identified=old)

    via_chip = apply_badge_filters(db.select(Game), {'freshness_behind': '1'})
    via_tree = db.select(Game).filter(
        compile_filter_tree({'field': 'freshness_behind', 'value': True})
    )
    chip_names = sorted(g.name for g in db.session.execute(via_chip).scalars().all())
    tree_names = sorted(g.name for g in db.session.execute(via_tree).scalars().all())
    assert chip_names == tree_names
    assert 'Behind four' in chip_names


# --- the routes -------------------------------------------------------------


def _login(client, user):
    # Clear first: these tests switch members inside one client, and merging a
    # new id into a session that still holds the previous one leaves Flask-Login
    # free to keep the old identity.
    with client.session_transaction() as sess:
        sess.clear()
        sess['_user_id'] = str(user.id)
        sess['_fresh'] = True


def test_a_filter_is_saved_read_back_and_deleted(client, db_session, configured_install):
    user = _user(db_session)
    _login(client, user)

    tree = {'op': 'or', 'nodes': [
        {'field': 'is_vr', 'value': True},
        {'field': 'new_import', 'value': True},
    ]}
    created = client.post('/api/filters/saved', json={'name': 'VR or new', 'tree': tree})
    assert created.status_code == 201, created.get_json()
    row_id = created.get_json()['filter']['id']

    listed = client.get('/api/filters/saved').get_json()
    assert [f['name'] for f in listed['filters']] == ['VR or new']

    renamed = client.put(f'/api/filters/saved/{row_id}', json={'name': 'Weekend'})
    assert renamed.status_code == 200
    assert renamed.get_json()['filter']['name'] == 'Weekend'
    # Renaming must not require re-sending the tree the UI may not have loaded.
    assert renamed.get_json()['filter']['tree'] == tree

    assert client.delete(f'/api/filters/saved/{row_id}').status_code == 200
    assert client.get('/api/filters/saved').get_json()['filters'] == []


def test_two_filters_cannot_share_a_name_because_the_name_is_the_picker(client, db_session, configured_install):
    user = _user(db_session)
    _login(client, user)
    body = {'name': 'Same', 'tree': {'field': 'is_vr', 'value': True}}
    assert client.post('/api/filters/saved', json=body).status_code == 201
    clash = client.post('/api/filters/saved', json=body)
    assert clash.status_code == 409
    assert clash.get_json()['error_code'] == 'conflict'


def test_one_member_cannot_touch_another_members_filter(client, db_session, configured_install):
    """Scoping is by owner, not by id.

    Written against a row planted for someone else rather than by signing in as
    a second member: the test harness reuses one app context across requests
    and Flask-Login caches the identity on `g`, so switching members inside a
    test proves nothing about the route.
    """
    from oneirodex.models import SavedFilter

    me = _user(db_session)
    someone_else = _user(db_session)
    theirs = SavedFilter(
        user_id=someone_else.id,
        name='Theirs',
        tree={'field': 'is_vr', 'value': True},
    )
    db_session.add(theirs)
    db_session.commit()

    _login(client, me)
    assert client.get('/api/filters/saved').get_json()['filters'] == []
    assert client.put(f'/api/filters/saved/{theirs.id}', json={'name': 'Mine now'}).status_code == 404
    assert client.delete(f'/api/filters/saved/{theirs.id}').status_code == 404
    # Still there, untouched.
    assert db_session.get(SavedFilter, theirs.id).name == 'Theirs'


def test_saving_a_tree_we_will_not_run_is_refused_with_the_offending_path(client, db_session, configured_install):
    user = _user(db_session)
    _login(client, user)
    bad = client.post(
        '/api/filters/saved',
        json={'name': 'Bad', 'tree': {'op': 'and', 'nodes': [{'field': 'sudo', 'value': True}]}},
    )
    assert bad.status_code == 400
    body = bad.get_json()
    assert body['error_code'] == 'bad_request'
    assert body['detail']['path'] == 'root.0'


def test_preview_counts_through_the_members_own_access_filters(client, db_session, configured_install):
    user = _user(db_session)
    library = _library(db_session)
    old = datetime.now(timezone.utc) - timedelta(days=400)
    _game(db_session, library, 'Behind five', freshness_status='behind', date_identified=old)
    _game(db_session, library, 'Current five', date_identified=old)
    db_session.commit()

    _login(client, user)
    res = client.post(
        '/api/filters/preview',
        json={'tree': {'field': 'freshness_behind', 'value': True}, 'limit': 5},
    )
    assert res.status_code == 200
    body = res.get_json()
    assert body['count'] >= 1
    assert any(row['name'] == 'Behind five' for row in body['sample'])


def test_browse_refuses_a_filter_it_will_not_run_rather_than_ignoring_it(client, db_session, configured_install):
    """Dropping the filter would hand back the whole library and let the member
    read that as the answer to the question they asked."""
    user = _user(db_session)
    _login(client, user)
    res = client.get('/browse_games', query_string={'filter_tree': json.dumps({'field': 'nope'})})
    assert res.status_code == 400
    assert res.get_json()['error_code'] == 'bad_request'


def test_browse_applies_the_tree_beside_the_chips_not_instead_of_them(client, db_session, configured_install):
    library = _library(db_session)
    user = _user(db_session)
    old = datetime.now(timezone.utc) - timedelta(days=400)
    _game(db_session, library, 'Zeta behind', freshness_status='behind', date_identified=old)
    _game(db_session, library, 'Zeta current', date_identified=old)
    db_session.commit()

    _login(client, user)
    res = client.get(
        '/browse_games',
        query_string={
            'name': 'Zeta',
            'filter_tree': json.dumps({'field': 'freshness_behind', 'value': True}),
        },
    )
    assert res.status_code == 200
    names = [g['name'] for g in res.get_json().get('games', [])]
    assert 'Zeta behind' in names
    assert 'Zeta current' not in names
