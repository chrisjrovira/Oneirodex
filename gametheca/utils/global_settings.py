"""One place to read the GlobalSettings singleton.

`global_settings` is a one-row table, but nothing at the database level enforces
that and roughly fifteen code paths will create a row when they find none — so a
race at startup, or a restore that merged two dumps, can leave two.

Most readers used to do:

    db.session.execute(select(GlobalSettings)).scalar_one_or_none()

which raises ``MultipleResultsFound`` the moment a second row exists. Six of
those were in the login blueprint, so a duplicate row would have locked every
user out of the site. Others sat in the scanner and in game_core, where the
failure would surface as an unrelated-looking scan error.

Reading the lowest id is what the settings writers already assume elsewhere
(``quality_profiles._settings_row``), and a second row should degrade to "use
the first", never to a 500.
"""

from __future__ import annotations

from sqlalchemy import select

from gametheca import db
from gametheca.models import GlobalSettings


def global_settings_row() -> GlobalSettings | None:
    """The settings singleton, or None when setup has not created it yet."""
    return db.session.execute(
        select(GlobalSettings).order_by(GlobalSettings.id).limit(1)
    ).scalars().first()


def global_settings_row_or_create() -> GlobalSettings:
    """The settings singleton, creating it when absent.

    Flushes rather than commits so the caller keeps control of the transaction.
    """
    row = global_settings_row()
    if row is None:
        row = GlobalSettings()
        db.session.add(row)
        db.session.flush()
    return row


# Duplicates are collapsed at startup by
# `DatabaseManager.cleanup_duplicate_global_settings` in updateschema.py,
# alongside the other data cleanups.
