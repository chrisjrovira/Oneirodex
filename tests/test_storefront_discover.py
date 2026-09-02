"""W25-STORE-1 — storefront shelves and scheduled events."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy import text

from oneirodex import db
from oneirodex.models import DiscoverySection, Game, Genre, Library, LibraryPlatform, User
from oneirodex.utils.storefront import build_curated_for_you, build_upcoming


@pytest.fixture(scope='function', autouse=True)
def clean_games(db_session):
    db_session.execute(text('TRUNCATE TABLE games RESTART IDENTITY CASCADE'))
    db_session.execute(text('TRUNCATE TABLE libraries RESTART IDENTITY CASCADE'))
    db_session.commit()


@pytest.fixture
def member(db_session):
    uid = str(uuid4())
    user = User(
        name=f'member_{uid[:8]}',
        email=f'member_{uid[:8]}@example.com',
        password_hash='hashed_password',
        role='user',
        user_id=uid,
        avatarpath='newstyle/avatar_default.jpg',
        invite_quota=5,
        is_email_verified=True,
    )
    user.set_password('testpassword123')
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def library(db_session):
    lib = Library(name='Store Lib', platform=LibraryPlatform.PCWIN, display_order=1)
    db_session.add(lib)
    # Commit, not flush: the tests below open their own app context, which gets a
    # different session — uncommitted rows would be invisible to the builders.
    db_session.commit()
    return lib


def _genre(db_session, name):
    existing = db_session.execute(
        db.select(Genre).filter_by(name=name)
    ).scalars().first()
    if existing:
        return existing
    genre = Genre(name=name)
    db_session.add(genre)
    db_session.commit()
    return genre


def _game(db_session, library, name, *, genres=(), rating=None, release=None, igdb_id=None):
    game = Game(
        library_uuid=library.uuid,
        name=name,
        igdb_id=igdb_id or abs(hash(name)) % 10_000_000,
        rating=rating,
        first_release_date=release,
    )
    for genre in genres:
        game.genres.append(genre)
    db_session.add(game)
    db_session.commit()
    return game


class TestCuratedForYou:
    def test_empty_without_signal(self, app, db_session, member, library):
        """A brand-new account gets an honest empty shelf, not a random sample."""
        with app.app_context():
            _game(db_session, library, 'Some Game')
            db_session.commit()
            assert build_curated_for_you(member) == []

    def test_matches_favorited_genres_and_excludes_favorites(self, app, db_session, member, library):
        with app.app_context():
            rpg = _genre(db_session, 'RPG')
            racing = _genre(db_session, 'Racing')

            liked = _game(db_session, library, 'Liked RPG', genres=[rpg])
            _game(db_session, library, 'Other RPG', genres=[rpg], rating=90)
            _game(db_session, library, 'A Racer', genres=[racing], rating=95)

            owner = db.session.get(User, member.id)
            owner.favorites.append(db.session.get(Game, liked.id))
            db.session.commit()

            names = {g.name for g in build_curated_for_you(owner)}
            # Same genre as a favourite, but never the favourite itself.
            assert 'Other RPG' in names
            assert 'Liked RPG' not in names
            # Unrelated genre stays out even though it is rated higher.
            assert 'A Racer' not in names

    def test_respects_limit(self, app, db_session, member, library):
        with app.app_context():
            rpg = _genre(db_session, 'RPG')
            liked = _game(db_session, library, 'Liked RPG', genres=[rpg])
            for i in range(6):
                _game(db_session, library, f'RPG {i}', genres=[rpg], rating=50 + i)

            owner = db.session.get(User, member.id)
            owner.favorites.append(db.session.get(Game, liked.id))
            db.session.commit()

            assert len(build_curated_for_you(owner, limit=3)) == 3


class TestUpcoming:
    def test_only_future_releases_soonest_first(self, app, db_session, member, library):
        with app.app_context():
            now = datetime.now(timezone.utc)
            _game(db_session, library, 'Shipped', release=now - timedelta(days=30))
            _game(db_session, library, 'Later', release=now + timedelta(days=60))
            _game(db_session, library, 'Sooner', release=now + timedelta(days=5))
            _game(db_session, library, 'No date')
            db_session.commit()

            names = [g.name for g in build_upcoming(member)]
            assert names == ['Sooner', 'Later']

    def test_empty_when_nothing_ahead(self, app, db_session, member, library):
        with app.app_context():
            _game(
                db_session,
                library,
                'Old',
                release=datetime.now(timezone.utc) - timedelta(days=5),
            )
            db_session.commit()
            assert build_upcoming(member) == []


class TestScheduledEvents:
    def _section(self, **kwargs):
        return DiscoverySection(
            name=kwargs.pop('name', 'Event'),
            identifier=kwargs.pop('identifier', f'event_{uuid4().hex[:6]}'),
            is_visible=kwargs.pop('is_visible', True),
            **kwargs,
        )

    def test_live_without_window(self, app):
        with app.app_context():
            assert self._section().is_live() is True

    def test_hidden_before_start_and_after_end(self, app):
        with app.app_context():
            now = datetime.now(timezone.utc)
            not_yet = self._section(starts_at=now + timedelta(days=1))
            assert not_yet.is_live() is False

            finished = self._section(ends_at=now - timedelta(days=1))
            assert finished.is_live() is False

            running = self._section(
                starts_at=now - timedelta(days=1),
                ends_at=now + timedelta(days=1),
            )
            assert running.is_live() is True

    def test_invisible_section_never_live(self, app):
        with app.app_context():
            assert self._section(is_visible=False).is_live() is False

    def test_naive_timestamps_treated_as_utc(self, app):
        """Postgres hands back naive datetimes — they must not crash the compare."""
        with app.app_context():
            now = datetime.now(timezone.utc)
            section = self._section(
                starts_at=(now - timedelta(days=1)).replace(tzinfo=None),
                ends_at=(now + timedelta(days=1)).replace(tzinfo=None),
            )
            assert section.is_live() is True
