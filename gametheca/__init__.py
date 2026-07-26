#/gametheca/__init__.py
import sys, os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from flask_mail import Mail
from flask import Flask
from flask_wtf.csrf import CSRFProtect
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, current_user
from config import Config
from datetime import datetime
from urllib.parse import urlparse, urlunparse
from flask_caching import Cache
from gametheca.utils.db import check_postgres_port_open
from gametheca.utils.proxy import apply_proxy_fix

db = SQLAlchemy()
login_manager = LoginManager()
mail = Mail()
cache = Cache(config={'CACHE_TYPE': 'SimpleCache'})
csrf = CSRFProtect()
app_start_time = datetime.now()
app_version = '0.2.0'


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # SAFETY CHECK: Prevent production database access during tests
    import sys
    if 'pytest' in sys.modules or 'PYTEST_CURRENT_TEST' in os.environ:
        # We are running in pytest - ensure we're using test database
        test_db_url = os.getenv('TEST_DATABASE_URL')
        production_db_url = os.getenv('DATABASE_URL')
        
        # If DATABASE_URL was not properly overridden in conftest.py
        if production_db_url and test_db_url and production_db_url != test_db_url:
            if 'gametheca' in production_db_url and 'test' not in production_db_url:
                print(f"🚨 CRITICAL: Tests attempting to use production database: {production_db_url}")
                print(f"🛡️  BLOCKING: Forcing test database: {test_db_url}")
                app.config['SQLALCHEMY_DATABASE_URI'] = test_db_url
        
        print(f"🧪 PYTEST MODE: Using database: {app.config.get('SQLALCHEMY_DATABASE_URI', 'NOT SET')}")
    
    csrf.init_app(app)
    apply_proxy_fix(app)
    app.config['UPLOAD_FOLDER'] = os.path.join(app.root_path, 'static/library')

    from gametheca.utils.i18n import init_babel
    init_babel(app)
    # --- BEGIN: Print masked PostgreSQL connection string ---
    raw_db_uri = app.config['SQLALCHEMY_DATABASE_URI']
    parsed_uri = urlparse(raw_db_uri)
    if parsed_uri.password:
        # Create a new netloc with the masked password
        netloc_parts = parsed_uri.netloc.split('@')
        auth_part = netloc_parts[0].replace(parsed_uri.password, '********')
        masked_netloc = f"{auth_part}@{netloc_parts[1]}" if len(netloc_parts) > 1 else auth_part
        masked_uri = urlunparse(parsed_uri._replace(netloc=masked_netloc))
        print(f"Attempting to connect to PostgreSQL with URI: {masked_uri}")
    else:
        print(f"Attempting to connect to PostgreSQL with URI: {raw_db_uri}")
    # --- END: Print masked PostgreSQL connection string ---

    parsed_url = urlparse(app.config['SQLALCHEMY_DATABASE_URI'])
    check_postgres_port_open(parsed_url.hostname, 5432, 60, 2)
    db.init_app(app)
    login_manager.init_app(app)
    mail.init_app(app)
    login_manager.login_view = 'login.login'
    cache.init_app(app)

    @app.errorhandler(413)
    def request_entity_too_large(error):
        """Handle file upload size limit exceeded errors."""
        from flask import flash, redirect, request
        flash('The file you tried to upload is too large. Maximum file size is 10MB.', 'error')
        return redirect(request.url)

    @app.context_processor
    def inject_current_theme():
        """Injects the current user's theme into all templates."""
        if current_user.is_authenticated and hasattr(current_user, 'preferences') and current_user.preferences:
            current_theme = current_user.preferences.theme or 'default'
        else:
            current_theme = 'default'
        return dict(current_theme=current_theme)

    @app.context_processor
    def inject_feature_flags():
        return {
            'enable_vr_browse': bool(app.config.get('ENABLE_VR_BROWSE')),
        }

    @app.before_request
    def check_setup_status():
        """Check if setup is required and redirect accordingly."""
        from flask import request, redirect
        from gametheca.utils.setup import should_redirect_to_setup, get_setup_redirect_url
        
        # Skip setup checks for certain endpoints
        exempt_endpoints = {
            'setup.setup', 'setup.setup_submit', 'setup.setup_smtp', 'setup.setup_igdb',
            'static', 'favicon', 'site.favicon'
        }
        
        # Skip setup checks for API endpoints (they should handle their own authentication)
        if request.endpoint and (
            request.endpoint in exempt_endpoints or
            request.endpoint.startswith('apis.') or
            request.path.startswith('/api/')
        ):
            return
        
        # Check if we need to redirect to setup
        if should_redirect_to_setup():
            setup_url = get_setup_redirect_url()
            if request.endpoint and request.path != setup_url:
                return redirect(setup_url)

    # Import models and routes
    from . import routes, models
    from gametheca.routes_site import site_bp
    from gametheca.routes_member import member_bp
    from gametheca.routes_library import library_bp
    from gametheca.routes_setup import setup_bp
    from gametheca.routes_settings import settings_bp
    from gametheca.routes_login import login_bp
    from gametheca.routes_discover import discover_bp
    from gametheca.routes_downloads_ext import download_bp
    from gametheca.routes_games_ext import games_bp
    from gametheca.routes_smtp import smtp_bp
    from gametheca.routes_info import info_bp
    from gametheca.routes_admin_ext import admin2_bp
    from gametheca.routes_apis import apis_bp
    from gametheca.routes_arr import arr_bp

    # Register all blueprints
    app.register_blueprint(routes.bp)
    app.register_blueprint(site_bp)
    app.register_blueprint(member_bp)
    app.register_blueprint(admin2_bp)
    app.register_blueprint(library_bp)
    app.register_blueprint(setup_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(login_bp)
    app.register_blueprint(discover_bp)
    app.register_blueprint(download_bp)
    app.register_blueprint(games_bp)
    app.register_blueprint(smtp_bp)
    app.register_blueprint(info_bp)
    app.register_blueprint(apis_bp)
    app.register_blueprint(arr_bp)

    # Companion desktop uses Bearer tokens without a browser CSRF cookie.
    from gametheca.routes_apis import client as client_api

    csrf.exempt(client_api.client_heartbeat)
    csrf.exempt(client_api.client_lifecycle_get)
    csrf.exempt(client_api.client_lifecycle_post)
    csrf.exempt(client_api.client_commands_get)

    with app.app_context():
        # Database initialization is handled by the InitializationManager before workers start
        # Worker processes skip initialization entirely since it's already done
        if ('pytest' not in sys.modules and 'PYTEST_CURRENT_TEST' not in os.environ and
            os.getenv('GAMETHECA_INITIALIZATION_COMPLETE') != 'true'):
            # This should only happen in development or if initialization wasn't run
            print("⚠️  Initialization not completed - this may cause issues")

        if ('pytest' not in sys.modules and 'PYTEST_CURRENT_TEST' not in os.environ):
            try:
                from gametheca.utils.scan_scheduler import start_scan_scheduler
                start_scan_scheduler(app)
            except Exception as exc:
                print(f"[SCAN SCHEDULER] Could not start: {exc}")

    return app
