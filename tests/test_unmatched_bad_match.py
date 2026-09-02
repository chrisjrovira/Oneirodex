"""UX-C5 — operator "bad match" feedback on unmatched rows."""

from __future__ import annotations

from uuid import uuid4

import pytest
from flask import json
from sqlalchemy import text

from oneirodex import db
from oneirodex.models import Library, LibraryPlatform, UnmatchedFolder, User


@pytest.fixture(scope='function', autouse=True)
def clean(db_session):
    db_session.execute(text('TRUNCATE TABLE unmatched_folders RESTART IDENTITY CASCADE'))
    db_session.execute(text('TRUNCATE TABLE libraries RESTART IDENTITY CASCADE'))
    db_session.commit()


@pytest.fixture
def admin_user(db_session):
    uid = str(uuid4())
    user = User(
        name=f'admin_{uid[:8]}',
        email=f'admin_{uid[:8]}@example.com',
        password_hash='hashed_password',
        role='admin',
        user_id=uid,
        avatarpath='newstyle/avatar_default.jpg',
        invite_quota=10,
        is_email_verified=True,
    )
    user.set_password('adminpassword123')
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def folder(db_session):
    library = Library(name='Bad Match Lib', platform=LibraryPlatform.PCWIN, display_order=1)
    db_session.add(library)
    db_session.flush()
    row = UnmatchedFolder(
        library_uuid=library.uuid,
        folder_path='/games/Some Folder',
        status='Unmatched',
    )
    db_session.add(row)
    db_session.commit()
    return row


def _login(client, user):
    with client.session_transaction() as sess:
        sess['_user_id'] = str(user.id)
        sess['_fresh'] = True


def test_reason_vocabulary_is_served_so_ui_never_hardcodes_it(client, admin_user):
    _login(client, admin_user)
    response = client.get('/api/unmatched/bad_match_reasons')
    assert response.status_code == 200
    ids = {r['id'] for r in json.loads(response.data)['reasons']}
    assert {'wrong_game', 'wrong_edition', 'other'} <= ids


def test_flags_with_a_reason(client, app, db_session, admin_user, folder):
    _login(client, admin_user)
    response = client.post(
        f'/api/unmatched/{folder.id}/bad_match',
        json={'reason': 'wrong_edition'},
    )
    assert response.status_code == 200

    row = db.session.get(UnmatchedFolder, folder.id)
    assert row.bad_match_reason == 'wrong_edition'
    assert row.bad_match_at is not None
    assert row.bad_match_by_user_id == admin_user.id


def test_rejects_a_reason_outside_the_vocabulary(client, admin_user, folder):
    _login(client, admin_user)
    response = client.post(
        f'/api/unmatched/{folder.id}/bad_match',
        json={'reason': 'because_i_said_so'},
    )
    assert response.status_code == 400


def test_other_requires_a_note(client, admin_user, folder):
    """'Other' with no note is a shrug, not feedback."""
    _login(client, admin_user)
    bare = client.post(f'/api/unmatched/{folder.id}/bad_match', json={'reason': 'other'})
    assert bare.status_code == 400

    described = client.post(
        f'/api/unmatched/{folder.id}/bad_match',
        json={'reason': 'other', 'note': 'Matched the soundtrack, not the game'},
    )
    assert described.status_code == 200


def test_flag_can_be_cleared(client, app, db_session, admin_user, folder):
    _login(client, admin_user)
    client.post(f'/api/unmatched/{folder.id}/bad_match', json={'reason': 'wrong_game'})
    client.post(f'/api/unmatched/{folder.id}/bad_match', json={'reason': None})

    row = db.session.get(UnmatchedFolder, folder.id)
    assert row.bad_match_reason is None
    assert row.bad_match_at is None


def test_does_not_destroy_the_row(client, app, db_session, admin_user, folder):
    """Feedback about a match must not double as a triage delete."""
    _login(client, admin_user)
    client.post(f'/api/unmatched/{folder.id}/bad_match', json={'reason': 'wrong_game'})

    row = db.session.get(UnmatchedFolder, folder.id)
    assert row is not None
    assert row.status == 'Unmatched'
    assert row.folder_path == '/games/Some Folder'


def test_missing_folder_is_404(client, admin_user):
    _login(client, admin_user)
    response = client.post(
        f'/api/unmatched/{uuid4()}/bad_match',
        json={'reason': 'wrong_game'},
    )
    assert response.status_code == 404
