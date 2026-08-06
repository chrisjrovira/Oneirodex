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

    # Host path to on-disk game files (Compose mounts to /storage in the container)
    DATA_FOLDER_GAMES = os.getenv('DATA_FOLDER_GAMES', r'Z:\gamez')

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

    # Product modules default ON — disable via env, setup wizard, or Admin → Features.
    # Auth (OIDC) stays off by default elsewhere. Destructive auto-apply stays gated.
    ENABLE_ARR_MODULE = os.getenv('ENABLE_ARR_MODULE', 'true').lower() == 'true'

    # Emulator save-state sync (WebRetro / companion)
    ENABLE_EMULATOR_SAVE_SYNC = os.getenv('ENABLE_EMULATOR_SAVE_SYNC', 'true').lower() == 'true'
    ENCRYPT_EMULATOR_SAVES = os.getenv('ENCRYPT_EMULATOR_SAVES', 'false').lower() == 'true'
    # Optional private BIOS/firmware dir (operator upload or host volume). Never vendor blobs.
    # When unset, bios_root() falls back to static/library/bios.
    EMULATOR_BIOS_PATH = os.getenv('EMULATOR_BIOS_PATH') or None

    # Ollama AI assist (suggestions on; silent rename stays off)
    ENABLE_AI_ASSIST = os.getenv('ENABLE_AI_ASSIST', 'true').lower() == 'true'
    ENABLE_AI_AUTO_APPLY = os.getenv('ENABLE_AI_AUTO_APPLY', 'false').lower() == 'true'

    # Generated cover art (FEAT-D3). Off by default: this is the only feature
    # that talks to an endpoint outside the process, so it stays opt-in and
    # self-hosted-first. Engine speaks the A1111 API (AUTOMATIC1111 / SD.Next /
    # Forge all implement it).
    # FEAT-D1: check version / updates / DLC after a library scan. Opt-in —
    # each check is store HTTP traffic, so a scan must not start doing it
    # without being asked.
    SCAN_CHECK_FRESHNESS = os.getenv('SCAN_CHECK_FRESHNESS', 'false').lower() == 'true'
    SCAN_FRESHNESS_LIMIT = int(os.getenv('SCAN_FRESHNESS_LIMIT', '50'))

    ENABLE_AI_ARTWORK = os.getenv('ENABLE_AI_ARTWORK', 'false').lower() == 'true'
    AI_ARTWORK_URL = os.getenv('AI_ARTWORK_URL', '')
    AI_ARTWORK_ENGINE = os.getenv('AI_ARTWORK_ENGINE', 'a1111')
    OLLAMA_BASE_URL = os.getenv('OLLAMA_BASE_URL', 'http://127.0.0.1:11434')
    OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'llama3.2')

    # UIR-1 two-bar chrome — opt-in preview while the pages migrate. Not an
    # admin Features toggle on purpose: it is a build-out flag, and a switch in
    # the admin UI that only half-changes the layout would be its own lie.
    ENABLE_NEW_CHROME = os.getenv('ENABLE_NEW_CHROME', 'false').lower() == 'true'

    # Theme fonts. Empty FONT_PATH means the default under static/library/fonts,
    # which is what a Compose deploy wants (it already persists that volume).
    FONT_PATH = os.getenv('FONT_PATH', '')
    FONT_MAX_BYTES = int(os.getenv('FONT_MAX_BYTES', str(8 * 1024 * 1024)))

    # Hardlink helpers on; filesystem apply remains a safety lock
    ENABLE_HARDLINK_HELPERS = os.getenv('ENABLE_HARDLINK_HELPERS', 'true').lower() == 'true'
    ALLOW_HARDLINK_APPLY = os.getenv('ALLOW_HARDLINK_APPLY', 'false').lower() == 'true'
    ENABLE_ARR_HARDLINK_PIPELINE = os.getenv('ENABLE_ARR_HARDLINK_PIPELINE', 'true').lower() == 'true'
    # Remote path mapping. The download client usually runs in its own
    # container and reports paths from *its* mounts, which do not exist here.
    # Format: "remote=>local" pairs joined by "|", e.g.
    #   /downloads=>/storage/downloads|/data/torrents=>/mnt/user/torrents
    # Empty (the default) means client and app share a filesystem view.
    ARR_REMOTE_PATH_MAP = os.getenv('ARR_REMOTE_PATH_MAP', '')

    # Mobile / Quest-browser VR catalog
    ENABLE_VR_BROWSE = os.getenv('ENABLE_VR_BROWSE', 'true').lower() == 'true'

    # BYO debrid + single-player assists
    ENABLE_DEBRID = os.getenv('ENABLE_DEBRID', 'true').lower() == 'true'
    ENABLE_GAME_ASSISTS = os.getenv('ENABLE_GAME_ASSISTS', 'true').lower() == 'true'
    REAL_DEBRID_TOKEN = os.getenv('REAL_DEBRID_TOKEN', '')
    ALLDEBRID_API_KEY = os.getenv('ALLDEBRID_API_KEY', '')
    PREMIUMIZE_API_KEY = os.getenv('PREMIUMIZE_API_KEY', '')
    TORBOX_API_KEY = os.getenv('TORBOX_API_KEY', '')

    # Browser play / mods / patches — on by default; degrade gracefully if tools missing
    ENABLE_PCDOS_BROWSER = os.getenv('ENABLE_PCDOS_BROWSER', 'true').lower() == 'true'
    ENABLE_MOD_TRACKING = os.getenv('ENABLE_MOD_TRACKING', 'true').lower() == 'true'
    ENABLE_ROM_PATCH_APPLY = os.getenv('ENABLE_ROM_PATCH_APPLY', 'true').lower() == 'true'
    # DAT unique-hash: open zip/7z/rar and hash inner dump when outer archive hash misses.
    # Default ON; set DAT_HASH_INNER_ARCHIVE=0 to skip (scan stays basename/outer-hash only).
    DAT_HASH_INNER_ARCHIVE = os.getenv('DAT_HASH_INNER_ARCHIVE', 'true').lower() == 'true'
    FLIPS_PATH = os.getenv('FLIPS_PATH', '')
    ENABLE_PATCH_CATALOG = os.getenv('ENABLE_PATCH_CATALOG', 'true').lower() == 'true'
    PATCH_CATALOG_PATH = os.getenv('PATCH_CATALOG_PATH', '')
    ENABLE_ROM_AI_TRANSLATE = os.getenv('ENABLE_ROM_AI_TRANSLATE', 'true').lower() == 'true'
    RETROARCH_AI_SERVICE_URL = os.getenv('RETROARCH_AI_SERVICE_URL', '')
    ENABLE_RUFFLE = os.getenv('ENABLE_RUFFLE', 'true').lower() == 'true'
    ENABLE_ACTIVITY_FEED = os.getenv('ENABLE_ACTIVITY_FEED', 'true').lower() == 'true'

    # Household voice (LiveKit) — flag on; UI degrades until LIVEKIT_* configured
    ENABLE_LIVEKIT = os.getenv('ENABLE_LIVEKIT', 'true').lower() == 'true'

    # BYO Sunshine / Wolf remote play (Moonlight) — off by default; operator-owned GPU host
    ENABLE_REMOTE_PLAY = os.getenv('ENABLE_REMOTE_PLAY', 'false').lower() == 'true'
    SUNSHINE_BASE_URL = os.getenv('SUNSHINE_BASE_URL', '')
    WOLF_BASE_URL = os.getenv('WOLF_BASE_URL', '')
    REMOTE_PLAY_PROVIDER = os.getenv('REMOTE_PLAY_PROVIDER', 'sunshine')
    REMOTE_PLAY_TOKEN = os.getenv('REMOTE_PLAY_TOKEN', '')
    REMOTE_PLAY_TOKEN_HINT = os.getenv('REMOTE_PLAY_TOKEN_HINT', '')
    REMOTE_PLAY_PIN_HINT = os.getenv('REMOTE_PLAY_PIN_HINT', '')
    REMOTE_PLAY_APP_HINT = os.getenv('REMOTE_PLAY_APP_HINT', '')
    REMOTE_PLAY_HOST_LABEL = os.getenv('REMOTE_PLAY_HOST_LABEL', '')

    # Archive / library malware scan (ClamAV when available + filename heuristics)
    ENABLE_MALWARE_SCAN = os.getenv('ENABLE_MALWARE_SCAN', 'true').lower() == 'true'
    CLAMAV_HOST = os.getenv('CLAMAV_HOST', '127.0.0.1')
    CLAMAV_PORT = int(os.getenv('CLAMAV_PORT', '3310') or '3310')
    CLAMAV_SOCKET = os.getenv('CLAMAV_SOCKET', '')
    MALWARE_SCAN_BLOCK_ON_HIT = os.getenv('MALWARE_SCAN_BLOCK_ON_HIT', 'true').lower() == 'true'

    # Wave 18 — free games feed (News + notifications)
    ENABLE_FREE_GAMES = os.getenv('ENABLE_FREE_GAMES', 'true').lower() == 'true'
    FREE_GAMES_POLL_HOURS = float(os.getenv('FREE_GAMES_POLL_HOURS', '3') or '3')

    # Batched email digest (mentions / DMs / free games) — needs admin SMTP
    ENABLE_EMAIL_DIGEST = os.getenv('ENABLE_EMAIL_DIGEST', 'true').lower() == 'true'
    EMAIL_DIGEST_INTERVAL_HOURS = float(os.getenv('EMAIL_DIGEST_INTERVAL_HOURS', '24') or '24')

    # Auth rate limit (in-process; single-container default)
    ENABLE_LOGIN_RATE_LIMIT = os.getenv('ENABLE_LOGIN_RATE_LIMIT', 'true').lower() == 'true'
    LOGIN_RATE_LIMIT_ATTEMPTS = int(os.getenv('LOGIN_RATE_LIMIT_ATTEMPTS', '10') or '10')
    LOGIN_RATE_LIMIT_WINDOW_SECONDS = float(os.getenv('LOGIN_RATE_LIMIT_WINDOW_SECONDS', '300') or '300')

    # BYO challenge / captcha solver sidecar (FlareSolverr-compatible TRAWL) — opt-in only.
    ENABLE_CHALLENGE_SOLVER = os.getenv('ENABLE_CHALLENGE_SOLVER', 'false').lower() == 'true'
    CHALLENGE_SOLVER_URL = os.getenv('CHALLENGE_SOLVER_URL', '')
    CHALLENGE_SOLVER_PROVIDER = os.getenv('CHALLENGE_SOLVER_PROVIDER', 'flaresolverr_compat')
    CHALLENGE_SOLVER_TIMEOUT_MS = int(os.getenv('CHALLENGE_SOLVER_TIMEOUT_MS', '60000') or '60000')
    CHALLENGE_SOLVER_MAX_TIER = int(os.getenv('CHALLENGE_SOLVER_MAX_TIER', '5') or '5')
    CHALLENGE_TOKEN_API_URL = os.getenv('CHALLENGE_TOKEN_API_URL', '')
    CHALLENGE_TOKEN_API_KEY = os.getenv('CHALLENGE_TOKEN_API_KEY', '')

    # Ambient lighting bridge (Hyperion.ng / Home Assistant) — opt-in only.
    ENABLE_AMBIENT_LIGHTING = os.getenv('ENABLE_AMBIENT_LIGHTING', 'false').lower() == 'true'
    LIGHTING_PROVIDER = os.getenv('LIGHTING_PROVIDER', 'off')
    HYPERION_URL = os.getenv('HYPERION_URL', '')
    HYPERION_TOKEN = os.getenv('HYPERION_TOKEN', '')
    HYPERION_PRIORITY = int(os.getenv('HYPERION_PRIORITY', '50') or '50')
    AMBIENT_ACCENT_COLOR = os.getenv('AMBIENT_ACCENT_COLOR', '255,128,32')
    HA_URL = os.getenv('HA_URL', os.getenv('HOME_ASSISTANT_URL', ''))
    HA_TOKEN = os.getenv('HA_TOKEN', os.getenv('HOME_ASSISTANT_TOKEN', ''))
    HA_LIGHT_ENTITIES = os.getenv('HA_LIGHT_ENTITIES', '')
    HA_PLAY_SCENE = os.getenv('HA_PLAY_SCENE', '')
    HA_STOP_SCENE = os.getenv('HA_STOP_SCENE', '')

    # Homelab SSRF policy — *arr / Ollama / connector URLs may target RFC1918 hosts.
    # Cloud metadata (169.254.169.254) stays blocked. Default on for Unraid/NAS installs.
    ALLOW_PRIVATE_LAN_URLS = os.getenv('ALLOW_PRIVATE_LAN_URLS', 'true').lower() == 'true'

    # When true (default), OIDC JIT updates never overwrite an existing user's role.
    OIDC_LOCK_ROLES = os.getenv('OIDC_LOCK_ROLES', 'true').lower() == 'true'

    # In-app support → GitHub Issues (optional; tickets still save without a token)
    SUPPORT_GITHUB_TOKEN = os.getenv('SUPPORT_GITHUB_TOKEN', '')
    SUPPORT_GITHUB_REPO = os.getenv('SUPPORT_GITHUB_REPO', 'chrisjrovira/gametheca')

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
