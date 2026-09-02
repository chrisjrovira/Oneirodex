"""The global_settings singleton is enforced, not just hoped for.

`global_settings` holds one row. Nothing at the database level said so, and
roughly two dozen call sites create a row when they find none — so a race on
first boot, or a restore that merged two dumps, could leave several.

Duplicates are the quiet kind of broken. Readers that used `scalar_one_or_none`
raise `MultipleResultsFound`; readers that used a bare `.first()` with no
ORDER BY get whichever row Postgres feels like returning, which can differ
between two queries in the same request. That last one is the worst of the
three: a write lands on the row nobody reads and the setting simply does not
take effect, with no error anywhere.

These tests pin the two halves of the fix — the constraint that makes a second
row impossible, and the deterministic reader that makes "the" row unambiguous
while any legacy duplicates are still being collapsed.
"""

from sqlalchemy import select

from oneirodex.models import GlobalSettings
from oneirodex.utils.global_settings import (
    global_settings_row,
    global_settings_row_or_create,
)


def test_model_declares_the_singleton_index():
    """Declared on the model so create_all() covers fresh installs and tests.

    Existing databases get the same index from updateschema; if only that path
    had it, a brand-new install would run unconstrained until its first upgrade.
    """
    index = next(
        (i for i in GlobalSettings.__table__.indexes
         if i.name == 'global_settings_singleton'),
        None,
    )

    assert index is not None, 'the singleton index is not declared on the model'
    assert index.unique, 'a non-unique index would not constrain anything'


class TestDeterministicRead:
    def test_reader_is_stable_across_calls(self, app):
        """Two reads in one request must agree on which row is the singleton."""
        with app.app_context():
            first = global_settings_row()
            second = global_settings_row()

            if first is None:
                return  # nothing to disambiguate on a clean database

            assert first.id == second.id

    def test_reader_takes_the_lowest_id(self, app):
        """The tie-break has to match what the duplicate cleanup keeps.

        updateschema collapses to MIN(id). A reader that preferred any other row
        would hand back the one the next boot is about to delete.
        """
        with app.app_context():
            row = global_settings_row()
            if row is None:
                return

            lowest = db_min_id()
            assert row.id == lowest


class TestCreateIsIdempotent:
    def test_does_not_add_a_second_row(self, app):
        """The create branch must not fire when a row already exists."""
        with app.app_context():
            global_settings_row_or_create()
            before = count_rows()

            global_settings_row_or_create()
            global_settings_row_or_create()

            assert count_rows() == before

    def test_returns_the_row_the_reader_sees(self, app):
        """Otherwise a caller writes to one row while everything reads another."""
        with app.app_context():
            created = global_settings_row_or_create()

            assert created.id == global_settings_row().id


def count_rows() -> int:
    from oneirodex import db

    return len(db.session.execute(select(GlobalSettings)).scalars().all())


def db_min_id() -> int:
    from oneirodex import db

    return min(
        row.id for row in db.session.execute(select(GlobalSettings)).scalars().all()
    )
