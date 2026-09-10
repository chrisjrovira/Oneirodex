"""The test harness must not be able to wedge itself in silence.

A full run was found stopped at 33% with the pytest process at 0% CPU. Nothing
had failed; nothing had timed out. Postgres showed a three-way block: a
connection left idle-in-transaction held `games`, the `db_session` fixture's
`ALTER TABLE games ADD COLUMN` queued behind it for an ACCESS EXCLUSIVE lock,
and every later query queued behind that.

Two things caused it, and both are guarded here:

* the fixture re-ran the whole incremental migration on *every test*, so every
  test needed an exclusive lock on the main tables; and
* nothing set a lock timeout, so waiting forever was the default.
"""

from __future__ import annotations

import re
from pathlib import Path

from sqlalchemy import text

ROOT = Path(__file__).resolve().parents[1]
CONFTEST = (ROOT / 'conftest.py').read_text(encoding='utf-8')


def test_schema_setup_does_not_run_per_test():
    """DDL runs once per process, or the lock storm comes back.

    Per-test isolation is now a rolled-back SAVEPOINT (see `db_session`), but the
    schema build — `create_all` + the incremental `ALTER TABLE` migration — must
    still happen exactly once, behind `_SCHEMA_READY`. `db_session` calls
    `_build_schema_once()`, which is where that guarded work lives.
    """
    assert '_SCHEMA_READY' in CONFTEST
    build = CONFTEST[CONFTEST.index('def _build_schema_once('):]
    build = build[:build.index('\n@pytest.fixture')]
    migration = 'DatabaseManager().add_column_if_not_exists()'
    assert migration in build
    assert re.search(r'if _SCHEMA_READY:\s*\n\s*return', build), \
        'the once-per-process guard is gone from _build_schema_once'
    assert '_build_schema_once()' in CONFTEST[CONFTEST.index('def db_session('):], \
        'db_session no longer triggers the guarded schema build'


def test_lock_timeout_is_set_outside_a_transaction():
    """`SET` is transactional in Postgres. Run it inside the implicit
    transaction and SQLAlchemy's first pool rollback silently reverts it —
    which restores the exact silent-hang behaviour this exists to remove."""
    assert 'autocommit = True' in CONFTEST
    assert "SET SESSION lock_timeout" in CONFTEST


def test_the_timeout_actually_reaches_a_pooled_connection(db_session):
    """The one that matters: not what conftest says, but what the session has.

    Runs after the fixture has committed and rolled back plenty of times, so a
    setting that did not survive a rollback shows up here as the default `0`.
    """
    lock_timeout = db_session.execute(text('SHOW lock_timeout')).scalar()
    assert lock_timeout not in ('0', 0), 'lock_timeout was reverted — waits are unbounded again'

    idle = db_session.execute(text('SHOW idle_in_transaction_session_timeout')).scalar()
    assert idle not in ('0', 0), 'an abandoned transaction can still block the suite forever'
