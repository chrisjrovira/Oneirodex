# Test harness — why the suite never finished

**Date:** 2026-08-07 · **Status:** deadlock fixed, failures classified

## The symptom

A full `pytest` run stopped at 33% and stayed there. The process used **zero
CPU**, nothing had failed, nothing had timed out, and the log had simply
stopped mid-line. It had been running for hours and looked slow.

It was not slow. It was deadlocked.

## What was actually happening

`py-spy dump` on the stuck process pointed at the `db_session` fixture, inside
`add_column_if_not_exists`, blocked in SQLAlchemy's `do_execute`. Postgres
showed a three-way block:

| pid | state | statement |
|---|---|---|
| A | `idle in transaction` | `DELETE FROM game_developer_association …` |
| B | `Lock/relation`, blocked by A | `ALTER TABLE games ADD COLUMN …` |
| C | `Lock/relation`, blocked by B | `SELECT games …` |

Two independent defects combined:

**1. The schema was rebuilt on every test.** `db_session` is function-scoped
and called `db.create_all()` *and* the whole incremental migration for each
one. The schema cannot change mid-run, so this was pure repetition — but not
harmless repetition, because `add_column_if_not_exists` issues a long series of
`ALTER TABLE`s and each wants an ACCESS EXCLUSIVE lock. One connection left
idle in a transaction anywhere is then enough to stop the entire suite.

**2. Nothing set a lock timeout.** Postgres waits forever by default, so the
failure mode was silence rather than an error.

## The fixes

* Schema setup runs **once per run**, behind a module-level guard.
  `tests/test_routes_library.py` went from 102s to 25s, still 27/27.
* Test connections set `lock_timeout` and
  `idle_in_transaction_session_timeout`, turning a wedge into a named error on
  the statement that could not get its lock. Production is untouched, where
  blocking on a real lock is usually correct.
* `tests/test_harness_locking.py` pins both, and checks the timeout on a
  **pooled connection after real rollbacks** rather than trusting conftest's
  source text — see the footgun below.

### Footgun: `SET` is transactional

The first version of the timeout listener ran `SET lock_timeout` on the raw
DBAPI connection inside its implicit transaction. Postgres treats `SET` as
transactional, so SQLAlchemy's first pool rollback silently reverted it —
restoring the exact silent hang the setting exists to prevent, while conftest
still *read* as though it were configured. It runs in autocommit now.

## Results

The suite now finishes: **113 failed, 3071 passed in 25:31**.

The 113 is not new. It matches the figure that had been carried in notes as
"cross-file state leakage"; what was new is that the run could reach the end
and report it.

## Two wrong theories, recorded so they are not re-derived

**"Rows accumulate in the test database."** They do — a run left 98 users, 89
filters, 63 libraries and 43 games behind, and nothing ever resets it. But that
is *not* what causes the failures: `test_routes_library.py` fails 15 times in
the suite and passes 27/27 alone **even against the polluted database**. Row
accumulation is real and worth fixing; it is not this.

**"It is all one shared-state problem."** It is not. Classifying every affected
file by running it alone splits the 113 cleanly into genuine defects and
order-dependent ones — see the table below. Those need different fixes and
should not be discussed as one number.

## Classification

See `docs/dev/test-harness-failures.md` for the per-file split.

## Still open

* **Test runs mutate the dev install.** The pytest app boots against the test
  *database* but writes to the same package *filesystem*. During one run the
  generated `static/library/themes/default` tree disappeared, which left every
  page in the running dev instance unstyled. The test app should not be able to
  touch the installed theme tree.
* **No isolation between tests.** Real isolation means wrapping each test in a
  rolled-back transaction. That is invasive here because route tests go through
  the Flask test client, which takes its own connection from the pool and so
  would not see the test's uncommitted data — the standard fix is to bind every
  session to one connection, and it deserves its own verified change rather
  than being tacked onto this one.
