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
    production_indicators = ['gametheca', 'prod', 'production']
    test_indicators = ['test', 'testing', 'gamethecatest']
    
    # Check if URL contains production indicators without test indicators
    contains_production = any(indicator in test_db_url.lower() for indicator in production_indicators)
    contains_test = any(indicator in test_db_url.lower() for indicator in test_indicators)
    
    if contains_production and not contains_test:
        pytest.fail(
            f"CRITICAL: TEST_DATABASE_URL appears to point to production database: {test_db_url}. "
            "Test database MUST contain 'test' in the name (e.g., 'gamethecatest'). "
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
            _SCHEMA_READY = True
        yield db.session
        # Optionally drop all tables after test (commented out for performance)
        # db.drop_all()

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