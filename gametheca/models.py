# gametheca/models.py
from gametheca import db
from sqlalchemy import ForeignKey, select
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import relationship
from sqlalchemy.types import TypeDecorator, TEXT
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
import uuid, json
from uuid import uuid4
from datetime import datetime, timedelta, timezone
from enum import Enum as PyEnum
from .platform import LibraryPlatform

ph = PasswordHasher()

class JSONEncodedDict(TypeDecorator):
    impl = TEXT

    def process_bind_param(self, value, dialect):
        if value is not None:
            try:
                return json.dumps(value)
            except (TypeError, ValueError) as e:
                print(f"Error serializing JSON: {e}")
                # Optionally, return None or some default value
                return None
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            try:
                return json.loads(value)
            except (TypeError, ValueError) as e:
                print(f"Error deserializing JSON: {e}")
                # Return a default value to ensure the application can continue
                return {}
        return value

game_genre_association = db.Table('game_genre_association',
    db.Column('game_id', db.Integer, db.ForeignKey('games.id'), primary_key=True),
    db.Column('genre_id', db.Integer, db.ForeignKey('genres.id'), primary_key=True)
)

game_game_mode_association = db.Table('game_game_mode_association',
    db.Column('game_id', db.Integer, db.ForeignKey('games.id'), primary_key=True),
    db.Column('game_mode_id', db.Integer, db.ForeignKey('game_modes.id'), primary_key=True)
)

game_theme_association = db.Table(
    'game_theme_association',
    db.Column('game_id', db.Integer, db.ForeignKey('games.id'), primary_key=True),
    db.Column('theme_id', db.Integer, db.ForeignKey('themes.id'), primary_key=True)
)


game_platform_association = db.Table(
    'game_platform_association',
    db.Column('game_id', db.Integer, db.ForeignKey('games.id'), primary_key=True),
    db.Column('platform_id', db.Integer, db.ForeignKey('platforms.id'), primary_key=True)
)


game_multiplayer_mode_association = db.Table(
    'game_multiplayer_mode_association',
    db.Column('game_id', db.Integer, db.ForeignKey('games.id'), primary_key=True),
    db.Column('multiplayer_mode_id', db.Integer, db.ForeignKey('multiplayer_modes.id'), primary_key=True)
)

game_player_perspective_association = db.Table(
    'game_player_perspective_association',
    db.Column('game_id', db.Integer, db.ForeignKey('games.id'), primary_key=True),
    db.Column('player_perspective_id', db.Integer, db.ForeignKey('player_perspectives.id'), primary_key=True)
)

game_developer_association = db.Table(
    'game_developer_association',
    db.Column('game_id', db.Integer, db.ForeignKey('games.id'), primary_key=True),
    db.Column('developer_id', db.Integer, db.ForeignKey('developers.id'), primary_key=True)
)



class Category(PyEnum):
    MAIN_GAME = "Main Game"
    DLC_ADDON = "DLC/Add-on"
    EXPANSION = "Expansion"
    BUNDLE = "Bundle"
    STANDALONE_EXPANSION = "Standalone Expansion"
    MOD = "Mod"
    EPISODE = "Episode"
    SEASON = "Season"
    REMAKE = "Remake"
    REMASTER = "Remaster"
    EXPANDED_GAME = "Expanded Game"
    PORT = "Port"
    PACK = "Pack"
    UPDATE = "Update"
    

class Library(db.Model):
    __tablename__ = 'libraries'
    
    uuid = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid4()))
    name = db.Column(db.String(255), nullable=False)
    image_url = db.Column(db.String(255), nullable=True)
    platform = db.Column(db.Enum(LibraryPlatform), nullable=False)
    display_order = db.Column(db.Integer, default=0)
    # 1 = immediate children are games; 2 = unwrap letter buckets (_a…_z, _#)
    scan_depth = db.Column(db.Integer, default=1, nullable=False)
    # Last successful scan root (used by refresh-all / scheduled scans)
    last_scan_folder = db.Column(db.String(512), nullable=True)
    # Incremental watch intent under GT_LIBRARY_WATCH master switch.
    # null = follow global (watch when env on); False = opt-out; True = prefer watch.
    watch_enabled = db.Column(db.Boolean, nullable=True, default=None)
    games = db.relationship('Game', backref='library', lazy=True)
    unmatched_folders = relationship("UnmatchedFolder", backref='library', cascade="all, delete-orphan")



class Status(PyEnum):
    RELEASED = "Released"
    ALPHA = "Alpha"
    BETA = "Beta"
    EARLY_ACCESS = "Early Access"
    OFFLINE = "Offline"
    CANCELLED = "Cancelled"
    
user_favorites = db.Table('user_favorites',
    db.Column('user_id', db.Integer, db.ForeignKey('users.id'), primary_key=True),
    db.Column('game_uuid', db.String(36), db.ForeignKey('games.uuid'), primary_key=True),
    db.Column('created_at', db.DateTime, default=lambda: datetime.now(timezone.utc))
)

