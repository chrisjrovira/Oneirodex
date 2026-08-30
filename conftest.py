import pytest
import os
from dotenv import load_dotenv

# Load .env file to ensure TEST_DATABASE_URL is available
load_dotenv()

# CRITICAL: Override DATABASE_URL with TEST_DATABASE_URL for all tests
# This prevents any accidental production database access
test_db_url = os.getenv('TEST_DATABASE_URL')
if test_db_url:
    # Additional safety: ensure we're not accidentally overriding with production DB
    if 'gametheca' in test_db_url.lower() and 'test' not in test_db_url.lower():
        raise RuntimeError(
            f"CRITICAL: TEST_DATABASE_URL appears to point to production database: {test_db_url}. "
            "TEST_DATABASE_URL must contain 'test' in the database name for safety."
        )
    
    os.environ['DATABASE_URL'] = test_db_url
    print(f"PYTEST: Overriding DATABASE_URL with TEST_DATABASE_URL: {test_db_url}")
else:
    raise RuntimeError(
        "CRITICAL: TEST_DATABASE_URL environment variable not found. "
        "Tests cannot run without explicit test database configuration."
    )

from gametheca import create_app, db


def _install_lock_timeout():
    """Make a blocked test connection fail fast and say so.

    Postgres waits for a lock forever by default. Combined with the schema
    setup below, that turned one leaked transaction into a silent, permanent
    stall: no failing test, no timeout, no output — just a pytest process at
    0% CPU that looked "slow" for hours.

    A short `lock_timeout` converts that into an immediate, named error on the
    statement that could not get its lock, which is a bug report instead of a
    mystery. Applied only to test connections; production waits as before,
    where blocking on a real lock is usually the correct behaviour.
    """
    from sqlalchemy import event
    from sqlalchemy.engine import Engine

    @event.listens_for(Engine, 'connect')
    def _set_timeouts(dbapi_connection, _record):  # noqa: ANN001
        # In autocommit, because `SET` in Postgres is transactional: run inside
        # the implicit transaction and SQLAlchemy's first rollback (which
        # happens whenever a connection returns to the pool) quietly undoes it,
        # leaving exactly the silent hang this is meant to prevent.
        try:
            previous = dbapi_connection.autocommit
            dbapi_connection.autocommit = True
            try:
                with dbapi_connection.cursor() as cur:
                    cur.execute("SET SESSION lock_timeout = '15s'")
                    cur.execute("SET SESSION idle_in_transaction_session_timeout = '60s'")
            finally:
                dbapi_connection.autocommit = previous
        except Exception:  # noqa: BLE001
            # Non-Postgres or a driver without autocommit — nothing to set.
            pass


_install_lock_timeout()


