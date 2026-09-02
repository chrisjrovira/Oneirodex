"""Steam store metadata must land on our own Game fields.

Regression guard for the report that Steam-imported games showed a blank
summary and none of the boxes ticked: the storesearch hit that identifies a
title carries no description and no taxonomy, and Stage D never followed up
with an ``appdetails`` read.
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import text

from oneirodex import db
from oneirodex.models import Developer, Game, Library, LibraryPlatform, Publisher
from oneirodex.utils.steam_metadata import (
    apply_steam_metadata_to_game,
    hydrate_game_from_steam,
    parse_steam_release_date,
    steam_details_to_metadata,
)

APPDETAILS = {
    'steam_app_id': 620,
    'name': 'Portal 2',
    'steam_type': 'game',
    'header_image': 'https://cdn.example/portal2.jpg',
    'short_description': 'A first-person puzzle game.',
    'genres': ['Action', 'Adventure'],
    'categories': ['Single-player', 'Co-op', 'Steam Achievements'],
    'developers': ['Valve'],
    'publishers': ['Valve'],
    'release_date': '19 Apr, 2011',
    'coming_soon': False,
    'metacritic': 95,
    'pc_requirements': {'minimum': '<strong>Minimum:</strong> Win 7'},
    'supported_languages': 'English<strong>*</strong>, French',
}


@pytest.fixture(scope='function', autouse=True)
def clean(db_session):
    db_session.execute(text('TRUNCATE TABLE games RESTART IDENTITY CASCADE'))
    db_session.execute(text('TRUNCATE TABLE libraries RESTART IDENTITY CASCADE'))
    db_session.commit()


@pytest.fixture
def library(db_session):
    lib = Library(name='Steam Lib', platform=LibraryPlatform.PCWIN, display_order=1)
    db_session.add(lib)
    db_session.commit()
    return lib


@pytest.fixture
def game(db_session, library):
    row = Game(
        library_uuid=library.uuid,
        name='Portal 2',
        igdb_id=int(uuid4().int % 1_000_000) + 9_000_000,
    )
    db_session.add(row)
    db_session.commit()
    return row


class TestReleaseDateParsing:
    def test_common_steam_formats(self):
        assert parse_steam_release_date('19 Apr, 2011').year == 2011
        assert parse_steam_release_date('Apr 19, 2011').year == 2011
        assert parse_steam_release_date('2011').year == 2011

    def test_unparseable_returns_none_rather_than_guessing(self):
        assert parse_steam_release_date('Coming soon') is None
        assert parse_steam_release_date('Q4 2026') is None
        assert parse_steam_release_date('') is None
        assert parse_steam_release_date(None) is None


class TestNormalization:
    def test_maps_every_field_we_own(self):
        meta = steam_details_to_metadata(APPDETAILS)
        assert meta['summary'] == 'A first-person puzzle game.'
        assert meta['genres'] == ['Action', 'Adventure']
        assert meta['developer'] == 'Valve'
        assert meta['publisher'] == 'Valve'
        assert meta['cover_url'] == 'https://cdn.example/portal2.jpg'
        assert meta['first_release_date'].year == 2011
        # Steam categories map onto our GameMode taxonomy.
        assert 'Single-player' in meta['game_modes'] or meta['game_modes']
        assert meta['store_specs']['system_requirements']['windows']['minimum']
        assert meta['store_specs']['languages'][0]['name'] == 'English'

    def test_empty_payload_is_safe(self):
        assert steam_details_to_metadata(None) == {}
        assert steam_details_to_metadata({}) == {}


class TestApplyToGame:
    def test_fills_summary_genres_and_credits(self, app, db_session, game):
        with app.app_context():
            row = db.session.get(Game, game.id)
            report = apply_steam_metadata_to_game(row, steam_details_to_metadata(APPDETAILS))
            db.session.commit()

            assert report['summary'] is True
            assert 'Action' in report['genres']
            assert row.summary == 'A first-person puzzle game.'
            assert {g.name for g in row.genres} >= {'Action', 'Adventure'}
            assert row.first_release_date.year == 2011
            assert db.session.get(Developer, row.developer_id).name == 'Valve'
            assert db.session.get(Publisher, row.publisher_id).name == 'Valve'
            assert row.steam_app_id == 620
            assert row.store_specs['languages'][0]['audio'] is True

    def test_never_clobbers_existing_values(self, app, db_session, game):
        """A better IGDB match must not be downgraded by a later Steam pass."""
        with app.app_context():
            row = db.session.get(Game, game.id)
            row.summary = 'Curated IGDB summary'
            row.first_release_date = datetime(1999, 1, 1, tzinfo=timezone.utc)
            row.store_specs = {
                'languages': [
                    {'name': 'Japanese', 'interface': True, 'audio': True, 'subtitles': True},
                ],
            }
            db.session.commit()

            report = apply_steam_metadata_to_game(row, steam_details_to_metadata(APPDETAILS))
            db.session.commit()

            assert report['summary'] is False
            assert row.summary == 'Curated IGDB summary'
            assert row.first_release_date.year == 1999
            assert row.store_specs['languages'][0]['name'] == 'Japanese'
            assert row.store_specs['system_requirements']['windows']['minimum']

    def test_rerun_is_idempotent(self, app, db_session, game):
        with app.app_context():
            row = db.session.get(Game, game.id)
            meta = steam_details_to_metadata(APPDETAILS)
            apply_steam_metadata_to_game(row, meta)
            db.session.commit()
            first = sorted(g.name for g in row.genres)

            second_report = apply_steam_metadata_to_game(row, meta)
            db.session.commit()

            assert sorted(g.name for g in row.genres) == first
            assert second_report['genres'] == []

    def test_empty_metadata_is_a_noop(self, app, db_session, game):
        with app.app_context():
            row = db.session.get(Game, game.id)
            assert apply_steam_metadata_to_game(row, {})['summary'] is False


class TestHydrate:
    @patch('oneirodex.utils.steam_metadata.fetch_steam_app_details')
    def test_hydrates_from_app_id(self, mock_fetch, app, db_session, game):
        mock_fetch.return_value = APPDETAILS
        with app.app_context():
            row = db.session.get(Game, game.id)
            row.steam_app_id = 620
            db.session.commit()

            report = hydrate_game_from_steam(row)
            db.session.commit()

            assert report['summary'] is True
            assert row.summary == 'A first-person puzzle game.'

    @patch('oneirodex.utils.steam_metadata.fetch_steam_app_details')
    def test_store_miss_does_not_undo_identification(self, mock_fetch, app, db_session, game):
        mock_fetch.return_value = None
        with app.app_context():
            row = db.session.get(Game, game.id)
            row.steam_app_id = 620
            db.session.commit()

            assert hydrate_game_from_steam(row) == {}
            assert row.name == 'Portal 2'

    def test_without_app_id_is_a_noop(self, app, db_session, game):
        with app.app_context():
            row = db.session.get(Game, game.id)
            assert hydrate_game_from_steam(row) == {}