user_game_status = db.Table('user_game_status',
    db.Column('user_id', db.Integer, db.ForeignKey('users.id'), primary_key=True),
    db.Column('game_uuid', db.String(36), db.ForeignKey('games.uuid'), primary_key=True),
    db.Column('status', db.String(20), nullable=False),  # 'unplayed', 'unfinished', 'beaten', 'completed', 'null'
    db.Column('updated_at', db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
)

class Game(db.Model):
    __tablename__ = 'games'

    id = db.Column(db.Integer, primary_key=True)
    uuid = db.Column(db.String(36), default=lambda: str(uuid4()), unique=True, nullable=False)
    igdb_id = db.Column(db.Integer, unique=True, nullable=True)
    favorited_by = db.relationship('User', secondary='user_favorites', back_populates='favorites')
    status_users = db.relationship('User', secondary='user_game_status', back_populates='game_statuses')
    name = db.Column(db.String, nullable=False)
    summary = db.Column(db.Text, nullable=True)
    storyline = db.Column(db.Text, nullable=True)
    updates = db.relationship('GameUpdate', back_populates='game', cascade='all, delete-orphan')
    extras = db.relationship('GameExtra', back_populates='game', cascade='all, delete-orphan')
    aggregated_rating = db.Column(db.Float)
    aggregated_rating_count = db.Column(db.Integer)
    cover = db.Column(db.String)
    first_release_date = db.Column(db.DateTime)
    rating = db.Column(db.Float)
    rating_count = db.Column(db.Integer)
    slug = db.Column(db.String, unique=True)
    status = db.Column(db.Enum(Status))
    category = db.Column(db.Enum(Category))
    total_rating = db.Column(db.Float, default=1.0)
    total_rating_count = db.Column(db.Integer, default=1)
    url_igdb = db.Column(db.String)
    url = db.Column(db.String)
    video_urls = db.Column(db.String, nullable=True)
    full_disk_path = db.Column(db.String, nullable=True)
    # Disk presence signal from scan/identify (nullable = never checked).
    # Values: ok | missing | empty — Ops health counts empty path + path_status=missing
    # without live path.exists on every poll.
    path_status = db.Column(db.String(16), nullable=True)
    # ROM file hashes for DAT set-completion matching (optional; filled on scan/rehash).
    file_crc = db.Column(db.String(16), nullable=True, index=True)
    file_md5 = db.Column(db.String(32), nullable=True, index=True)
    file_sha1 = db.Column(db.String(40), nullable=True, index=True)
    date_created = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    date_identified = db.Column(db.DateTime, nullable=True)
    steam_url = db.Column(db.String, nullable=True)
    times_downloaded = db.Column(db.Integer, default=0)
    nfo_content = db.Column(db.Text, nullable=True)
    # HowLongToBeat integration fields
    hltb_id = db.Column(db.Integer, nullable=True)
    hltb_main_story = db.Column(db.Float, nullable=True)
    hltb_main_extra = db.Column(db.Float, nullable=True)
    hltb_completionist = db.Column(db.Float, nullable=True)
    hltb_all_styles = db.Column(db.Float, nullable=True)
    hltb_last_updated = db.Column(db.DateTime, nullable=True)
    images = db.relationship("Image", backref="game", lazy='dynamic')
    genres = db.relationship('Genre', secondary=game_genre_association, back_populates='games')
    game_modes = db.relationship("GameMode", secondary=game_game_mode_association, back_populates="games")
    themes = db.relationship("Theme", secondary=game_theme_association, back_populates="games")
    platforms = db.relationship("Platform", secondary=game_platform_association, back_populates="games")
    player_perspectives = db.relationship("PlayerPerspective", secondary=game_player_perspective_association, back_populates="games")
    developer_id = db.Column(db.Integer, db.ForeignKey('developers.id'), nullable=True)
    developer = db.relationship("Developer", back_populates="games")
    publisher = db.relationship("Publisher", back_populates="games")
    publisher_id = db.Column(db.Integer, db.ForeignKey('publishers.id'), nullable=True)
    download_requests = db.relationship('DownloadRequest', back_populates='game', lazy='dynamic', cascade='delete')
    multiplayer_modes = db.relationship("MultiplayerMode", secondary=game_multiplayer_mode_association, back_populates="games")
    urls = db.relationship('GameURL', cascade='all, delete-orphan')
    file_type = db.Column(db.String, nullable=True)
    library_uuid = db.Column(db.String(36), db.ForeignKey('libraries.uuid'), nullable=False)
    size = db.Column(db.BigInteger, nullable=False, default=0)
    last_updated = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Store / freshness (local vs Steam/GOG/Epic)
    steam_app_id = db.Column(db.Integer, nullable=True)
    local_version = db.Column(db.String(100), nullable=True)
    remote_version_summary = db.Column(db.String(255), nullable=True)
    freshness_status = db.Column(db.String(32), nullable=True)
    freshness_confidence = db.Column(db.String(16), nullable=True)
    freshness_checked_at = db.Column(db.DateTime, nullable=True)
    freshness_payload = db.Column(db.JSON, nullable=True)

    # ROM region / language (parsed from No-Intro-style filenames)
    rom_region = db.Column(db.String(16), nullable=True)
    rom_languages = db.Column(db.String(64), nullable=True)  # CSV: en,ja,fr
    has_english = db.Column(db.Boolean, nullable=True)

    # Multi-disc set (BE-DET-5): primary path disc index + known disc count.
    # Sibling discs attach as GameExtra(extra_kind='disc', disc_index=N).
    disc_index = db.Column(db.Integer, nullable=True)
    disc_count = db.Column(db.Integer, nullable=True)

    # Library item kind (orthogonal to LibraryPlatform / IGDB Category):
    # game | experience | emulator | tool — default game for existing rows.
    item_kind = db.Column(db.String(16), nullable=False, default='game', server_default='game')

    def __repr__(self):
        return f"<Game id={self.id}, name={self.name}>"

class GameUpdate(db.Model):
    __tablename__ = 'game_updates'

    id = db.Column(db.Integer, primary_key=True)
    uuid = db.Column(db.String(36), default=lambda: str(uuid4()), unique=True, nullable=False)
    game_uuid = db.Column(db.String(36), db.ForeignKey('games.uuid'), nullable=False)
    times_downloaded = db.Column(db.Integer, default=0)
    nfo_content = db.Column(db.Text, nullable=True)
    file_path = db.Column(db.String, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    game = db.relationship('Game', back_populates='updates')

    def __repr__(self):
        return f"<GameUpdate id={self.id}, uuid={self.uuid}, game_uuid={self.game_uuid}>"
    
class GameExtra(db.Model):
    __tablename__ = 'game_extras'

    id = db.Column(db.Integer, primary_key=True)
    uuid = db.Column(db.String(36), default=lambda: str(uuid4()), unique=True, nullable=False)
    game_uuid = db.Column(db.String(36), db.ForeignKey('games.uuid'), nullable=False)
    times_downloaded = db.Column(db.Integer, default=0)
    nfo_content = db.Column(db.Text, nullable=True)
    file_path = db.Column(db.String, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    # Optional typing for translation patches / manuals (O-ROM phase 2)
    extra_kind = db.Column(db.String(32), nullable=True)  # translation_patch | manual | disc | None
    patch_format = db.Column(db.String(8), nullable=True)  # ips | bps | ups
    target_language = db.Column(db.String(16), nullable=True)
    source_url = db.Column(db.String(512), nullable=True)
    # BE-DET-5 — disc sibling index when extra_kind='disc'
    disc_index = db.Column(db.Integer, nullable=True)

    game = db.relationship('Game', back_populates='extras')

    def __repr__(self):
        return f"<GameExtra id={self.id}, uuid={self.uuid}, game_uuid={self.game_uuid}>"


class GameURL(db.Model):
    __tablename__ = 'game_urls'

    id = db.Column(db.Integer, primary_key=True)
    game_uuid = db.Column(db.String(36), db.ForeignKey('games.uuid'), nullable=False)
    url_type = db.Column(db.String, nullable=False)
    url = db.Column(db.String, nullable=False)

    game = db.relationship('Game', back_populates='urls')

    def __repr__(self):
        return f"<GameURL id={self.id}, game_uuid={self.game_uuid}, url_type={self.url_type}, url={self.url}>"

class Image(db.Model):
    """Game artwork row. ``image_type`` is the kind enum (BE-DET-10):
    cover | screenshot | box | cart | disc | logo | hero | fanart.
    """
    __tablename__ = 'images'

    id = db.Column(db.Integer, primary_key=True)
    game_uuid = db.Column(db.String(36), db.ForeignKey('games.uuid'), nullable=False)
    image_type = db.Column(db.String, nullable=False)  # kind — see image_kinds.IMAGE_KINDS
    url = db.Column(db.String, nullable=False)
    igdb_image_id = db.Column(db.String, nullable=True)  # IGDB image ID for reference
    download_url = db.Column(db.String, nullable=True)  # Full IGDB URL to download from
    is_downloaded = db.Column(db.Boolean, default=False, nullable=False)  # Download status
    # FEAT-D3: generated art is labelled so it can be found and replaced later
    # rather than passing as real cover art. `generated_by` records the engine.
    is_generated = db.Column(db.Boolean, default=False, nullable=False)
    generated_by = db.Column(db.String(32), nullable=True)
    last_error = db.Column(db.String(500), nullable=True)  # Most recent download failure reason, if any
    last_attempt_at = db.Column(db.DateTime, nullable=True)  # When the download was last attempted
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f"<Image id={self.id}, game_uuid={self.game_uuid}, image_type={self.image_type}, url={self.url}, downloaded={self.is_downloaded}>"

class GameRelatedMedia(db.Model):
    """Other media attached to a game — adaptations, tie-ins, soundtracks.

    Deliberately **not** media tracking. A film exists here only because it is
    the adaptation of this game; nothing is rated, progressed or watched. It is
    context on the game's page with a link out, which is what keeps this inside
    the product's scope rather than turning GameTheca into a media tracker.
    """

    __tablename__ = 'game_related_media'

    id = db.Column(db.Integer, primary_key=True)
    game_uuid = db.Column(
        db.String(36), db.ForeignKey('games.uuid', ondelete='CASCADE'),
        nullable=False, index=True,
    )
    # film | series | anime | book | comic | music | podcast
    media_kind = db.Column(db.String(16), nullable=False)
    # adaptation | tie_in | soundtrack | novelisation | documentary | inspired_by
    relation = db.Column(db.String(20), nullable=False, default='tie_in')
    title = db.Column(db.String(240), nullable=False)
    creator = db.Column(db.String(160), nullable=True)
    year = db.Column(db.Integer, nullable=True)
    summary = db.Column(db.String(1000), nullable=True)
    # Where to go to actually watch/read/listen. Never a download link.
    external_url = db.Column(db.String(500), nullable=True)
    cover_url = db.Column(db.String(500), nullable=True)
    display_order = db.Column(db.Integer, default=0, nullable=False)
    created_by_user_id = db.Column(
        db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True,
    )
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'game_uuid': self.game_uuid,
            'media_kind': self.media_kind,
            'relation': self.relation,
            'title': self.title,
            'creator': self.creator,
            'year': self.year,
            'summary': self.summary,
            'external_url': self.external_url,
            'cover_url': self.cover_url,
            'display_order': self.display_order or 0,
        }


class PcCheat(db.Model):
    """Operator-authored cheat notes for installed PC games (FEAT-D2).

    Deliberately **notes, not a trainer**: rows record what to change and how
    (console command, config edit, save-editor field), and GameTheca never
    writes to a game binary or injects into a running process. That keeps the
    feature on the right side of the anti-cheat line and matches the patch
    catalog stance — the data is operator-owned, not scraped from third-party
    trainer sites.
    """

    __tablename__ = 'pc_cheats'

    id = db.Column(db.Integer, primary_key=True)
    game_uuid = db.Column(
        db.String(36), db.ForeignKey('games.uuid', ondelete='CASCADE'),
        nullable=False, index=True,
    )
    # console | config | save | launch_flag | note
    method = db.Column(db.String(16), nullable=False, default='note')
    label = db.Column(db.String(160), nullable=False)
    # The thing to type / set. Kept verbatim so it can be copied exactly.
    payload = db.Column(db.Text, nullable=True)
    notes = db.Column(db.String(1000), nullable=True)
    # Single-player only by default — multiplayer cheating is out of scope and
    # a good way to get an account banned.
    single_player_only = db.Column(db.Boolean, default=True, nullable=False)
    created_by_user_id = db.Column(
        db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True,
    )
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'game_uuid': self.game_uuid,
            'method': self.method,
            'label': self.label,
            'payload': self.payload,
            'notes': self.notes,
            'single_player_only': bool(self.single_player_only),
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    favorites = db.relationship('Game', secondary='user_favorites', back_populates='favorited_by')
    game_statuses = db.relationship('Game', secondary='user_game_status', back_populates='status_users')
    password_hash = db.Column(db.String(128), nullable=False)
    role = db.Column(db.String(64), nullable=False)
    state = db.Column(db.Boolean, default=True)
    about = db.Column(db.String(256), unique=True, nullable=True)
    created = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    lastlogin = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    user_id = db.Column(db.String(36), unique=True, nullable=False, default=lambda: str(uuid4()))
    avatarpath = db.Column(db.String(256), default='newstyle/avatar_default.jpg')
    is_email_verified = db.Column(db.Boolean, default=False)
    email_verification_token = db.Column(db.String(256), nullable=True)
    password_reset_token = db.Column(db.String(256), nullable=True)
    
    preferences = db.relationship(
        'UserPreference',
        back_populates='user',
        uselist=False,
        cascade='all, delete-orphan'
    )
    token_creation_time = db.Column(db.DateTime, nullable=True)
    invite_quota = db.Column(db.Integer, default=0) 
    
    def set_password(self, password):
        # Now using Argon2 to hash new passwords
        self.password_hash = ph.hash(password)

    def check_password(self, password):
        # Only use Argon2 for password verification
        try:
            return ph.verify(self.password_hash, password)
        except VerifyMismatchError:
            return False
        

    @property
    def is_authenticated(self):
        return True

    @property
    def is_active(self):
        return True

    @property
    def is_anonymous(self):
        return False

    def get_id(self):
        return str(self.id)

    @staticmethod
    def is_username_reserved(username):
        """Check if a username is reserved"""
        reserved_names = {'system'}
        return username.lower() in reserved_names

    def __repr__(self):
        return f"<User id={self.id}, name={self.name}, email={self.email}>"


class UserLibraryAccess(db.Model):
    """Allow-list of libraries a restricted user (typically child) may see."""

    __tablename__ = 'user_library_access'

    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    library_uuid = db.Column(
        db.String(36),
        db.ForeignKey('libraries.uuid', ondelete='CASCADE'),
        primary_key=True,
    )

    user = db.relationship('User', backref=db.backref('library_access', cascade='all, delete-orphan'))
    library = db.relationship('Library')

    def __repr__(self):
        return f'<UserLibraryAccess user_id={self.user_id} library_uuid={self.library_uuid}>'


class UserContentFilter(db.Model):
    """Deny-list of genre/theme names for restricted users (typically child)."""

    __tablename__ = 'user_content_filters'

    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    filter_type = db.Column(db.String(16), primary_key=True)
    name = db.Column(db.String(50), primary_key=True)

    user = db.relationship('User', backref=db.backref('content_filters', cascade='all, delete-orphan'))

    def __repr__(self):
        return f'<UserContentFilter user_id={self.user_id} filter_type={self.filter_type} name={self.name}>'


class ApiToken(db.Model):
    """Personal access tokens for OpenAPI / companion clients."""

    __tablename__ = 'api_tokens'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    token_prefix = db.Column(db.String(16), nullable=False, index=True)
    token_hash = db.Column(db.String(255), nullable=False)
    scopes = db.Column(db.JSON, nullable=False, default=list)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    last_used_at = db.Column(db.DateTime, nullable=True)
    revoked_at = db.Column(db.DateTime, nullable=True)

    user = db.relationship('User', backref=db.backref('api_tokens', lazy='dynamic', cascade='all, delete-orphan'))

    def is_active(self):
        return self.revoked_at is None

    def has_scope(self, scope: str) -> bool:
        scopes = self.scopes or []
        if 'admin' in scopes:
            return True
        return scope in scopes

    def to_public_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'token_prefix': self.token_prefix,
            'scopes': self.scopes or [],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_used_at': self.last_used_at.isoformat() if self.last_used_at else None,
            'revoked': self.revoked_at is not None,
        }


class ClientDevice(db.Model):
    """Companion client presence tracked via heartbeat."""

    __tablename__ = 'client_devices'
    __table_args__ = (
        db.UniqueConstraint('user_id', 'device_id', name='uq_client_devices_user_device'),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey('users.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    device_id = db.Column(db.String(64), nullable=False)
    device_kind = db.Column(db.String(16), nullable=False, default='companion')
    device_name = db.Column(db.String(128), nullable=True)
    client_version = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(512), nullable=True)
    last_seen_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = db.relationship(
        'User',
        backref=db.backref('client_devices', lazy='dynamic', cascade='all, delete-orphan'),
    )

    def to_dict(self):
        return {
            'device_id': self.device_id,
            'device_kind': self.device_kind or 'companion',
            'device_name': self.device_name,
            'client_version': self.client_version,
            'last_seen_at': self.last_seen_at.isoformat() if self.last_seen_at else None,
        }


class DownloadRequest(db.Model):
    __tablename__ = 'download_requests'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    game_uuid = db.Column(db.String(36), db.ForeignKey('games.uuid', ondelete='CASCADE'), nullable=False)
    status = db.Column(db.String(50), default='pending')
    zip_file_path = db.Column(db.String, nullable=True)
    request_time = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    completion_time = db.Column(db.DateTime, nullable=True)
    download_size = db.Column(db.Float, nullable=False, default=0.0)
    game = db.relationship('Game', foreign_keys=[game_uuid], back_populates='download_requests')
    file_location = db.Column(db.String, nullable=True)


class Whitelist(db.Model):
    __tablename__ = 'whitelist'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)

class ReleaseGroup(db.Model):
    __tablename__ = 'filters'

    id = db.Column(db.Integer, primary_key=True)
    filter_pattern = db.Column(db.String, nullable=True)
    case_sensitive = db.Column(db.String, nullable=True)

    def __repr__(self):
        return f"<ReleaseGroup id={self.id}, filter_pattern={self.filter_pattern}, case_sensitive={self.case_sensitive}>"

class GameMode(db.Model):
    __tablename__ = 'game_modes'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True)
    games = db.relationship("Game", secondary="game_game_mode_association", back_populates="game_modes")

