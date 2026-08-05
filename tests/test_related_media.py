"""Related media attached to a game — adaptations, tie-ins, soundtracks.

The scope guard matters most here: this is context on a game page, **not** a
media tracker, and no route may become a download path.
"""

from __future__ import annotations

from uuid import uuid4

import pytest
from flask import json
from sqlalchemy import text

from gametheca import db
from gametheca.models import Game, GameRelatedMedia, Library, LibraryPlatform, User


@pytest.fixture(scope='function', autouse=True)
def clean(db_session):
    db_session.execute(text('TRUNCATE TABLE game_related_media RESTART IDENTITY CASCADE'))
    db_session.execute(text('TRUNCATE TABLE games RESTART IDENTITY CASCADE'))
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
def game(db_session):
    lib = Library(name='Media Lib', platform=LibraryPlatform.PCWIN, display_order=1)
    db_session.add(lib)
    db_session.flush()
    row = Game(library_uuid=lib.uuid, name='The Last Journey', igdb_id=606060)
    db_session.add(row)
    db_session.commit()
    return row


def _login(client, user):
    with client.session_transaction() as sess:
        sess['_user_id'] = str(user.id)
        sess['_fresh'] = True


def _add(client, game, **kw):
    payload = {'title': 'A Thing', 'media_kind': 'film', 'relation': 'adaptation'}
    payload.update(kw)
    return client.post(f'/api/games/{game.uuid}/related_media', json=payload)


class TestScopeGuards:
    def test_refuses_a_download_style_link(self, client, admin_user, game):
        """This points at where media legitimately lives — never a download."""
        _login(client, admin_user)
        for bad in (
            'https://example.com/download/movie',
            'magnet:?xt=urn:btih:abc',
            'https://example.com/film.mkv',
        ):
            response = _add(client, game, external_url=bad)
            assert response.status_code == 400, bad

    def test_accepts_a_store_or_stream_page(self, client, admin_user, game):
        _login(client, admin_user)
        response = _add(client, game, external_url='https://example.com/title/12345')
        assert response.status_code == 201

    def test_rejects_a_non_http_link(self, client, admin_user, game):
        _login(client, admin_user)
        assert _add(client, game, external_url='ftp://example.com/x').status_code == 400

    def test_model_carries_no_progress_or_rating_fields(self):
        """If it gained 'watched' or 'rating' it would have become a tracker."""
        columns = set(GameRelatedMedia.__table__.columns.keys())
        for tracker_field in ('watched', 'progress', 'rating', 'score', 'status', 'episodes'):
            assert tracker_field not in columns


class TestAuthoring:
    def test_records_an_adaptation(self, client, app, db_session, admin_user, game):
        _login(client, admin_user)
        response = _add(
            client, game,
            title='The Last Journey (2024)',
            media_kind='series',
            relation='adaptation',
            creator='Some Studio',
            year=2024,
        )
        assert response.status_code == 201
        row = db.session.execute(
            db.select(GameRelatedMedia).filter_by(game_uuid=game.uuid)
        ).scalars().first()
        assert row.media_kind == 'series'
        assert row.year == 2024

    def test_rejects_an_unknown_media_kind(self, client, admin_user, game):
        _login(client, admin_user)
        assert _add(client, game, media_kind='vhs').status_code == 400

    def test_rejects_an_unknown_relation(self, client, admin_user, game):
        _login(client, admin_user)
        assert _add(client, game, relation='sequel_to').status_code == 400

    def test_title_is_required(self, client, admin_user, game):
        _login(client, admin_user)
        assert _add(client, game, title='   ').status_code == 400

    def test_year_must_be_numeric(self, client, admin_user, game):
        _login(client, admin_user)
        assert _add(client, game, year='soon').status_code == 400


class TestListing:
    def test_reports_only_the_facets_present(self, client, admin_user, game):
        """The UI shows only kinds that exist, not a row of empty categories."""
        _login(client, admin_user)
        _add(client, game, media_kind='film', title='Film')
        _add(client, game, media_kind='music', title='OST', relation='soundtrack')

        body = json.loads(client.get(f'/api/games/{game.uuid}/related_media').data)
        assert set(body['available_kinds']) == {'film', 'music'}
        assert body['counts'] == {'film': 1, 'music': 1}
        assert len(body['items']) == 2

    def test_empty_game_reports_no_facets(self, client, admin_user, game):
        _login(client, admin_user)
        body = json.loads(client.get(f'/api/games/{game.uuid}/related_media').data)
        assert body['items'] == []
        assert body['available_kinds'] == []

    def test_vocabularies_are_served_so_the_ui_never_hardcodes_them(self, client, admin_user, game):
        _login(client, admin_user)
        body = json.loads(client.get(f'/api/games/{game.uuid}/related_media').data)
        kinds = {k['id'] for k in body['kinds']}
        assert {'film', 'series', 'anime', 'book', 'comic', 'music', 'podcast'} == kinds
        assert {r['id'] for r in body['relations']} >= {'adaptation', 'soundtrack', 'tie_in'}

    def test_missing_game_is_404(self, client, admin_user):
        _login(client, admin_user)
        assert client.get(f'/api/games/{uuid4()}/related_media').status_code == 404


class TestDelete:
    def test_removes_the_row(self, client, app, db_session, admin_user, game):
        _login(client, admin_user)
        created = json.loads(_add(client, game).data)['item']
        response = client.delete(f'/api/games/{game.uuid}/related_media/{created["id"]}')
        assert response.status_code == 200
        assert db.session.get(GameRelatedMedia, created['id']) is None

    def test_refuses_a_mismatched_game(self, client, app, db_session, admin_user, game):
        """An item id alone must not delete across games."""
        _login(client, admin_user)
        created = json.loads(_add(client, game).data)['item']

        other_lib = Library(name='Other', platform=LibraryPlatform.PCDOS, display_order=2)
        db_session.add(other_lib)
        db_session.flush()
        other = Game(library_uuid=other_lib.uuid, name='Other Game', igdb_id=707070)
        db_session.add(other)
        db_session.commit()

        response = client.delete(f'/api/games/{other.uuid}/related_media/{created["id"]}')
        assert response.status_code == 404
        assert db.session.get(GameRelatedMedia, created['id']) is not None
