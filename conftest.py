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
    if 'oneirodex' in test_db_url.lower() and 'test' not in test_db_url.lower():
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

from oneirodex import create_app, db


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
    production_indicators = ['oneirodex', 'prod', 'production']
    test_indicators = ['test', 'testing', 'oneirodextest']
    
    # Check if URL contains production indicators without test indicators
    contains_production = any(indicator in test_db_url.lower() for indicator in production_indicators)
    contains_test = any(indicator in test_db_url.lower() for indicator in test_indicators)
    
    if contains_production and not contains_test:
        pytest.fail(
            f"CRITICAL: TEST_DATABASE_URL appears to point to production database: {test_db_url}. "
            "Test database MUST contain 'test' in the name (e.g., 'oneirodextest' or 'oneirodextest'). "
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
    
    # Create app. Under pytest, create_app() auto-selects config.TestConfig,
    # which carries TESTING, WTF_CSRF_ENABLED=False, SERVER_NAME='localhost',
    # APPLICATION_ROOT, PREFERRED_URL_SCHEME, a stable SECRET_KEY, and the
    # TEST_DATABASE_URL URI — the post-construction instance mutations that
    # used to live here (wave A2.6).
    app = create_app()

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

# ---------------------------------------------------------------------------
# Per-test database isolation (spec §3.2)
# ---------------------------------------------------------------------------
#
# The schema (DDL) is still built exactly once per process, behind the
# `_SCHEMA_READY` latch. `add_column_if_not_exists` issues a long series of
# `ALTER TABLE`s, each wanting an ACCESS EXCLUSIVE lock; doing that once and
# only once is what keeps the suite from the lock-storm deadlock recorded in
# `docs/dev/test-harness-2026-08-07.md`.
#
# What changed: `db_session` no longer hands out `db.session` directly with no
# teardown. Each test now runs inside a SAVEPOINT nested in an outer
# transaction that is *always rolled back* on teardown — the SQLAlchemy 2.0
# "joining a session into an external transaction" pattern, with
# `join_transaction_mode="create_savepoint"` so a `db.session.commit()` inside
# a test (or a product-code `begin_nested()`, e.g.
# `global_settings_row_or_create`, `metadata_enrichment`, `game_enrich`)
# releases and re-opens a savepoint instead of touching the real transaction.
#
# Net: every test starts from an empty database and leaves nothing behind. The
# old per-run `TRUNCATE` is gone as an isolation mechanism; a single
# process-start `TRUNCATE` remains only to sweep rows an *older* harness
# committed before this fixture existed, so a local `oneirodextest` that still
# carries months of residue starts where CI (fresh container) starts.
_SCHEMA_READY = False


def _build_schema_once():
    """DDL + one residue sweep, on a dedicated connection, exactly once."""
    global _SCHEMA_READY
    if _SCHEMA_READY:
        return

    from sqlalchemy import text

    connection = db.engine.connect()
    try:
        with connection.begin():
            db.metadata.create_all(bind=connection)
        # Incremental column adds for a test DB left over from an older schema.
        # Idempotent, and now paid for once per process rather than per test.
        from oneirodex.updateschema import DatabaseManager
        DatabaseManager().add_column_if_not_exists()

        # One-time floor sweep. Per-test isolation (below) keeps the database
        # clean going forward, but it cannot un-commit rows a previous harness
        # already persisted. `ONEIRODEX_KEEP_TEST_DATA=1` skips it for when the
        # leftover rows are the thing under investigation.
        if os.getenv('ONEIRODEX_KEEP_TEST_DATA') != '1':
            tables = [f'"{t.name}"' for t in db.metadata.sorted_tables]
            if tables:
                with connection.begin():
                    connection.execute(
                        text(
                            'TRUNCATE TABLE '
                            + ', '.join(tables)
                            + ' RESTART IDENTITY CASCADE'
                        )
                    )
    finally:
        connection.close()

    _SCHEMA_READY = True


@pytest.fixture(scope='function')
def db_session(app):
    """A database session scoped to one test by a rolled-back SAVEPOINT.

    Everything a test writes — directly or through the Flask test client, which
    shares this bound connection — is visible for the life of the test and
    discarded on teardown. `db.session` is swapped for a scoped session bound to
    the test's connection because Flask-SQLAlchemy's own `Session.get_bind`
    returns the app's default engine before it will honour a per-session
    `bind=`, so `db.session.configure(bind=...)` alone does not route here.
    """
    from sqlalchemy import orm as sa_orm
    from flask_sqlalchemy.session import _app_ctx_id

    with app.app_context():
        _build_schema_once()

        connection = db.engine.connect()
        transaction = connection.begin()  # outer transaction — always rolled back

        original_session = db.session
        db.session = sa_orm.scoped_session(
            sa_orm.sessionmaker(
                bind=connection,
                join_transaction_mode='create_savepoint',
                expire_on_commit=False,
                future=True,
            ),
            scopefunc=_app_ctx_id,
        )
        db.session.begin_nested()

        try:
            yield db.session
        finally:
            db.session.remove()
            db.session = original_session
            transaction.rollback()
            connection.close()


@pytest.fixture(scope='function')
def client(app):
    """Create a test client for the Flask application."""
    return app.test_client()


@pytest.fixture(scope='function')
def configured_install(db_session):
    """An install that is past the setup wizard.

    `check_setup_status` is a `before_request` hook and `is_setup_required()`
    means "no users exist", so on the now-empty per-test database *any*
    anonymous request is redirected to `/setup` — not to the login page. Every
    `..._requires_login` test that asserts `'/login' in response.location`
    needs a user row to exist first; requesting this fixture states that
    precondition explicitly instead of relying on an earlier file to have left
    one behind. Tests that drive the wizard itself must *not* use it — they need
    the un-configured state this removes.

    The insert lives inside the test's SAVEPOINT and is rolled back on teardown.
    """
    from uuid import uuid4
    from oneirodex.models import User
    from oneirodex.utils.global_settings import global_settings_row_or_create

    anchor = User(
        user_id=str(uuid4()),
        name=f'SetupAnchor_{str(uuid4())[:8]}',
        email=f'anchor_{str(uuid4())[:8]}@test.com',
        role='admin',
        is_email_verified=True,
    )
    anchor.set_password('testpass123')
    db_session.add(anchor)

    settings = global_settings_row_or_create()
    settings.setup_in_progress = False
    settings.setup_completed = True
    db_session.commit()
    return settings


@pytest.fixture(scope='function')
def global_settings(db_session):
    """The `GlobalSettings` singleton for this test.

    Each test starts with an empty database, so this is an unconditional
    create — but routed through `global_settings_row_or_create()` (the same
    helper production code uses) so it composes with `configured_install` and
    with any product code that also lazily creates the row, without tripping the
    `global_settings_singleton` unique index. Mutate the returned object and
    commit for tests that need particular values on it.
    """
    from oneirodex.utils.global_settings import global_settings_row_or_create

    row = global_settings_row_or_create()
    db_session.commit()
    return row