class Theme(db.Model):
    __tablename__ = 'themes'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True)
    games = db.relationship("Game", secondary="game_theme_association", back_populates="themes")

class Genre(db.Model):
    __tablename__ = 'genres'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True)
    games = db.relationship("Game", secondary="game_genre_association", back_populates="genres")

class Developer(db.Model):
    __tablename__ = 'developers'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), unique=True)
    games = db.relationship("Game", back_populates="developer")

class Publisher(db.Model):
    __tablename__ = 'publishers'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), unique=True)
    games = db.relationship("Game", back_populates="publisher")

class Platform(db.Model):
    __tablename__ = 'platforms'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True)
    games = db.relationship("Game", secondary="game_platform_association", back_populates="platforms")

class PlayerPerspective(db.Model):
    __tablename__ = 'player_perspectives'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True)
    games = db.relationship("Game", secondary="game_player_perspective_association", back_populates="player_perspectives")

class MultiplayerMode(db.Model):
    __tablename__ = 'multiplayer_modes'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True)
    games = db.relationship("Game", secondary="game_multiplayer_mode_association", back_populates="multiplayer_modes")

class Newsletter(db.Model):
    __tablename__ = 'newsletters'
    
    id = db.Column(db.Integer, primary_key=True)
    subject = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    sent_date = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    recipient_count = db.Column(db.Integer, default=0)
    recipients = db.Column(JSON)
    status = db.Column(db.String(20), default='pending')  # pending, sent, failed
    error_message = db.Column(db.Text, nullable=True)
    
    sender = db.relationship('User', backref='sent_newsletters')

