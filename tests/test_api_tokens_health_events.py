"""Tests for API tokens, library health, and event bus."""

import json
from uuid import uuid4

import pytest
from sqlalchemy import select

from gametheca import db
from gametheca.models import ApiToken, Game, Library, User
from gametheca.platform import LibraryPlatform
from gametheca.utils.api_tokens import (
    VALID_SCOPES,
    generate_api_token,
    revoke_api_token,
    verify_bearer_token,
)
from gametheca.utils.event_bus import event_bus
from gametheca.utils.library_health import score_game, summarize_library_health


@pytest.fixture
def user(db_session):
    uid = str(uuid4())
    u = User(
        name=f'tokenuser_{uid[:8]}',
        email=f'token_{uid[:8]}@example.com',
        role='user',
        user_id=uid,
        state=True,
    )
    u.set_password('password123')
    db_session.add(u)
    db_session.commit()
    return u


@pytest.fixture
def admin(db_session):
    uid = str(uuid4())
    u = User(
        name=f'tokenadmin_{uid[:8]}',
        email=f'tokenadmin_{uid[:8]}@example.com',
        role='admin',
        user_id=uid,
        state=True,
    )
    u.set_password('password123')
    db_session.add(u)
    db_session.commit()
    return u


@pytest.fixture
def library(db_session):
    lib = Library(name=f'Lib_{uuid4().hex[:6]}', platform=LibraryPlatform.PCWIN)
    db_session.add(lib)
    db_session.commit()
    return lib


def test_generate_and_verify_api_token(db_session, user):
    row, raw = generate_api_token(user, 'CLI', ['read:library'])
    assert row.token_prefix
    assert raw.startswith('gt_')
    assert 'admin' not in (row.scopes or [])

    found_user, found_token = verify_bearer_token(raw)
    assert found_user.id == user.id
    assert found_token.id == row.id

    bad_user, bad_token = verify_bearer_token('gt_deadbeef_not-a-real-secret')
    assert bad_user is None and bad_token is None


def test_revoke_api_token(db_session, user):
    row, raw = generate_api_token(user, 'temp', ['read:library'])
    assert revoke_api_token(row.id, user_id=user.id) is True
    found_user, _ = verify_bearer_token(raw)
    assert found_user is None


def test_tokens_http_create_list_delete(client, db_session, user):
    row, raw = generate_api_token(user, 'Test', ['read:library'])
    headers = {'Authorization': f'Bearer {raw}'}

    listed = client.get('/api/tokens', headers=headers)
    assert listed.status_code == 200
    body = listed.get_json()
    assert any(t['id'] == row.id for t in body['tokens'])
    assert 'valid_scopes' in body

    created = client.post(
        '/api/tokens',
        headers={**headers, 'Content-Type': 'application/json'},
        data=json.dumps({'name': 'Second', 'scopes': ['read:library']}),
    )
    assert created.status_code == 201
    secret = created.get_json()['secret']
    assert secret.startswith('gt_')

    deleted = client.delete(f'/api/tokens/{row.id}', headers=headers)
    assert deleted.status_code == 200
    assert revoke_api_token(row.id, user_id=user.id) is False


def test_openapi_json_served(client, app):
    resp = client.get('/api/openapi.json')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['openapi'].startswith('3.')
    assert '/api/tokens' in data['paths']


def test_score_game_missing_path(db_session, library):
    game = Game(
        name='Broken Path Game',
        full_disk_path='/definitely/not/a/real/path_' + uuid4().hex,
        library_uuid=library.uuid,
        igdb_id=None,
    )
    db_session.add(game)
    db_session.commit()
    result = score_game(game)
    assert result['score'] < 100
    codes = {i['code'] for i in result['issues']}
    assert 'broken_path' in codes or 'missing_path' in codes
    assert 'missing_igdb' in codes


def test_summarize_library_health(db_session, library):
    game = Game(
        name='Health Summary Game',
        full_disk_path='/tmp/does-not-exist-' + uuid4().hex,
        library_uuid=library.uuid,
        igdb_id=900000000 + (uuid4().int % 100000000),
        summary='A game',
    )
    db_session.add(game)
    db_session.commit()
    summary = summarize_library_health(limit=50, library_uuid=library.uuid)
    assert summary['count'] >= 1
    assert 'average_score' in summary
    assert isinstance(summary['worst'], list)


def test_event_bus_publish_subscribe():
    queue = event_bus.subscribe()
    try:
        event_bus.publish('test', hello=True)
        # Drain until we see our event (history may include older ones)
        found = False
        for _ in range(20):
            try:
                evt = queue.get_nowait()
            except Exception:
                break
            if evt.type == 'test' and evt.payload.get('hello') is True:
                found = True
                break
        assert found
    finally:
        event_bus.unsubscribe(queue)


def test_valid_scopes_frozen():
    assert 'read:library' in VALID_SCOPES
    assert 'read:social' in VALID_SCOPES
    assert 'write:presence' in VALID_SCOPES
    assert 'admin' in VALID_SCOPES