@pytest.fixture(scope='function')
def app():
    """Create and configure a test app using the test database."""
    # Ensure we have TEST_DATABASE_URL environment variable
    test_db_url = os.getenv('TEST_DATABASE_URL')
    if not test_db_url:
        pytest.fail(
            "TEST_DATABASE_URL environment variable is not set. "
            "Please set it in your .env file to point to your test database."
        )
    
    # Enhanced safety checks: ensure we're not using production database
    production_indicators = ['gametheca', 'oneirodex', 'prod', 'production']
    test_indicators = ['test', 'testing', 'gamethecatest', 'oneirodextest']
    
    # Check if URL contains production indicators without test indicators
    contains_production = any(indicator in test_db_url.lower() for indicator in production_indicators)
    contains_test = any(indicator in test_db_url.lower() for indicator in test_indicators)
    
    if contains_production and not contains_test:
        pytest.fail(
            f"CRITICAL: TEST_DATABASE_URL appears to point to production database: {test_db_url}. "
            "Test database MUST contain 'test' in the name (e.g., 'gamethecatest' or 'oneirodextest'). "
            "Tests will NOT run against production database for safety."
        )
    
    # Additional check: ensure DATABASE_URL was properly overridden
    current_db_url = os.getenv('DATABASE_URL')
    if current_db_url != test_db_url:
        pytest.fail(
            f"CRITICAL: DATABASE_URL override failed. "
            f"DATABASE_URL={current_db_url}, TEST_DATABASE_URL={test_db_url}. "
            "This could result in tests running against production database."
        )
    
    # Create app - it will now use the overridden DATABASE_URL (which is TEST_DATABASE_URL)
    app = create_app()
    app.config['TESTING'] = True
    app.config['SECRET_KEY'] = 'test-secret-key'
    app.config['WTF_CSRF_ENABLED'] = False  # Disable CSRF for testing
    # url_for(..., _external=True) derives the host from the request when one is
    # active. Tests that build URLs outside a request context have none, and
    # Flask raises "Unable to build URLs outside an active request without
    # SERVER_NAME". Production never needs this because every such call is
    # in-request — so set it here rather than in config.py, where a real value
    # would start rejecting requests whose Host header does not match.
    app.config['SERVER_NAME'] = 'localhost'
    app.config['APPLICATION_ROOT'] = '/'
    app.config['PREFERRED_URL_SCHEME'] = 'http'
    
    # Double-check that the app is using test database
    actual_db_uri = app.config['SQLALCHEMY_DATABASE_URI']
    if actual_db_uri != test_db_url:
        pytest.fail(
            f"CRITICAL: App database URI mismatch. "
            f"Expected: {test_db_url}, Got: {actual_db_uri}. "
            "Tests cannot proceed with wrong database configuration."
        )
    
    print(f"✅ PYTEST: Safely using test database: {test_db_url}")
    
    yield app

# The schema is built once for the whole run, not once per test.
#
# `db_session` used to call `db.create_all()` and the full incremental
# migration on *every test*. The schema cannot change mid-run, so all of that
# was repeated work — and not harmless repeated work: `add_column_if_not_exists`
# issues a long series of `ALTER TABLE`s, each of which needs an ACCESS
# EXCLUSIVE lock.
#
# That made the suite deadlock-prone in a way that produced no error at all. A
# single connection left idle-in-transaction anywhere (one leaked
# `DELETE FROM game_developer_association` was enough) blocks the next test's
# ALTER, every later query queues behind that pending exclusive lock, and the
# run simply stops — no failure, no timeout, no output. A full run was observed
# wedged at 33% with the pytest process using zero CPU, three-way blocked:
# idle-in-transaction → ALTER TABLE games → SELECT games.
#
# Session scope removes the per-test lock storm entirely. `_lock_timeout` below
# makes the remaining risk legible instead of silent.
_SCHEMA_READY = False


def _truncate_all_tables():
    """Empty every table once, at the start of a run.

    Nothing used to remove rows at all — `db.drop_all()` sat commented out
    "for performance" — so `gamethecatest` kept every row any test had ever
    committed, going back months. That is not inert:

    * a test asserting on a query with `LIMIT` measures whatever else is in the
      table. `latest_games` returns eight rows, so fixtures dated in years sort
      below hundreds of accumulated games and the shelf never contains them.
    * an unscoped sweep processes the whole table. `POST /api/updates/scan`
      reported `checked == 22` against two fixtures.
    * both of those failed *locally only*. CI starts from an empty database, so
      the two environments disagreed about what the same test meant — which is
      the expensive kind of failure, because the green one is the liar.

    Truncating **per run** rather than per test is deliberate. Per-test
    isolation would be stricter, but this suite is built on a shared database:
    `configured_install` and `global_settings` create their rows only if absent,
    and `configured_install`'s own docstring records tests that pass in a full
    run "only because some earlier file happened to leave a user row behind".
    Emptying between tests would expose all of those at once, which is a project
    rather than a fix. Per run gets the property that actually matters — a local
    run starts where CI starts — without disturbing the order the suite already
    depends on.

    Once, before any test has opened a connection, because TRUNCATE takes an
    ACCESS EXCLUSIVE lock; doing this between tests would reintroduce the lock
    storm the session-scoped schema build exists to avoid.

    `GT_KEEP_TEST_DATA=1` skips it, for when the leftover rows *are* the thing
    being investigated.
    """
    if os.getenv('GT_KEEP_TEST_DATA') == '1' or os.getenv('ONEIRODEX_KEEP_TEST_DATA') == '1':
        print('PYTEST: KEEP_TEST_DATA=1 — leaving existing rows in place')
        return

    from sqlalchemy import text

    tables = [f'"{table.name}"' for table in db.metadata.sorted_tables]
    if not tables:
        return
    # One statement for all of them: CASCADE settles the foreign keys, and doing
    # it in a single TRUNCATE avoids ordering the tables by dependency.
    db.session.execute(
        text(f'TRUNCATE TABLE {", ".join(tables)} RESTART IDENTITY CASCADE')
    )
    db.session.commit()
    print(f'PYTEST: truncated {len(tables)} tables — run starts from an empty database')