def genre_choices():
    return db.session.execute(select(Genre)).scalars().all()

def game_mode_choices():
    return db.session.execute(select(GameMode)).scalars().all()

def theme_choices():
    return db.session.execute(select(Theme)).scalars().all()

def platform_choices():
    return db.session.execute(select(Platform)).scalars().all()

def player_perspective_choices():
    return db.session.execute(select(PlayerPerspective)).scalars().all()

def developer_choices():
    return db.session.execute(select(Developer)).scalars().all()

def publisher_choices():
    return db.session.execute(select(Publisher)).scalars().all()




class ScanJob(db.Model):
    __tablename__ = 'scan_jobs'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    folders = db.Column(JSONEncodedDict)
    content_type = db.Column(db.Enum('Games', name='content_type_enum'))
    schedule = db.Column(db.Enum('8_hours', '24_hours', '48_hours', name='schedule_enum'))
    is_enabled = db.Column(db.Boolean, default=True)
    status = db.Column(db.Enum(
        'Scheduled', 'Queued', 'Running', 'Stopping', 'Completed', 'Failed', 'Cancelled',
        name='status_enum',
    ))
    last_run = db.Column(db.DateTime, nullable=True)
    next_run = db.Column(db.DateTime, nullable=True)
    error_message = db.Column(db.Text)
    total_folders = db.Column(db.Integer, default=0)
    folders_success = db.Column(db.Integer, default=0)
    folders_failed = db.Column(db.Integer, default=0)
    library_uuid = db.Column(db.String(36), db.ForeignKey('libraries.uuid'), nullable=True)
    library = db.relationship('Library', backref=db.backref('scan_jobs', lazy=True))
    removed_count = db.Column(db.Integer, default=0)
    scan_folder = db.Column(db.String(512), nullable=True)
    setting_remove = db.Column(db.Boolean, default=False)
    setting_filefolder = db.Column(db.Boolean, default=False)
    setting_download_missing_images = db.Column(db.Boolean, default=False)
    setting_force_updates_extras = db.Column(db.Boolean, default=False)
    current_processing = db.Column(db.String(255), nullable=True)  # "Processing: Game Name (450/1000)"
    last_progress_update = db.Column(db.DateTime, nullable=True)

class UnmatchedFolder(db.Model):
    __tablename__ = 'unmatched_folders'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    library_uuid = db.Column(db.String(36), ForeignKey('libraries.uuid', ondelete="CASCADE"), nullable=True)
    scan_job_id = db.Column(db.String(36), db.ForeignKey('scan_jobs.id'))
    folder_path = db.Column(db.String)
    failed_time = db.Column(db.DateTime)
    content_type = db.Column(db.Enum('Games', name='unmatched_folder_content_type_enum'))
    status = db.Column(db.Enum('Pending', 'Ignore', 'Duplicate', 'Unmatched', name='unmatched_folder_status_enum'))
    # Wave 2a: how this row was matched when status=Duplicate (queryable glance)
    matched_game_uuid = db.Column(db.String(36), nullable=True, index=True)
    match_reason = db.Column(db.String(64), nullable=True)
    match_score = db.Column(db.Float, nullable=True)
    # Wave 4: denormalized from proposal sidecar at propose/log time (list API — no N+1)
    suggested_kind = db.Column(db.String(16), nullable=True)
    suggested_candidate_name = db.Column(db.String(255), nullable=True)
    # W21-BE-2b: Stage E propose-only hints denormalized from proposal sidecar (list — no N+1)
    stage_e_candidates = db.Column(db.JSON, nullable=True)
    stage_e = db.Column(db.JSON, nullable=True)
    # Wave 17: soft librarian naming (no disk rename / folder_path change)
    search_name = db.Column(db.String(255), nullable=True)
    display_name = db.Column(db.String(255), nullable=True)
    # UX-C5: operator feedback that a proposed match is wrong. Kept apart from
    # `match_reason`, which is the matcher explaining itself — this is a human
    # contradicting it, and conflating the two would lose that distinction.
    bad_match_reason = db.Column(db.String(32), nullable=True)
    bad_match_note = db.Column(db.String(500), nullable=True)
    bad_match_at = db.Column(db.DateTime, nullable=True)
    bad_match_by_user_id = db.Column(
        db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True,
    )


class DuplicateFixLog(db.Model):
    """Queryable admin/dev log of duplicate triage actions (merge/keep/ignore)."""

    __tablename__ = 'duplicate_fix_logs'

    id = db.Column(db.Integer, primary_key=True)
    unmatched_folder_id = db.Column(db.String(36), nullable=True, index=True)
    folder_path = db.Column(db.String(1024), nullable=False)
    matched_game_uuid = db.Column(db.String(36), nullable=True, index=True)
    match_reason = db.Column(db.String(64), nullable=True)
    match_score = db.Column(db.Float, nullable=True)
    action = db.Column(db.String(32), nullable=False)  # merge | keep | ignore
    actor_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    notes = db.Column(db.String(512), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    actor = db.relationship('User', backref='duplicate_fix_logs')

    def __repr__(self):
        return f"<DuplicateFixLog {self.action} path={self.folder_path!r}>"


class UserPreference(db.Model):
    __tablename__ = 'user_preferences'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey('users.id', ondelete='CASCADE'),
        nullable=False
    )
    items_per_page = db.Column(db.Integer, default=50)
    default_sort = db.Column(db.String(50), default='name')
    default_sort_order = db.Column(db.String(4), default='asc')
    theme = db.Column(db.String(50), default='default')
    icon_pack = db.Column(db.String(50), default='outline')
    # Theme font id from utils.theme_fonts (orthogonal to theme and icon pack,
    # exactly like icon_pack is).
    font = db.Column(db.String(64), default='system-ui')
    locale = db.Column(db.String(10), default='en')
    preferred_game_locale = db.Column(db.String(16), default='en-US', nullable=False)
    tile_size = db.Column(db.String(8), default='50', nullable=False)
    notify_friend_requests = db.Column(db.Boolean, default=True, nullable=False)
    notify_activity = db.Column(db.Boolean, default=True, nullable=False)
    notify_mentions = db.Column(db.Boolean, default=True, nullable=False)
    notify_chat = db.Column(db.Boolean, default=True, nullable=False)
    notify_support = db.Column(db.Boolean, default=True, nullable=False)
    notify_free_games = db.Column(db.Boolean, default=True, nullable=False)
    # Opt-in: email for @mentions + DMs when SMTP is configured (default off).
    email_notify_social = db.Column(db.Boolean, default=True, nullable=False)
    # Opt-in: batched email of unread mentions/DMs/free games (default off).
    email_digest_daily = db.Column(db.Boolean, default=False, nullable=False)
    email_digest_last_sent_at = db.Column(db.DateTime, nullable=True)

    user = db.relationship('User', back_populates='preferences')


