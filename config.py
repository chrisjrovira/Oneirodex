import os, sys

def _load_secret_key():
    """Load SECRET_KEY from env. Fail loudly if unset outside of test runs."""
    key = os.getenv('SECRET_KEY')
    if key and key != 'put_your_own_secret_string_here_32617432':
        return key
    # Allow pytest runs to proceed with a generated key; never silently used in prod.
    if 'pytest' in sys.modules or 'PYTEST_CURRENT_TEST' in os.environ:
        import secrets
        return secrets.token_urlsafe(64)
    raise RuntimeError(
        "SECRET_KEY environment variable is not set (or still has the example value). "
        "Generate a strong random value (e.g. `python -c 'import secrets; print(secrets.token_urlsafe(64))'`) "
        "and set it in your .env file before starting the application."
    )

class Config(object):
    # Set Database connection string here or in your .env file, when using docker set the hostname to 'db'
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/gametheca')

    # Set the path to the folder where the game files are stored (ie: use c:\gamez for windows or /gamez for linux)
    DATA_FOLDER_WAREZ = os.getenv('DATA_FOLDER_WAREZ', r'Z:\gamez')

    # OS-specific base folder paths
    if os.name == 'nt':  # Windows
        BASE_FOLDER_WINDOWS = os.getenv('BASE_FOLDER_WINDOWS', 'Z:\\')
    else:  # POSIX (Linux, Unix, MacOS, etc.)
        BASE_FOLDER_POSIX = os.getenv('BASE_FOLDER_POSIX', '/storage')

    # YOU CAN LEAVE ALL THESE SETTINGS AT DEFAULT:
    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'gametheca/static/library')
    SECRET_KEY = _load_secret_key()
    IMAGE_SAVE_PATH = os.path.join(os.path.dirname(__file__), 'gametheca/static/library/images')
    IGDB_API_ENDPOINT = os.getenv('IGDB_API_ENDPOINT', 'https://api.igdb.com/v4/games')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Session/remember-me cookie hardening. Defaults are safe for HTTPS deployments;
    # set SESSION_COOKIE_SECURE=false in .env for local HTTP development only.
    SESSION_COOKIE_SECURE = os.getenv('SESSION_COOKIE_SECURE', 'true').lower() == 'true'
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = os.getenv('SESSION_COOKIE_SAMESITE', 'Lax')
    REMEMBER_COOKIE_SECURE = os.getenv('REMEMBER_COOKIE_SECURE', 'true').lower() == 'true'
    REMEMBER_COOKIE_HTTPONLY = True
    REMEMBER_COOKIE_SAMESITE = os.getenv('REMEMBER_COOKIE_SAMESITE', 'Lax')
    
    # Zipstream configuration for streaming ZIP downloads
    ZIPSTREAM_CHUNK_SIZE = int(os.getenv('ZIPSTREAM_CHUNK_SIZE', 65536))  # 64KB chunks for memory efficiency
    ZIPSTREAM_COMPRESSION_LEVEL = int(os.getenv('ZIPSTREAM_COMPRESSION_LEVEL', 0))  # ZIP_STORED for compatibility
    ZIPSTREAM_ENABLE_ZIP64 = os.getenv('ZIPSTREAM_ENABLE_ZIP64', 'True').lower() == 'true'  # Support large games

    # Development mode - forces theme files to be recopied on startup (helpful for theme development)
    DEV_MODE = os.getenv('DEV_MODE', 'false').lower() == 'true'

    # Reverse proxy / HTTPS termination — number of trusted proxy hops (0 = disabled).
    # Set to 1 when GameTheca sits behind a single reverse proxy (nginx, Caddy, Traefik)
    # so X-Forwarded-Proto/Host are honored for OIDC redirects and external URLs.
    TRUSTED_PROXIES = int(os.getenv('TRUSTED_PROXIES', '0') or '0')

    # Optional *arr indexer/download-client module
    ENABLE_ARR_MODULE = os.getenv('ENABLE_ARR_MODULE', 'false').lower() == 'true'

    # Opt-in emulator save-state sync (WebRetro / companion)
    ENABLE_EMULATOR_SAVE_SYNC = os.getenv('ENABLE_EMULATOR_SAVE_SYNC', 'true').lower() == 'true'
    ENCRYPT_EMULATOR_SAVES = os.getenv('ENCRYPT_EMULATOR_SAVES', 'false').lower() == 'true'

    # Optional Ollama AI assist (suggestions; apply needs ENABLE_AI_AUTO_APPLY)
    ENABLE_AI_ASSIST = os.getenv('ENABLE_AI_ASSIST', 'false').lower() == 'true'
    ENABLE_AI_AUTO_APPLY = os.getenv('ENABLE_AI_AUTO_APPLY', 'false').lower() == 'true'
    OLLAMA_BASE_URL = os.getenv('OLLAMA_BASE_URL', 'http://127.0.0.1:11434')
    OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'llama3.2')

    # Hardlink helpers (preview; apply needs second flag)
    ENABLE_HARDLINK_HELPERS = os.getenv('ENABLE_HARDLINK_HELPERS', 'false').lower() == 'true'
    ALLOW_HARDLINK_APPLY = os.getenv('ALLOW_HARDLINK_APPLY', 'false').lower() == 'true'
    ENABLE_ARR_HARDLINK_PIPELINE = os.getenv('ENABLE_ARR_HARDLINK_PIPELINE', 'false').lower() == 'true'

    # Mobile / Quest-browser VR catalog
    ENABLE_VR_BROWSE = os.getenv('ENABLE_VR_BROWSE', 'false').lower() == 'true'

    # Wave 7 — BYO debrid + single-player assists
    ENABLE_DEBRID = os.getenv('ENABLE_DEBRID', 'false').lower() == 'true'
    ENABLE_GAME_ASSISTS = os.getenv('ENABLE_GAME_ASSISTS', 'false').lower() == 'true'
    REAL_DEBRID_TOKEN = os.getenv('REAL_DEBRID_TOKEN', '')
    ALLDEBRID_API_KEY = os.getenv('ALLDEBRID_API_KEY', '')
    PREMIUMIZE_API_KEY = os.getenv('PREMIUMIZE_API_KEY', '')
    TORBOX_API_KEY = os.getenv('TORBOX_API_KEY', '')

    # Wave 8+ — PCDOS stays native-only unless WASM core is intentionally enabled
    ENABLE_PCDOS_BROWSER = os.getenv('ENABLE_PCDOS_BROWSER', 'false').lower() == 'true'
    ENABLE_MOD_TRACKING = os.getenv('ENABLE_MOD_TRACKING', 'true').lower() == 'true'
    ENABLE_RUFFLE = os.getenv('ENABLE_RUFFLE', 'false').lower() == 'true'
    ENABLE_ACTIVITY_FEED = os.getenv('ENABLE_ACTIVITY_FEED', 'true').lower() == 'true'

    # Homelab SSRF policy — when true, *arr / Ollama / connector URLs may target RFC1918 hosts.
    # Cloud metadata (169.254.169.254) stays blocked. Default off for safer public-facing installs.
    ALLOW_PRIVATE_LAN_URLS = os.getenv('ALLOW_PRIVATE_LAN_URLS', 'false').lower() == 'true'

    # When true (default), OIDC JIT updates never overwrite an existing user's role.
    OIDC_LOCK_ROLES = os.getenv('OIDC_LOCK_ROLES', 'true').lower() == 'true'

    # Optional *arr connector defaults (overridden by Admin → Arr config)
    PROWLARR_URL = os.getenv('PROWLARR_URL', '')
    PROWLARR_API_KEY = os.getenv('PROWLARR_API_KEY', '')
    JACKETT_URL = os.getenv('JACKETT_URL', '')
    JACKETT_API_KEY = os.getenv('JACKETT_API_KEY', '')
    QBITTORRENT_URL = os.getenv('QBITTORRENT_URL', '')
    QBITTORRENT_USERNAME = os.getenv('QBITTORRENT_USERNAME', 'admin')
    QBITTORRENT_PASSWORD = os.getenv('QBITTORRENT_PASSWORD', '')
    TRANSMISSION_URL = os.getenv('TRANSMISSION_URL', '')
    TRANSMISSION_USERNAME = os.getenv('TRANSMISSION_USERNAME', '')
    TRANSMISSION_PASSWORD = os.getenv('TRANSMISSION_PASSWORD', '')
    DELUGE_URL = os.getenv('DELUGE_URL', '')
    DELUGE_PASSWORD = os.getenv('DELUGE_PASSWORD', '')
    SABNZBD_URL = os.getenv('SABNZBD_URL', '')
    SABNZBD_API_KEY = os.getenv('SABNZBD_API_KEY', '')

    # Flask-Babel / i18n
    BABEL_DEFAULT_LOCALE = os.getenv('BABEL_DEFAULT_LOCALE', 'en')
    BABEL_SUPPORTED_LOCALES = ['en', 'es']
