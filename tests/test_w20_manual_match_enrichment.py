"""W20-3: manual identify taxonomy upsert + Steam enrich genre parity."""

from types import SimpleNamespace
from unittest.mock import MagicMock, patch
from uuid import uuid4

from gametheca.utils.game_core import (
    attach_igdb_taxonomy_to_game,
    ensure_manual_identify_taxonomy,
)
from gametheca.utils.metadata_enrichment import apply_enriched_metadata


def test_attach_igdb_taxonomy_creates_missing_and_attaches():
    """IGDB names absent from local taxonomy must be upserted, not silently dropped."""
    created = []

    def fake_get_or_create(model_class, name_field='name', **kwargs):
        entity = SimpleNamespace(name=kwargs[name_field], model=model_class.__name__)
        created.append(entity)
        return entity

    game = SimpleNamespace(
        genres=[],
        themes=[],
        game_modes=[],
        platforms=[],
        player_perspectives=[],
    )
    payload = {
        'genres': [{'name': 'BrandNewGenre'}],
        'themes': [{'name': 'BrandNewTheme'}],
        'game_modes': [{'name': 'Single player'}],
        'platforms': [{'name': 'PC (Microsoft Windows)'}],
        'player_perspectives': [{'name': 'First person'}],
    }

    with patch('gametheca.utils.game_core.get_or_create_entity', side_effect=fake_get_or_create):
        attached = attach_igdb_taxonomy_to_game(game, payload)

    assert attached['genres'] == ['BrandNewGenre']
    assert attached['themes'] == ['BrandNewTheme']
    assert attached['game_modes'] == ['Single player']
    assert attached['platforms'] == ['PC (Microsoft Windows)']
    assert attached['player_perspectives'] == ['First person']
    assert any(g.name == 'BrandNewGenre' for g in game.genres)
    assert any(t.name == 'BrandNewTheme' for t in game.themes)
    assert any(m.name == 'Single player' for m in game.game_modes)
    assert any(p.name == 'PC (Microsoft Windows)' for p in game.platforms)
    assert any(p.name == 'First person' for p in game.player_perspectives)
    assert len(created) == 5


def test_attach_igdb_taxonomy_unions_without_duplicating():
    existing_genre = SimpleNamespace(name='Action')
    game = SimpleNamespace(
        genres=[existing_genre],
        themes=[],
        game_modes=[],
        platforms=[],
        player_perspectives=[],
    )

    def fake_get_or_create(model_class, name_field='name', **kwargs):
        if kwargs[name_field] == 'Action':
            return existing_genre
        return SimpleNamespace(name=kwargs[name_field])

    with patch('gametheca.utils.game_core.get_or_create_entity', side_effect=fake_get_or_create):
        attached = attach_igdb_taxonomy_to_game(
            game,
            {'genres': [{'name': 'Action'}, {'name': 'Adventure'}]},
        )

    assert [g.name for g in game.genres] == ['Action', 'Adventure']
    assert attached['genres'] == ['Adventure']


@patch('gametheca.utils.game_core.fetch_game_by_igdb_id')
def test_ensure_manual_identify_taxonomy_fetches_and_attaches(mock_fetch):
    mock_fetch.return_value = [{
        'id': 1942,
        'name': 'Half-Life',
        'genres': [{'name': 'Shooter'}],
        'themes': [{'name': 'Science fiction'}],
        'game_modes': [{'name': 'Single player'}],
        'platforms': [{'name': 'PC (Microsoft Windows)'}],
        'player_perspectives': [{'name': 'First person'}],
    }]
    game = SimpleNamespace(
        genres=[],
        themes=[],
        game_modes=[],
        platforms=[],
        player_perspectives=[],
    )

    def fake_get_or_create(model_class, name_field='name', **kwargs):
        return SimpleNamespace(name=kwargs[name_field])

    with patch('gametheca.utils.game_core.get_or_create_entity', side_effect=fake_get_or_create):
        result = ensure_manual_identify_taxonomy(game, 1942)

    mock_fetch.assert_called_once_with(1942)
    assert result is not None
    assert any(g.name == 'Shooter' for g in game.genres)
    assert any(t.name == 'Science fiction' for t in game.themes)
    assert any(m.name == 'Single player' for m in game.game_modes)
    assert any(p.name == 'PC (Microsoft Windows)' for p in game.platforms)


def test_ensure_manual_identify_taxonomy_skips_custom_igdb_ids():
    game = SimpleNamespace(genres=[])
    assert ensure_manual_identify_taxonomy(game, 2000000420) is None
    assert ensure_manual_identify_taxonomy(game, 2000000500) is None


@patch('gametheca.utils.metadata_enrichment.db.session.begin_nested')
def test_apply_enriched_metadata_attaches_steam_genres_and_modes(mock_begin_nested):
    cm = MagicMock()
    cm.__exit__.return_value = False
    mock_begin_nested.return_value = cm

    game = SimpleNamespace(summary=None, player_perspectives=[], genres=[], game_modes=[])
    created = {'genres': [], 'modes': []}

    def make_genre(name):
        entity = SimpleNamespace(name=name)
        created['genres'].append(entity)
        return entity

    def make_mode(name):
        entity = SimpleNamespace(name=name)
        created['modes'].append(entity)
        return entity

    ok = apply_enriched_metadata(
        game,
        {
            'summary': 'Steam summary',
            'genres': ['Indie', 'Action'],
            'game_modes': ['Single player'],
        },
        genre_factory=make_genre,
        game_mode_factory=make_mode,
    )

    assert ok is True
    assert game.summary == 'Steam summary'
    assert [g.name for g in game.genres] == ['Indie', 'Action']
    assert [m.name for m in game.game_modes] == ['Single player']


def test_attach_igdb_taxonomy_persists_with_db(app, db_session):
    """Integration: missing Genre/Theme rows are created and linked on apply."""
    from gametheca.models import Game, Genre, Library, Theme
    from gametheca.platform import LibraryPlatform
    from sqlalchemy import select

    library = Library(
        name=f'Lib {uuid4().hex[:8]}',
        platform=LibraryPlatform.PCWIN,
        display_order=0,
    )
    db_session.add(library)
    db_session.flush()

    game = Game(
        uuid=str(uuid4()),
        name='Identify Taxonomy Test',
        library_uuid=library.uuid,
        full_disk_path=f'/test/{uuid4().hex}',
        igdb_id=900001 + (uuid4().int % 100000),
    )
    db_session.add(game)
    db_session.commit()

    unique_genre = f'W20Genre-{uuid4().hex[:8]}'
    unique_theme = f'W20Theme-{uuid4().hex[:8]}'
    assert db_session.execute(select(Genre).filter_by(name=unique_genre)).scalar_one_or_none() is None

    attached = attach_igdb_taxonomy_to_game(
        game,
        {
            'genres': [{'name': unique_genre}],
            'themes': [{'name': unique_theme}],
            'game_modes': [{'name': 'Single player'}],
            'platforms': [{'name': 'PC (Microsoft Windows)'}],
            'player_perspectives': [],
        },
    )
    db_session.commit()
    db_session.refresh(game)

    assert unique_genre in attached['genres']
    assert unique_theme in attached['themes']
    assert any(g.name == unique_genre for g in game.genres)
    assert any(t.name == unique_theme for t in game.themes)
    genre_row = db_session.execute(select(Genre).filter_by(name=unique_genre)).scalar_one()
    theme_row = db_session.execute(select(Theme).filter_by(name=unique_theme)).scalar_one()
    assert genre_row is not None
    assert theme_row is not None
