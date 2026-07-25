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
    __tablename__ = 'images'

    id = db.Column(db.Integer, primary_key=True)
    game_uuid = db.Column(db.String(36), db.ForeignKey('games.uuid'), nullable=False)
    image_type = db.Column(db.String, nullable=False)
    url = db.Column(db.String, nullable=False)
    igdb_image_id = db.Column(db.String, nullable=True)  # IGDB image ID for reference
    download_url = db.Column(db.String, nullable=True)  # Full IGDB URL to download from
    is_downloaded = db.Column(db.Boolean, default=False, nullable=False)  # Download status
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f"<Image id={self.id}, game_uuid={self.game_uuid}, image_type={self.image_type}, url={self.url}, downloaded={self.is_downloaded}>"

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
    status = db.Column(db.Enum('Scheduled', 'Running', 'Stopping', 'Completed', 'Failed', 'Cancelled', name='status_enum'))
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


class UserPreference(db.Model):
    __tablename__ = 'user_preferences'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey('users.id', ondelete='CASCADE'),
        nullable=False
    )
    items_per_page = db.Column(db.Integer, default=20)
    default_sort = db.Column(db.String(50), default='name')
    default_sort_order = db.Column(db.String(4), default='asc')
    theme = db.Column(db.String(50), default='default')
    locale = db.Column(db.String(10), default='en')
    tile_size = db.Column(db.String(4), default='M', nullable=False)
    
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
    discord_webhook_url = db.Column(db.String(512), nullable=True)
    # SMTP Settings
    smtp_server = db.Column(db.String(255), nullable=True)
    smtp_port = db.Column(db.Integer, nullable=True)
    smtp_username = db.Column(db.String(255), nullable=True)
    smtp_password = db.Column(db.String(255), nullable=True)
    smtp_use_tls = db.Column(db.Boolean, default=True)
    smtp_default_sender = db.Column(db.String(255), nullable=True)
    smtp_last_tested = db.Column(db.DateTime, nullable=True)
    smtp_enabled = db.Column(db.Boolean, default=False)
    discord_bot_name = db.Column(db.String(100), nullable=True)
    discord_bot_avatar_url = db.Column(db.String(512), nullable=True)
    enable_delete_game_on_disk = db.Column(db.Boolean, default=True)
    # IGDB Settings
    igdb_client_id = db.Column(db.String(255), nullable=True)
    igdb_client_secret = db.Column(db.String(255), nullable=True)
    igdb_last_tested = db.Column(db.DateTime, nullable=True)
    enable_game_updates = db.Column(db.Boolean, default=False)
    update_folder_name = db.Column(db.String(255), default='updates')
    enable_game_extras = db.Column(db.Boolean, default=False)
    extras_folder_name = db.Column(db.String(255), default='extras')
    discord_notify_new_games = db.Column(db.Boolean, default=False)
    discord_notify_game_updates = db.Column(db.Boolean, default=False)
    discord_notify_game_extras = db.Column(db.Boolean, default=False)
    discord_notify_downloads = db.Column(db.Boolean, default=False)
    discord_notify_manual_trigger = db.Column(db.Boolean, default=False)
    site_url = db.Column(db.String(255), default='http://127.0.0.1')
    # Image Download Settings
    use_turbo_image_downloads = db.Column(db.Boolean, default=True)
    turbo_download_threads = db.Column(db.Integer, default=8)
    turbo_download_batch_size = db.Column(db.Integer, default=200)
    # Scan Thread Settings  
    scan_thread_count = db.Column(db.Integer, default=4)
    # Setup State Tracking
    setup_in_progress = db.Column(db.Boolean, default=False)
    setup_current_step = db.Column(db.Integer, default=1)
    setup_completed = db.Column(db.Boolean, default=False)
    # Attract Mode Settings
    attract_mode_enabled = db.Column(db.Boolean, default=False)
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
    enable_arr_module = db.Column(db.Boolean, default=False)
    arr_settings = db.Column(JSONEncodedDict, nullable=True)
    # Opt-in WebRetro / companion save-state sync
    enable_emulator_save_sync = db.Column(db.Boolean, default=True)
    encrypt_emulator_saves = db.Column(db.Boolean, default=False)
    # GiantBomb metadata key (optional)
    giantbomb_api_key = db.Column(db.String(255), nullable=True)
    # Preferred release groups / size bands for *arr scoring
    quality_profiles = db.Column(JSONEncodedDict, nullable=True)
    # Game details section order/visibility
    detail_layout = db.Column(JSONEncodedDict, nullable=True)
    # Optional Ollama AI assist
    enable_ai_assist = db.Column(db.Boolean, default=False)
    ollama_base_url = db.Column(db.String(512), nullable=True)
    ollama_model = db.Column(db.String(120), nullable=True)

    def __repr__(self):
        return f'<GlobalSettings id={self.id}, last_updated={self.last_updated}>'

class DiscoverySection(db.Model):
    __tablename__ = 'discovery_sections'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    identifier = db.Column(db.String(50), unique=True, nullable=False)
    is_visible = db.Column(db.Boolean, default=True)
    display_order = db.Column(db.Integer, default=0)
    
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
        return {
            'id': self.id,
            'collection_id': self.collection_id,
            'game_uuid': self.game_uuid,
            'game_name': self.game.name if self.game else None,
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
        return {
            'id': self.id,
            'title': self.title,
            'body': self.body,
            'published': self.published,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'author_user_id': self.author_user_id,
        }


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
