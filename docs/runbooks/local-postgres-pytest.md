# Local Postgres for pytest

Native Windows, with Docker Desktop running.

**CI:** `.github/workflows/ci-tests.yml` spins up Postgres with
`POSTGRES_DB=oneirodextest` and runs a *core* pytest subset only. The full suite
stays local/release — see release-checklist.md.

## Start the database

The container that serves the test database is **`oneirodex-review-db`**
(`docker-compose.review.yml`, postgres:17.6). It publishes 5432 precisely so
local pytest keeps working while that stack is up.

```bash
docker start oneirodex-review-db
```

First time, or after the container has been removed:

```bash
docker compose -f docker-compose.review.yml up -d db
```

```bash
docker exec oneirodex-review-db psql -U postgres -c "CREATE DATABASE oneirodextest;"
```

Required in `.env`:

```text
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/oneirodextest
```

`conftest.py` hard-fails if that variable is missing, or if its database name
does not contain `test`. That guard is deliberate and should not be relaxed.

## Each run starts from an empty database

`conftest.py` truncates every table once per run, after the schema is built and
before the first test.

It did not always. `db.drop_all()` sat commented out "for performance", so
`oneirodextest` kept every row any test had ever committed, going back months.
That is not inert — it silently changes what a test measures:

| Symptom | Cause |
|---|---|
| A shelf assertion never sees its own fixtures | The query has a `LIMIT`. `latest_games` returns eight rows, so fixtures dated in years sort below hundreds of accumulated games. |
| `POST /api/updates/scan` reported `checked == 22` against two fixtures | The sweep was unscoped, so it processed the whole table. |

Both of those failed **locally only**, because CI starts from an empty database.
The two environments disagreed about what the same test meant, and the green one
was the liar. Starting every run clean is what makes a local run and a CI run
the same experiment.

**Per run, not per test.** This suite is built on a shared database:
`configured_install` and `global_settings` create their rows only if absent, and
`configured_install`'s docstring records tests that pass in a full run *only*
because an earlier file left a user row behind. Emptying between tests would
expose all of those at once — a project, not a fix. It is also once for a
mechanical reason: `TRUNCATE` takes an ACCESS EXCLUSIVE lock, and doing it
between tests would reintroduce the lock storm the session-scoped schema build
exists to avoid.

**Rows still accumulate *within* a run.** A test that asserts on a global query
must still scope it — pass `library_uuid`, filter by a fixture's own ids, or
assert on relative order rather than absolute position. Do not assume your
fixtures are the only rows in the table.

To keep the leftovers — when the rows themselves are what you are investigating:

```bash
GT_KEEP_TEST_DATA=1 python -m pytest tests/test_whatever.py
```

## Running

```bash
python -m pytest tests/test_routes_info.py
```

Scope to one file where you can; the full tree is slow on a network-mounted
checkout.
