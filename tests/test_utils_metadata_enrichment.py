"""Tests for gametheca.utils.metadata_enrichment.apply_enriched_metadata.

The first group of tests mocks out `db.session.begin_nested` so the
savepoint/rollback contract can be verified without a live Postgres
connection. The second group exercises the helper against a real
Game/Library fixture and requires TEST_DATABASE_URL / Postgres.
"""

from types import SimpleNamespace
from unittest.mock import patch, MagicMock

from gametheca.utils.metadata_enrichment import apply_enriched_metadata


def _nested_cm():
    """A context manager double for db.session.begin_nested() that never suppresses exceptions."""
    cm = MagicMock()
    cm.__exit__.return_value = False
    return cm


def test_apply_enriched_metadata_noop_when_missing_args():
    assert apply_enriched_metadata(None, {'summary': 'x'}) is True
    assert apply_enriched_metadata(SimpleNamespace(), {}) is True
    assert apply_enriched_metadata(SimpleNamespace(), None) is True


@patch('gametheca.utils.metadata_enrichment.db.session.begin_nested')
def test_apply_enriched_metadata_sets_summary_and_perspectives_without_db(mock_begin_nested):
    mock_begin_nested.return_value = _nested_cm()

    game = SimpleNamespace(summary=None, player_perspectives=[], genres=[])
    created = []

    def make_perspective(name):
        entity = SimpleNamespace(name=name)
        created.append(entity)
        return entity

    ok = apply_enriched_metadata(
        game,
        {'summary': 'New summary', 'player_perspectives': ['Virtual Reality']},
        perspective_factory=make_perspective,
    )

    assert ok is True
    assert game.summary == 'New summary'
    assert any(p.name == 'Virtual Reality' for p in game.player_perspectives)
    assert len(created) == 1


@patch('gametheca.utils.metadata_enrichment.db.session.begin_nested')
def test_apply_enriched_metadata_does_not_overwrite_existing_summary(mock_begin_nested):
    mock_begin_nested.return_value = _nested_cm()

    game = SimpleNamespace(summary='Existing summary', player_perspectives=[], genres=[])
    ok = apply_enriched_metadata(game, {'summary': 'Should not stick'})

    assert ok is True
    assert game.summary == 'Existing summary'


@patch('gametheca.utils.metadata_enrichment.db.session.begin_nested')
def test_apply_enriched_metadata_skips_perspective_already_returned_by_factory(mock_begin_nested):
    """When the factory (get-or-create) returns the same existing entity, it must not be re-appended."""
    mock_begin_nested.return_value = _nested_cm()

    existing = SimpleNamespace(name='Third person')
    game = SimpleNamespace(summary=None, player_perspectives=[existing], genres=[])

    def get_or_create(name):
        assert name == existing.name
        return existing

    ok = apply_enriched_metadata(
        game,
        {'player_perspectives': ['Third person']},
        perspective_factory=get_or_create,
    )

    assert ok is True
    assert game.player_perspectives == [existing]


@patch('gametheca.utils.metadata_enrichment._attach_named_relations', side_effect=RuntimeError('boom'))
@patch('gametheca.utils.metadata_enrichment.db.session.begin_nested')
def test_apply_enriched_metadata_returns_false_on_error_without_db(mock_begin_nested, mock_attach):
    """Without a real DB session the mocked savepoint can't revert attribute mutations, but the
    helper must still report failure so the caller knows not to trust/commit partial state."""
    mock_begin_nested.return_value = _nested_cm()

    game = SimpleNamespace(summary=None, player_perspectives=[], genres=[])
    ok = apply_enriched_metadata(game, {'summary': 'Should not stick', 'genres': ['Action']})

    assert ok is False


# --- Tests below require a real Postgres-backed app/db_session fixture. ---
# They are written per plan but may hang/fail in environments without a
# reachable TEST_DATABASE_URL Postgres instance.


def test_apply_enriched_metadata_rolls_back_on_error(app, db_session):
    from uuid import uuid4
    from gametheca.models import Library, Game
    from gametheca.platform import LibraryPlatform

    library = Library(name=f'Lib {uuid4().hex[:8]}', platform=LibraryPlatform.PCWIN, display_order=0)
    db_session.add(library)
    db_session.flush()

    game = Game(
        uuid=str(uuid4()),
        name='Enrich Rollback Test',
        library_uuid=library.uuid,
        full_disk_path=f'/test/{uuid4().hex}',
        summary=None,
    )
    db_session.add(game)
    db_session.commit()

    enriched = {'summary': 'Should not stick', 'genres': [], 'player_perspectives': []}

    def boom(*args, **kwargs):
        raise RuntimeError('fail')

    with patch('gametheca.utils.metadata_enrichment._attach_named_relations', side_effect=boom):
        result = apply_enriched_metadata(game, enriched)

    assert result is False
    db_session.refresh(game)
    assert game.summary is None


def test_apply_enriched_metadata_applies_and_persists(app, db_session):
    from uuid import uuid4
    from gametheca.models import Library, Game
    from gametheca.platform import LibraryPlatform

    library = Library(name=f'Lib {uuid4().hex[:8]}', platform=LibraryPlatform.PCWIN, display_order=0)
    db_session.add(library)
    db_session.flush()

    game = Game(
        uuid=str(uuid4()),
        name='Enrich Apply Test',
        library_uuid=library.uuid,
        full_disk_path=f'/test/{uuid4().hex}',
        summary=None,
    )
    db_session.add(game)
    db_session.commit()

    enriched = {
        'summary': 'Applied summary',
        'genres': ['Action'],
        'player_perspectives': ['Third person'],
    }
    result = apply_enriched_metadata(game, enriched)
    db_session.commit()

    assert result is True
    db_session.refresh(game)
    assert game.summary == 'Applied summary'
    assert any(g.name == 'Action' for g in game.genres)
    assert any(p.name == 'Third person' for p in game.player_perspectives)