class EmulatorSave(db.Model):
    """Per-user emulator save-state blob metadata (opt-in cloud sync)."""

    __tablename__ = 'emulator_saves'
    __table_args__ = (
        db.UniqueConstraint('user_id', 'game_uuid', 'slot_name', name='uq_emulator_save_slot'),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey('users.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    game_uuid = db.Column(
        db.String(36),
        db.ForeignKey('games.uuid', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    slot_name = db.Column(db.String(64), nullable=False, default='slot1')
    filename = db.Column(db.String(255), nullable=False)
    size_bytes = db.Column(db.Integer, nullable=False, default=0)
    storage_path = db.Column(db.String(1024), nullable=False)
    encrypted = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def to_dict(self):
        return {
            'id': self.id,
            'game_uuid': self.game_uuid,
            'slot_name': self.slot_name,
            'filename': self.filename,
            'size_bytes': self.size_bytes,
            'encrypted': bool(self.encrypted),
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class GlobalSettings(db.Model):
    __tablename__ = 'global_settings'

    id = db.Column(db.Integer, primary_key=True)
    settings = db.Column(JSONEncodedDict)  # Store all settings in a single JSON-encoded column
    last_updated = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    # SMTP Settings
    smtp_server = db.Column(db.String(255), nullable=True)
    smtp_port = db.Column(db.Integer, nullable=True)
    smtp_username = db.Column(db.String(255), nullable=True)
    smtp_password = db.Column(db.String(255), nullable=True)
    smtp_use_tls = db.Column(db.Boolean, default=True)
    smtp_default_sender = db.Column(db.String(255), nullable=True)
    smtp_last_tested = db.Column(db.DateTime, nullable=True)
    smtp_enabled = db.Column(db.Boolean, default=False)
    enable_delete_game_on_disk = db.Column(db.Boolean, default=True)
    # IGDB Settings
    igdb_client_id = db.Column(db.String(255), nullable=True)
    igdb_client_secret = db.Column(db.String(255), nullable=True)
    igdb_last_tested = db.Column(db.DateTime, nullable=True)
    enable_game_updates = db.Column(db.Boolean, default=True)
    update_folder_name = db.Column(db.String(255), default='updates')
    enable_game_extras = db.Column(db.Boolean, default=True)
    extras_folder_name = db.Column(db.String(255), default='extras')
    site_url = db.Column(db.String(255), default='http://127.0.0.1')
    # Image Download Settings (Unraid-safe defaults; runtime also hard-capped in worker_caps)
    use_turbo_image_downloads = db.Column(db.Boolean, default=True)
    turbo_download_threads = db.Column(db.Integer, default=4)
    turbo_download_batch_size = db.Column(db.Integer, default=100)
    # Scan Thread Settings (default 1 for shared NAS CPUs; hard max via worker_caps)
    scan_thread_count = db.Column(db.Integer, default=1)
    # Setup State Tracking
    setup_in_progress = db.Column(db.Boolean, default=False)
    setup_current_step = db.Column(db.Integer, default=1)
    setup_completed = db.Column(db.Boolean, default=False)
    # Attract Mode Settings
    attract_mode_enabled = db.Column(db.Boolean, default=True)
    attract_mode_idle_timeout = db.Column(db.Integer, default=60)  # seconds, range 10-300
    attract_mode_settings = db.Column(JSONEncodedDict)  # JSON: filters, autoplay settings
    # HowLongToBeat Settings
    enable_hltb_integration = db.Column(db.Boolean, default=True)
    hltb_rate_limit_delay = db.Column(db.Float, default=2.0)  # seconds between HLTB requests
    # Local Metadata Settings
    use_local_metadata = db.Column(db.Boolean, default=False)
    write_local_metadata = db.Column(db.Boolean, default=False)
    use_local_images = db.Column(db.Boolean, default=False)
    local_metadata_filename = db.Column(db.String(50), default='gametheca.json')
    # Scan Behavior Settings
    propose_only_scan = db.Column(db.Boolean, default=False)
    # OIDC / SSO Settings
    oidc_enabled = db.Column(db.Boolean, default=False)
    oidc_issuer_url = db.Column(db.String(512), nullable=True)
    oidc_client_id = db.Column(db.String(255), nullable=True)
    oidc_client_secret = db.Column(db.String(512), nullable=True)
    oidc_redirect_uri = db.Column(db.String(512), nullable=True)
    oidc_scopes = db.Column(db.String(255), default='openid email profile')
    oidc_role_claim = db.Column(db.String(64), default='groups')
    oidc_role_map = db.Column(JSONEncodedDict, nullable=True)
    oidc_display_name = db.Column(db.String(120), default='Sign in with SSO')
    # Store ownership sync (register-only; never downloads from stores)
    enable_store_ownership_sync = db.Column(db.Boolean, default=True)
    steam_web_api_key = db.Column(db.String(255), nullable=True)
    steamgriddb_api_key = db.Column(db.String(255), nullable=True)
    # Emulator profiles: { "NES": "nestopia", ... } preferred WebRetro cores
    emulator_profiles = db.Column(JSONEncodedDict, nullable=True)
    # Optional *arr automation module (feature-flagged)
    enable_arr_module = db.Column(db.Boolean, default=True)
    arr_settings = db.Column(JSONEncodedDict, nullable=True)
    # Opt-in WebRetro / companion save-state sync
    enable_emulator_save_sync = db.Column(db.Boolean, default=True)
    encrypt_emulator_saves = db.Column(db.Boolean, default=False)
    # GiantBomb metadata key (optional)
    giantbomb_api_key = db.Column(db.String(255), nullable=True)
    # MobyGames identify search key (optional — empty search when unset)
    mobygames_api_key = db.Column(db.String(255), nullable=True)
    # TheGamesDB identify search key (optional — empty search when unset)
    thegamesdb_api_key = db.Column(db.String(255), nullable=True)
    # Preferred release groups / size bands for *arr scoring
    quality_profiles = db.Column(JSONEncodedDict, nullable=True)
    # Game details section order/visibility
    detail_layout = db.Column(JSONEncodedDict, nullable=True)
    # Optional Ollama AI assist
    enable_ai_assist = db.Column(db.Boolean, default=True)
    enable_malware_scan = db.Column(db.Boolean, default=True)
    ollama_base_url = db.Column(db.String(512), nullable=True)
    ollama_model = db.Column(db.String(120), nullable=True)
    # BYO community chat (Stoat / Matrix invite) — deep-link only
    community_chat_url = db.Column(db.String(512), nullable=True)
    community_chat_label = db.Column(db.String(120), nullable=True)
    # In-app admin alerts (replaces former external chat webhooks)
    admin_notify_new_games = db.Column(db.Boolean, default=True)
    admin_notify_game_updates = db.Column(db.Boolean, default=False)
    admin_notify_game_extras = db.Column(db.Boolean, default=False)
    admin_notify_downloads = db.Column(db.Boolean, default=False)
    admin_notify_support = db.Column(db.Boolean, default=True)
    # BYO Sunshine / Wolf remote play (Moonlight clients) — off by default
    enable_remote_play = db.Column(db.Boolean, default=False)
    remote_play_settings = db.Column(JSONEncodedDict, nullable=True)
    # Loading icon: rotate catalogue vs lock to one id (member/admin loading UIs)
    loading_icon_mode = db.Column(db.String(16), default='rotate')
    loading_icon_id = db.Column(db.String(64), nullable=True)

    def __repr__(self):
        return f'<GlobalSettings id={self.id}, last_updated={self.last_updated}>'

class DiscoverySection(db.Model):
    __tablename__ = 'discovery_sections'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    identifier = db.Column(db.String(50), unique=True, nullable=False)
    is_visible = db.Column(db.Boolean, default=True)
    display_order = db.Column(db.Integer, default=0)
    # 'seed' = built-in shelf (libraries, latest_games, ...); 'custom' = admin-created zone
    section_type = db.Column(db.String(20), default='seed', nullable=False)
    # Custom zone config, e.g. {"mode": "manual", "game_uuids": [...]}
    # or {"mode": "filter", "filter_type": "library|platform|genre", "filter_value": "..."}
    config = db.Column(JSONEncodedDict, nullable=True)
    # W25-STORE-1: a shelf with a window is an "event" — it only renders inside it.
    starts_at = db.Column(db.DateTime, nullable=True)
    ends_at = db.Column(db.DateTime, nullable=True)
    # Storefront treatment: shelf (default) | hero | carousel
    layout = db.Column(db.String(20), default='shelf', nullable=False)

    def is_live(self, now=None):
        """True when the shelf is visible and inside its schedule window."""
        if not self.is_visible:
            return False
        moment = now or datetime.now(timezone.utc)
        if moment.tzinfo is None:
            moment = moment.replace(tzinfo=timezone.utc)

        def _aware(value):
            if value is None:
                return None
            return value if value.tzinfo else value.replace(tzinfo=timezone.utc)

        starts = _aware(self.starts_at)
        ends = _aware(self.ends_at)
        if starts and moment < starts:
            return False
        if ends and moment > ends:
            return False
        return True

    def __repr__(self):
        return f"<DiscoverySection {self.name}>"


class InviteToken(db.Model):
    __tablename__ = 'invite_tokens'

    id = db.Column(db.Integer, primary_key=True)
    token = db.Column(db.String(256), nullable=False, unique=True)
    creator_user_id = db.Column(db.String(36), db.ForeignKey('users.user_id'), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc) + timedelta(days=2), nullable=False)
    used = db.Column(db.Boolean, default=False, nullable=False)
    recipient_email = db.Column(db.String(120), nullable=True)
    used_by = db.Column(db.String(36), db.ForeignKey('users.user_id'), nullable=True)
    used_at = db.Column(db.DateTime, nullable=True)

    creator = db.relationship('User', foreign_keys=[creator_user_id], backref='created_invites')
    used_by_user = db.relationship('User', foreign_keys=[used_by], backref='used_invites')

    def __repr__(self):
        return f'<InviteToken {self.token}, Creator: {self.creator_user_id}, Expires: {self.expires_at}, Used: {self.used}>'


class UserAttractModeSettings(db.Model):
    __tablename__ = 'user_attract_mode_settings'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey('users.user_id'), nullable=False, unique=True)
    has_customized = db.Column(db.Boolean, default=False)
    filter_settings = db.Column(JSONEncodedDict)  # JSON: platform, genres, themes, date_range
    autoplay_settings = db.Column(JSONEncodedDict)  # JSON: enabled, skipFirst, skipAfter
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    user = db.relationship('User', backref=db.backref('attract_mode_settings', uselist=False, cascade='all, delete-orphan'))

    def __repr__(self):
        return f'<UserAttractModeSettings user_id={self.user_id}, customized={self.has_customized}>'


class PlaySession(db.Model):
    """Authoritative play session with heartbeat TTL."""

    __tablename__ = 'play_sessions'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    game_uuid = db.Column(db.String(36), db.ForeignKey('games.uuid', ondelete='CASCADE'), nullable=False, index=True)
    started_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    last_heartbeat_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    ended_at = db.Column(db.DateTime, nullable=True)
    duration_seconds = db.Column(db.Integer, default=0, nullable=False)
    client = db.Column(db.String(64), nullable=True)  # web | desktop | etc.
    status = db.Column(db.String(16), default='active', nullable=False)  # active | ended | orphaned

    user = db.relationship('User', backref=db.backref('play_sessions', lazy='dynamic'))
    game = db.relationship('Game', backref=db.backref('play_sessions', lazy='dynamic'))

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'game_uuid': self.game_uuid,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'last_heartbeat_at': self.last_heartbeat_at.isoformat() if self.last_heartbeat_at else None,
            'ended_at': self.ended_at.isoformat() if self.ended_at else None,
            'duration_seconds': self.duration_seconds,
            'client': self.client,
            'status': self.status,
        }


class UserFriendship(db.Model):
    """Lite social graph — pending / accepted friendships (Wave 13)."""

    __tablename__ = 'user_friendships'
    __table_args__ = (
        db.UniqueConstraint('user_id', 'friend_user_id', name='uq_user_friendship'),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    friend_user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    status = db.Column(db.String(16), default='pending', nullable=False)  # pending | accepted | blocked
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = db.relationship('User', foreign_keys=[user_id], backref=db.backref('friendships_sent', lazy='dynamic'))
    friend = db.relationship(
        'User',
        foreign_keys=[friend_user_id],
        backref=db.backref('friendships_received', lazy='dynamic'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'friend_user_id': self.friend_user_id,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class UserNotification(db.Model):
    """In-app notification center (Wave 14c)."""

    __tablename__ = 'user_notifications'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    kind = db.Column(db.String(32), nullable=False, default='info')
    title = db.Column(db.String(200), nullable=False)
    body = db.Column(db.String(500), nullable=True)
    link = db.Column(db.String(512), nullable=True)
    actor_user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    payload = db.Column(JSONEncodedDict, nullable=True)
    read_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'kind': self.kind,
            'title': self.title,
            'body': self.body,
            'link': self.link,
            'actor_user_id': self.actor_user_id,
            'payload': self.payload or {},
            'read_at': self.read_at.isoformat() if self.read_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'unread': self.read_at is None,
        }


class ChatSpace(db.Model):
    """A space ("server") holding text + voice channels (W23-SOCIAL-1).

    ``visibility='household'`` auto-joins every non-child user; ``'invite'``
    requires an explicit ChatSpaceMember row. Admin-created only.
    Native first-party model — not Discord, no bridging.
    """

    __tablename__ = 'chat_spaces'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    slug = db.Column(db.String(64), nullable=True, unique=True)
    description = db.Column(db.String(500), nullable=True)
    # household = everyone (non-child) is a member; invite = explicit rows only
    visibility = db.Column(db.String(16), nullable=False, default='household')
    is_child_safe = db.Column(db.Boolean, default=True, nullable=False)
    display_order = db.Column(db.Integer, default=0, nullable=False)
    created_by_user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    archived_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'slug': self.slug,
            'description': self.description,
            'visibility': self.visibility,
            'is_child_safe': bool(self.is_child_safe),
            'display_order': self.display_order or 0,
            'created_by_user_id': self.created_by_user_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'archived': self.archived_at is not None,
        }


class ChatSpaceMember(db.Model):
    __tablename__ = 'chat_space_members'
    __table_args__ = (
        db.UniqueConstraint('space_id', 'user_id', name='uq_chat_space_member'),
    )

    id = db.Column(db.Integer, primary_key=True)
    space_id = db.Column(db.Integer, db.ForeignKey('chat_spaces.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    role = db.Column(db.String(16), nullable=False, default='member')  # owner | moderator | member
    muted = db.Column(db.Boolean, default=False, nullable=False)
    joined_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class ChatSpaceInvite(db.Model):
    """Token invite into an ``invite``-visibility space."""

    __tablename__ = 'chat_space_invites'

    id = db.Column(db.Integer, primary_key=True)
    space_id = db.Column(db.Integer, db.ForeignKey('chat_spaces.id', ondelete='CASCADE'), nullable=False, index=True)
    token = db.Column(db.String(128), nullable=False, unique=True, index=True)
    created_by_user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=True)
    max_uses = db.Column(db.Integer, nullable=True)
    uses = db.Column(db.Integer, default=0, nullable=False)
    revoked_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self, *, include_token: bool = False):
        row = {
            'id': self.id,
            'space_id': self.space_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'max_uses': self.max_uses,
            'uses': self.uses or 0,
            'revoked': self.revoked_at is not None,
        }
        if include_token:
            row['token'] = self.token
        return row


class ChatChannel(db.Model):
    """Text or voice channel in a space, or a 1:1 DM thread (Wave 15 · W23-SOCIAL-1)."""

    __tablename__ = 'chat_channels'

    id = db.Column(db.Integer, primary_key=True)
    kind = db.Column(db.String(16), nullable=False, default='channel')  # channel | dm | voice
    name = db.Column(db.String(120), nullable=False)
    slug = db.Column(db.String(64), nullable=True, unique=True)
    # DMs carry no space; space channels are access-gated by space membership.
    space_id = db.Column(
        db.Integer,
        db.ForeignKey('chat_spaces.id', ondelete='CASCADE'),
        nullable=True,
        index=True,
    )
    display_order = db.Column(db.Integer, default=0, nullable=False)
    is_child_safe = db.Column(db.Boolean, default=True, nullable=False)
    created_by_user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    archived_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        kind = self.kind
        return {
            'id': self.id,
            'kind': kind,
            # Slide-out alias — same as kind (channel | dm | voice)
            'type': kind,
            'name': self.name,
            'slug': self.slug,
            'space_id': self.space_id,
            'display_order': self.display_order or 0,
            'is_child_safe': bool(self.is_child_safe),
            'created_by_user_id': self.created_by_user_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'archived': self.archived_at is not None,
            'archived_at': self.archived_at.isoformat() if self.archived_at else None,
        }


class ChatChannelMember(db.Model):
    __tablename__ = 'chat_channel_members'
    __table_args__ = (
        db.UniqueConstraint('channel_id', 'user_id', name='uq_chat_channel_member'),
    )

    id = db.Column(db.Integer, primary_key=True)
    channel_id = db.Column(db.Integer, db.ForeignKey('chat_channels.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    last_read_message_id = db.Column(db.Integer, nullable=True)
    muted = db.Column(db.Boolean, default=False, nullable=False)
    joined_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class ChatMessage(db.Model):
    __tablename__ = 'chat_messages'

    id = db.Column(db.Integer, primary_key=True)
    channel_id = db.Column(db.Integer, db.ForeignKey('chat_channels.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    body = db.Column(db.Text, nullable=False)
    parent_message_id = db.Column(
        db.Integer,
        db.ForeignKey('chat_messages.id', ondelete='SET NULL'),
        nullable=True,
        index=True,
    )
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def to_dict(
        self,
        *,
        author_name: str | None = None,
        reactions: dict | None = None,
        mine: list | None = None,
        attachments: list | None = None,
    ):
        payload = {
            'id': self.id,
            'channel_id': self.channel_id,
            'user_id': self.user_id,
            'user': author_name or 'member',
            'body': self.body,
            'parent_message_id': self.parent_message_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'reactions': reactions or {},
            'mine': mine or [],
            'attachments': attachments if attachments is not None else [],
        }
        return payload


class ChatMessageAttachment(db.Model):
    """File/image attachment for a household chat message (Wave 16 chat)."""

    __tablename__ = 'chat_message_attachments'

    id = db.Column(db.Integer, primary_key=True)
    channel_id = db.Column(
        db.Integer,
        db.ForeignKey('chat_channels.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    message_id = db.Column(
        db.Integer,
        db.ForeignKey('chat_messages.id', ondelete='CASCADE'),
        nullable=True,
        index=True,
    )
    uploaded_by_user_id = db.Column(
        db.Integer,
        db.ForeignKey('users.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    file_name = db.Column(db.String(120), nullable=False)
    original_name = db.Column(db.String(255), nullable=False)
    mime = db.Column(db.String(128), nullable=False)
    size_bytes = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def public_url(self) -> str:
        return f'/static/library/chat-attachments/{self.file_name}'

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'url': self.public_url(),
            'mime': self.mime,
            'name': self.original_name,
            'size': self.size_bytes,
        }


class ChatMessageReaction(db.Model):
    """Emoji reaction on a chat message (Wave 17)."""

    __tablename__ = 'chat_message_reactions'
    __table_args__ = (
        db.UniqueConstraint('message_id', 'user_id', 'emoji', name='uq_chat_message_reaction'),
    )

    id = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(
        db.Integer,
        db.ForeignKey('chat_messages.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    emoji = db.Column(db.String(32), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class CustomEmoji(db.Model):
    """Household custom reaction emoji (Wave 17b) — admin upload capped."""

    __tablename__ = 'custom_emoji'

    id = db.Column(db.Integer, primary_key=True)
    slug = db.Column(db.String(24), nullable=False, unique=True)
    label = db.Column(db.String(64), nullable=False)
    file_name = db.Column(db.String(80), nullable=False)
    uploaded_by_user_id = db.Column(
        db.Integer,
        db.ForeignKey('users.id', ondelete='SET NULL'),
        nullable=True,
    )
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def reaction_key(self) -> str:
        return f':{self.slug}:'

    def public_url(self) -> str:
        return f'/static/library/chat-emoji/{self.file_name}'

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'slug': self.slug,
            'label': self.label,
            'emoji': self.reaction_key(),
            'url': self.public_url(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class ReferenceSet(db.Model):
    """Operator-uploaded No-Intro/Redump DAT for ROM set completeness."""

    __tablename__ = 'reference_sets'
    __table_args__ = (
        db.UniqueConstraint(
            'library_platform',
            'region',
            name='uq_reference_set_platform_region',
        ),
    )

    id = db.Column(db.Integer, primary_key=True)
    library_platform = db.Column(db.String(32), nullable=False, index=True)
    region = db.Column(db.String(16), nullable=False, index=True)
    source = db.Column(db.String(16), nullable=False, default='nointro')
    name = db.Column(db.String(255), nullable=False, default='')
    entry_count = db.Column(db.Integer, nullable=False, default=0)
    uploaded_by_user_id = db.Column(
        db.Integer,
        db.ForeignKey('users.id', ondelete='SET NULL'),
        nullable=True,
    )
    uploaded_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    entries = db.relationship(
        'ReferenceSetEntry',
        back_populates='reference_set',
        cascade='all, delete-orphan',
        lazy='dynamic',
    )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'library_platform': self.library_platform,
            'region': self.region,
            'source': self.source,
            'name': self.name,
            'entry_count': self.entry_count,
            'uploaded_at': self.uploaded_at.isoformat() if self.uploaded_at else None,
        }


class ReferenceSetEntry(db.Model):
    """One game/ROM row from a reference DAT."""

    __tablename__ = 'reference_set_entries'
    __table_args__ = (
        db.Index('ix_reference_set_entries_set_norm', 'set_id', 'normalized_name'),
    )

    id = db.Column(db.Integer, primary_key=True)
    set_id = db.Column(
        db.Integer,
        db.ForeignKey('reference_sets.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    name = db.Column(db.String(512), nullable=False)
    normalized_name = db.Column(db.String(512), nullable=False)
    crc = db.Column(db.String(16), nullable=True)
    md5 = db.Column(db.String(32), nullable=True)
    sha1 = db.Column(db.String(40), nullable=True)
    size = db.Column(db.BigInteger, nullable=True)
    serial = db.Column(db.String(64), nullable=True)

    reference_set = db.relationship('ReferenceSet', back_populates='entries')

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'name': self.name,
            'normalized_name': self.normalized_name,
            'crc': self.crc,
            'md5': self.md5,
            'sha1': self.sha1,
            'size': self.size,
            'serial': self.serial,
        }


class GameServer(db.Model):
    """Admin-managed household game server join metadata."""

    __tablename__ = 'game_servers'

    id = db.Column(db.Integer, primary_key=True)
    uuid = db.Column(db.String(36), default=lambda: str(uuid4()), unique=True, nullable=False)
    display_name = db.Column(db.String(255), nullable=False)
    connect_string = db.Column(db.String(512), nullable=False)
    game_uuid = db.Column(
        db.String(36),
        db.ForeignKey('games.uuid', ondelete='SET NULL'),
        nullable=True,
        index=True,
    )
    health_url = db.Column(db.String(512), nullable=True)
    compose_project = db.Column(db.String(128), nullable=True)
    container_id = db.Column(db.String(128), nullable=True)
    invite_note = db.Column(db.Text, nullable=True)
    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    game = db.relationship('Game', foreign_keys=[game_uuid])

    def to_dict(self, *, admin: bool = False) -> dict:
        payload = {
            'uuid': self.uuid,
            'display_name': self.display_name,
            'connect_string': self.connect_string,
            'game_uuid': self.game_uuid,
            'invite_note': self.invite_note,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if admin:
            payload.update({
                'id': self.id,
                'health_url': self.health_url,
                'compose_project': self.compose_project,
                'container_id': self.container_id,
            })
        return payload


class UserGameProgress(db.Model):
    """Aggregated playtime per user/game."""

    __tablename__ = 'user_game_progress'
    __table_args__ = (
        db.UniqueConstraint('user_id', 'game_uuid', name='uq_user_game_progress'),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    game_uuid = db.Column(db.String(36), db.ForeignKey('games.uuid', ondelete='CASCADE'), nullable=False, index=True)
    total_seconds = db.Column(db.Integer, default=0, nullable=False)
    session_count = db.Column(db.Integer, default=0, nullable=False)
    last_played_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self):
        return {
            'user_id': self.user_id,
            'game_uuid': self.game_uuid,
            'total_seconds': self.total_seconds,
            'session_count': self.session_count,
            'last_played_at': self.last_played_at.isoformat() if self.last_played_at else None,
        }


class GameCollection(db.Model):
    """Admin or user curated collection / shelf."""

    __tablename__ = 'game_collections'

    id = db.Column(db.Integer, primary_key=True)
    uuid = db.Column(db.String(36), unique=True, nullable=False, default=lambda: str(uuid4()))
    name = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text, nullable=True)
    owner_user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=True)
    is_public = db.Column(db.Boolean, default=True, nullable=False)
    is_system = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    items = db.relationship(
        'GameCollectionItem',
        back_populates='collection',
        cascade='all, delete-orphan',
        order_by='GameCollectionItem.position',
    )

    def to_dict(self, include_items=False):
        data = {
            'id': self.id,
            'uuid': self.uuid,
            'name': self.name,
            'description': self.description,
            'owner_user_id': self.owner_user_id,
            'is_public': self.is_public,
            'is_system': self.is_system,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_items:
            data['items'] = [i.to_dict() for i in self.items]
        return data


class GameCollectionItem(db.Model):
    __tablename__ = 'game_collection_items'
    __table_args__ = (
        db.UniqueConstraint('collection_id', 'game_uuid', name='uq_collection_game'),
    )

    id = db.Column(db.Integer, primary_key=True)
    collection_id = db.Column(db.Integer, db.ForeignKey('game_collections.id', ondelete='CASCADE'), nullable=False)
    game_uuid = db.Column(db.String(36), db.ForeignKey('games.uuid', ondelete='CASCADE'), nullable=False)
    position = db.Column(db.Integer, default=0, nullable=False)

    collection = db.relationship('GameCollection', back_populates='items')
    game = db.relationship('Game')

    def to_dict(self):
        library_platform = None
        if self.game is not None and self.game.library is not None and self.game.library.platform is not None:
            library_platform = self.game.library.platform.name
        return {
            'id': self.id,
            'collection_id': self.collection_id,
            'game_uuid': self.game_uuid,
            'game_name': self.game.name if self.game else None,
            'library_platform': library_platform,
            'position': self.position,
        }


class Announcement(db.Model):
    """Admin news / announcements for store-grade browse."""

    __tablename__ = 'announcements'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    body = db.Column(db.Text, nullable=False)
    published = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    author_user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)

    def to_dict(self):
        body = self.body or ''
        return {
            'id': self.id,
            'title': self.title,
            'body': body,
            # Compact preview for News / overhaul cards (full body still present).
            'body_preview': body[:280],
            'published': self.published,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'author_user_id': self.author_user_id,
        }


class FreeGameOffer(db.Model):
    """Cached free / giveaway offers from store APIs + GamerPower (Wave 18)."""

    __tablename__ = 'free_game_offers'
    __table_args__ = (
        db.UniqueConstraint('store', 'external_id', name='uq_free_game_offer_store_ext'),
    )

    id = db.Column(db.Integer, primary_key=True)
    store = db.Column(db.String(16), nullable=False, index=True)
    external_id = db.Column(db.String(64), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.String(500), nullable=True)
    image_url = db.Column(db.String(1024), nullable=True)
    claim_url = db.Column(db.String(1024), nullable=True)
    store_url = db.Column(db.String(1024), nullable=True)
    worth = db.Column(db.String(64), nullable=True)
    starts_at = db.Column(db.DateTime, nullable=True)
    ends_at = db.Column(db.DateTime, nullable=True)
    source = db.Column(db.String(32), nullable=False, default='gamerpower', index=True)
    active = db.Column(db.Boolean, default=True, nullable=False, index=True)
    first_seen_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    last_seen_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class GameRequest(db.Model):
    """User wishlist / request queue."""

    __tablename__ = 'game_requests'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    title = db.Column(db.String(255), nullable=False)
    notes = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(32), default='pending', nullable=False)  # pending|approved|rejected|fulfilled
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    resolved_at = db.Column(db.DateTime, nullable=True)
    resolved_by_user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    linked_game_uuid = db.Column(db.String(36), db.ForeignKey('games.uuid', ondelete='SET NULL'), nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'notes': self.notes,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
            'resolved_by_user_id': self.resolved_by_user_id,
            'linked_game_uuid': self.linked_game_uuid,
        }


class SupportTicket(db.Model):
    """In-app teammate support reports → GitHub Issues (no external chat SaaS)."""

    __tablename__ = 'support_tickets'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    title = db.Column(db.String(200), nullable=False)
    body = db.Column(db.Text, nullable=False)
    area = db.Column(db.String(64), nullable=True)
    severity = db.Column(db.String(8), default='P2', nullable=False)
    role_at_submit = db.Column(db.String(32), nullable=True)
    deploy_hint = db.Column(db.String(64), nullable=True)
    client_hint = db.Column(db.String(120), nullable=True)
    url_hint = db.Column(db.String(512), nullable=True)
    logs = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(32), default='open', nullable=False)  # open|resolved|closed
    github_issue_number = db.Column(db.Integer, nullable=True)
    github_issue_url = db.Column(db.String(512), nullable=True)
    github_sync = db.Column(db.String(32), default='pending', nullable=False)  # pending|synced|skipped|error
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    resolved_at = db.Column(db.DateTime, nullable=True)
    resolved_by_user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)

    def to_dict(self, *, compact: bool = False):
        body = self.body or ''
        logs = self.logs or ''
        payload = {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'body': body,
            'area': self.area,
            'severity': self.severity,
            'role_at_submit': self.role_at_submit,
            'deploy_hint': self.deploy_hint,
            'client_hint': self.client_hint,
            'url_hint': self.url_hint,
            'logs': logs or None,
            'has_logs': bool(logs.strip()),
            'status': self.status,
            'github_issue_number': self.github_issue_number,
            'github_issue_url': self.github_issue_url,
            'github_sync': self.github_sync,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
            'resolved_by_user_id': self.resolved_by_user_id,
        }
        if compact:
            # List/inbox cards: short symptom, no log blob.
            payload['body'] = body[:280]
            payload['body_truncated'] = len(body) > 280
            payload['body_preview'] = payload['body']
            payload['logs'] = None
        return payload


class StoreAccount(db.Model):
    """Linked external store account for register-only ownership sync (no downloads)."""

    __tablename__ = 'store_accounts'
    __table_args__ = (
        db.UniqueConstraint('user_id', 'store', name='uq_store_account_user_store'),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey('users.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    store = db.Column(db.String(16), nullable=False)  # steam|gog|epic|amazon|playnite
    external_account_id = db.Column(db.String(64), nullable=True)
    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = db.relationship(
        'User',
        backref=db.backref('store_accounts', lazy='dynamic', cascade='all, delete-orphan'),
    )

    def to_dict(self):
        return {
            'store': self.store,
            'external_account_id': self.external_account_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class UserOwnedTitle(db.Model):
    """
    Register-only record of a title the user owns on an external store.
    Never triggers downloads or DRM retrieval — used for browse badge matching only.
    """

    __tablename__ = 'user_owned_titles'
    __table_args__ = (
        db.UniqueConstraint(
            'user_id', 'store', 'external_app_id',
            name='uq_user_owned_title',
        ),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey('users.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    store = db.Column(db.String(16), nullable=False)
    external_app_id = db.Column(db.String(32), nullable=False)
    name = db.Column(db.String(255), nullable=True)
    matched_game_uuid = db.Column(
        db.String(36),
        db.ForeignKey('games.uuid', ondelete='SET NULL'),
        nullable=True,
        index=True,
    )
    last_synced_at = db.Column(db.DateTime, nullable=True)

    user = db.relationship(
        'User',
        backref=db.backref('owned_titles', lazy='dynamic', cascade='all, delete-orphan'),
    )
    matched_game = db.relationship('Game')

    def to_dict(self):
        return {
            'store': self.store,
            'external_app_id': self.external_app_id,
            'name': self.name,
            'matched_game_uuid': self.matched_game_uuid,
            'last_synced_at': (
                self.last_synced_at.isoformat() if self.last_synced_at else None
            ),
        }


class AllowedFileType(db.Model):
    __tablename__ = 'allowed_file_types'
    
    id = db.Column(db.Integer, primary_key=True)
    value = db.Column(db.String(10), unique=True, nullable=False)

    def __repr__(self):
        return f'<AllowedFileType {self.value}>'

class IgnoredFileType(db.Model):
    __tablename__ = 'ignored_file_types'
    
    id = db.Column(db.Integer, primary_key=True)
    value = db.Column(db.String(10), unique=True, nullable=False)

    def __repr__(self):
        return f'<IgnoredFileType {self.value}>'

class SystemEvents(db.Model):
    __tablename__ = 'system_events'
    
    id = db.Column(db.Integer, primary_key=True)
    event_type = db.Column(db.String(32), default='log')
    event_text = db.Column(db.String(256), nullable=False)
    event_level = db.Column(db.String(32), default='information')
    audit_user = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    
    user = db.relationship('User', backref='system_events')

    def __repr__(self):
        return f"<SystemEvent {self.event_type}: {self.event_text}>"


# Helper function for game completion status
def get_status_info(status):
    """
    Returns icon and color information for game completion status

    Args:
        status: str - One of 'unplayed', 'unfinished', 'beaten', 'completed', 'null', or None

    Returns:
        dict with 'icon', 'color', 'label' keys
    """
    status_map = {
        'unplayed': {
            'icon': 'fa-box',
            'color': '#808080',  # gray
            'label': 'Unplayed'
        },
        'unfinished': {
            'icon': 'fa-gamepad',
            'color': '#4A90E2',  # blue
            'label': 'Unfinished'
        },
        'beaten': {
            'icon': 'fa-flag-checkered',
            'color': '#50C878',  # green
            'label': 'Beaten'
        },
        'completed': {
            'icon': 'fa-trophy',
            'color': '#FFD700',  # gold
            'label': 'Completed'
        },
        'null': {
            'icon': 'fa-ban',
            'color': '#DC3545',  # red
            'label': "Won't Play"
        }
    }

    # Return empty icon for no status
    if not status:
        return {
            'icon': 'fa-circle',
            'color': '#808080',
            'label': 'No Status',
            'empty': True
        }

    return status_map.get(status, status_map['unplayed'])
