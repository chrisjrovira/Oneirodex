"""Editable provider links on the game edit form."""

from types import SimpleNamespace
from uuid import uuid4

import pytest

from oneirodex.utils import game_provider_urls as gpu


def _url(url_type, url, **kw):
    return SimpleNamespace(url_type=url_type, url=url, **kw)


@pytest.fixture
def library(db_session):
    """Games need one — `library_uuid` is NOT NULL."""
    from oneirodex import db
    from oneirodex.models import Library, LibraryPlatform

    lib = Library(name=f'ProviderLib_{uuid4().hex[:6]}', platform=LibraryPlatform.PCWIN)
    db.session.add(lib)
    db.session.commit()
    return lib


def _game(library, uuid, name, path):
    from oneirodex import db
    from oneirodex.models import Game

    game = Game(
        uuid=uuid,
        name=name,
        full_disk_path=path,
        library_uuid=str(library.uuid),
    )
    db.session.add(game)
    return game


class TestProviderUrlFields:
    def test_carries_existing_links(self):
        game = SimpleNamespace(urls=[_url('steam', 'https://store.steampowered.com/app/1/')])
        rows = {r['key']: r['value'] for r in gpu.provider_url_fields(game)}
        assert rows['steam'] == 'https://store.steampowered.com/app/1/'
        assert rows['gog'] is None

    def test_every_provider_gets_a_row(self):
        rows = gpu.provider_url_fields(SimpleNamespace(urls=[]))
        assert [r['key'] for r in rows] == [k for k, _ in gpu.PROVIDER_URL_FIELDS]

    def test_ignores_url_types_the_form_does_not_own(self):
        game = SimpleNamespace(urls=[_url('youtube', 'https://youtu.be/x')])
        assert all(r['value'] is None for r in gpu.provider_url_fields(game))

    def test_submitted_values_win_over_stored_ones(self):
        """A failed save must not discard what the member just typed."""
        game = SimpleNamespace(urls=[_url('steam', 'https://old.example/')])
        rows = {
            r['key']: r['value']
            for r in gpu.provider_url_fields(
                game, {'provider_url_steam': 'https://typed.example/'}
            )
        }
        assert rows['steam'] == 'https://typed.example/'


class TestIsHttpUrl:
    def test_accepts_http_and_https(self):
        assert gpu.is_http_url('https://example.com/a')
        assert gpu.is_http_url('http://example.com')

    def test_rejects_other_schemes_and_junk(self):
        assert not gpu.is_http_url('javascript:alert(1)')
        assert not gpu.is_http_url('steam://run/1')
        assert not gpu.is_http_url('example.com')
        assert not gpu.is_http_url('')
        assert not gpu.is_http_url(None)


class TestApplyProviderUrls:
    def test_adds_updates_and_clears(self, app, db_session, library):
        from oneirodex import db
        from oneirodex.models import GameURL

        game = _game(library, 'pu-1111', 'Provider Fixture', '/tmp/pu')
        db.session.add(GameURL(game_uuid='pu-1111', url_type='gog', url='https://gog.example/old'))
        db.session.add(GameURL(game_uuid='pu-1111', url_type='youtube', url='https://youtu.be/keep'))
        db.session.commit()
        db.session.refresh(game)

        gpu.apply_provider_urls(
            game,
            {
                'provider_url_steam': 'https://store.steampowered.com/app/7/',
                'provider_url_gog': 'https://gog.example/new',
                # every other provider submits blank
            },
        )
        db.session.commit()

        rows = {
            r.url_type: r.url
            for r in db.session.query(GameURL).filter_by(game_uuid='pu-1111').all()
        }
        assert rows['steam'] == 'https://store.steampowered.com/app/7/'
        assert rows['gog'] == 'https://gog.example/new'
        # A row this form does not own must survive the save.
        assert rows['youtube'] == 'https://youtu.be/keep'

    def test_blank_removes_the_link(self, app, db_session, library):
        from oneirodex import db
        from oneirodex.models import GameURL

        game = _game(library, 'pu-2222', 'Clearable', '/tmp/pu2')
        db.session.add(GameURL(game_uuid='pu-2222', url_type='steam', url='https://wrong.example/'))
        db.session.commit()
        db.session.refresh(game)

        gpu.apply_provider_urls(game, {'provider_url_steam': ''})
        db.session.commit()

        remaining = db.session.query(GameURL).filter_by(game_uuid='pu-2222').all()
        assert remaining == []

    def test_refuses_a_non_http_url_and_keeps_what_was_there(self, app, db_session, library):
        """Storing it would render a javascript: link on the details page."""
        from oneirodex import db
        from oneirodex.models import GameURL

        game = _game(library, 'pu-3333', 'Hostile', '/tmp/pu3')
        db.session.add(GameURL(game_uuid='pu-3333', url_type='steam', url='https://good.example/'))
        db.session.commit()
        db.session.refresh(game)

        gpu.apply_provider_urls(game, {'provider_url_steam': 'javascript:alert(1)'})
        db.session.commit()

        rows = {
            r.url_type: r.url
            for r in db.session.query(GameURL).filter_by(game_uuid='pu-3333').all()
        }
        assert rows['steam'] == 'https://good.example/'