@pytest.fixture(scope='function')
def db_session(app):
    """Yield the session, building the schema once per run."""
    global _SCHEMA_READY
    with app.app_context():
        if not _SCHEMA_READY:
            db.create_all()
            # Incremental updates for a test DB that already exists from a
            # previous run — idempotent, and now paid for once.
            from gametheca.updateschema import DatabaseManager
            DatabaseManager().add_column_if_not_exists()
            # After the schema is settled, so the truncate names every table
            # this build knows about — including any the migration just added.
            _truncate_all_tables()
            _SCHEMA_READY = True
        yield db.session

@pytest.fixture(scope='function')
def client(app):
    """Create a test client for the Flask application."""
    return app.test_client()


@pytest.fixture(scope='function')
def configured_install(db_session):
    """An install that is past the setup wizard.

    `check_setup_status` is a `before_request` hook and `is_setup_required()`
    means "no users exist", so on a freshly truncated database *any* anonymous
    request is redirected to `/setup` — not to the login page. Every
    `..._requires_login` test that asserts `'/login' in response.location`
    therefore fails when its file runs alone, and passes in a full run only
    because some earlier file happened to leave a user row behind.

    Requesting this fixture states the precondition those tests were relying on
    without declaring. Tests that drive the wizard itself must *not* use it —
    they need the un-configured state this removes.
    """
    from uuid import uuid4
    from sqlalchemy import select
    from gametheca.models import User, GlobalSettings

    if db_session.execute(select(User)).scalars().first() is None:
        anchor = User(
            user_id=str(uuid4()),
            name=f'SetupAnchor_{str(uuid4())[:8]}',
            email=f'anchor_{str(uuid4())[:8]}@test.com',
            role='admin',
            is_email_verified=True,
        )
        anchor.set_password('testpass123')
        db_session.add(anchor)

    settings = db_session.execute(select(GlobalSettings)).scalars().first()
    if settings is None:
        settings = GlobalSettings()
        db_session.add(settings)
    settings.setup_in_progress = False
    settings.setup_completed = True
    db_session.commit()
    return settings


@pytest.fixture(scope='function')
def global_settings(db_session):
    """The `GlobalSettings` row, created only if one does not already exist.

    `global_settings` holds at most one row, enforced in the database by the
    `global_settings_singleton` unique index on a constant expression. Several
    tests used to open with a bare::

        row = GlobalSettings()
        db_session.add(row)
        db_session.commit()

    which is an unconditional INSERT into a one-row table. That works only while
    nothing else has made the row, so those tests failed with a `UniqueViolation`
    on `Key ((true))=(t) already exists` — including when run alone, because the
    row exists before they start.

    Requesting this fixture states what they actually need: *the* settings row,
    whoever created it. Mutate the returned object and commit for tests that need
    particular values on it — that is an UPDATE, which the constraint permits.

    Mirrors `ensure_global_settings()` in `gametheca/utils/module_status.py`,
    which is what production code uses for the same reason.
    """
    from sqlalchemy import select
    from gametheca.models import GlobalSettings

    row = db_session.execute(select(GlobalSettings)).scalars().first()
    if row is None:
        row = GlobalSettings()
        db_session.add(row)
        db_session.commit()
    return row