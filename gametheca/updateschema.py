from sqlalchemy import create_engine, text
from config import Config

class DatabaseManager:
    def __init__(self):
        # Load the database configuration from Config
        self.database_uri = Config.SQLALCHEMY_DATABASE_URI
        # Create a SQLAlchemy engine
        self.engine = create_engine(self.database_uri)

    def add_column_if_not_exists(self):

        # SQL commands to add new columns and tables
        add_columns_sql = """
        -- Ensure global_settings table exists before altering it
        CREATE TABLE IF NOT EXISTS global_settings (
            id SERIAL PRIMARY KEY,
            settings TEXT,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            smtp_server VARCHAR(255),
            smtp_port INTEGER,
            smtp_username VARCHAR(255),
            smtp_password VARCHAR(255),
            smtp_use_tls BOOLEAN DEFAULT TRUE,
            smtp_default_sender VARCHAR(255),
            smtp_last_tested TIMESTAMP,
            smtp_enabled BOOLEAN DEFAULT FALSE,
            enable_delete_game_on_disk BOOLEAN DEFAULT TRUE,
            igdb_client_id VARCHAR(255),
            igdb_client_secret VARCHAR(255),
            igdb_last_tested TIMESTAMP
        );
        
        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS site_url VARCHAR(255) DEFAULT 'http://127.0.0.1:5006';

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS igdb_client_id VARCHAR(255);

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS igdb_client_secret VARCHAR(255);

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS igdb_last_tested TIMESTAMP;

        -- Create allowed_file_types table if it doesn't exist
        CREATE TABLE IF NOT EXISTS allowed_file_types (
            id SERIAL PRIMARY KEY,
            value VARCHAR(10) UNIQUE NOT NULL
        );

        -- Create user_favorites table if it doesn't exist
        CREATE TABLE IF NOT EXISTS user_favorites (
            user_id INTEGER REFERENCES users(id),
            game_uuid VARCHAR(36) REFERENCES games(uuid),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, game_uuid)
        );

        -- Create user_game_status table if it doesn't exist
        CREATE TABLE IF NOT EXISTS user_game_status (
            user_id INTEGER REFERENCES users(id),
            game_uuid VARCHAR(36) REFERENCES games(uuid),
            status VARCHAR(20) NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, game_uuid)
        );

        -- Create index on user_game_status for performance
        CREATE INDEX IF NOT EXISTS idx_user_game_status_lookup ON user_game_status(user_id, game_uuid);

        CREATE TABLE IF NOT EXISTS game_updates (
            id SERIAL PRIMARY KEY,
            uuid VARCHAR(36) UNIQUE NOT NULL,
            game_uuid VARCHAR(36) NOT NULL,
            times_downloaded INTEGER DEFAULT 0,
            nfo_content TEXT,
            file_path VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (game_uuid) REFERENCES games(uuid) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS game_extras (
            id SERIAL PRIMARY KEY,
            uuid VARCHAR(36) UNIQUE NOT NULL,
            game_uuid VARCHAR(36) NOT NULL,
            times_downloaded INTEGER DEFAULT 0,
            nfo_content TEXT,
            file_path VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (game_uuid) REFERENCES games(uuid) ON DELETE CASCADE
        );

        -- Create system_events table if it doesn't exist
        CREATE TABLE IF NOT EXISTS system_events (
            id SERIAL PRIMARY KEY,
            event_type VARCHAR(32) DEFAULT 'log',
            event_text VARCHAR(256) NOT NULL,
            event_level VARCHAR(32) DEFAULT 'information',
            audit_user INTEGER REFERENCES users(id),
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Ensure scan_jobs table exists before altering it
        CREATE TABLE IF NOT EXISTS scan_jobs (
            id SERIAL PRIMARY KEY,
            status VARCHAR(20),
            error_message TEXT,
            is_enabled BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        ALTER TABLE scan_jobs
        ADD COLUMN IF NOT EXISTS removed_count INTEGER DEFAULT 0;

        -- Ensure images table exists before altering it
        CREATE TABLE IF NOT EXISTS images (
            id SERIAL PRIMARY KEY,
            game_uuid VARCHAR(36),
            image_type VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Add new columns to images table for optimized image downloading
        ALTER TABLE images
        ADD COLUMN IF NOT EXISTS igdb_image_id VARCHAR(255);

        ALTER TABLE images
        ADD COLUMN IF NOT EXISTS download_url VARCHAR(500);

        ALTER TABLE images
        ADD COLUMN IF NOT EXISTS is_downloaded BOOLEAN DEFAULT FALSE;

        -- Surface image download failures in the admin Image Queue (Wave 2)
        ALTER TABLE images
        ADD COLUMN IF NOT EXISTS last_error VARCHAR(500);

        ALTER TABLE images
        ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMP;

        -- Add image download settings to global_settings table
        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS use_turbo_image_downloads BOOLEAN DEFAULT TRUE;

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS turbo_download_threads INTEGER DEFAULT 4;

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS turbo_download_batch_size INTEGER DEFAULT 100;

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS scan_thread_count INTEGER DEFAULT 1;

        -- Add setup state tracking columns to global_settings table
        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS setup_in_progress BOOLEAN DEFAULT FALSE;

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS setup_current_step INTEGER DEFAULT 1;

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN DEFAULT FALSE;

        -- Add setting_download_missing_images column to scan_jobs table
        ALTER TABLE scan_jobs
        ADD COLUMN IF NOT EXISTS setting_download_missing_images BOOLEAN DEFAULT FALSE;

        -- Change error_message column from varchar(512) to text for longer error messages
        ALTER TABLE scan_jobs
        ALTER COLUMN error_message TYPE TEXT;

        -- Add progress tracking columns to scan_jobs table for scan optimization
        ALTER TABLE scan_jobs
        ADD COLUMN IF NOT EXISTS current_processing VARCHAR(255);

        ALTER TABLE scan_jobs
        ADD COLUMN IF NOT EXISTS last_progress_update TIMESTAMP;

        -- Add force_updates_extras setting to scan_jobs table for enhanced scan functionality
        ALTER TABLE scan_jobs
        ADD COLUMN IF NOT EXISTS setting_force_updates_extras BOOLEAN DEFAULT FALSE;

        -- Add 'Cancelled' value to the status_enum for scan_jobs
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Cancelled' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'status_enum')) THEN
                ALTER TYPE status_enum ADD VALUE 'Cancelled';
            END IF;
        END $$;

        -- Add 'Stopping' value to the status_enum for scan_jobs
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Stopping' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'status_enum')) THEN
                ALTER TYPE status_enum ADD VALUE 'Stopping';
            END IF;
        END $$;

        -- Add 'Queued' value for FIFO scan requests while another job is Running
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'Queued' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'status_enum')) THEN
                ALTER TYPE status_enum ADD VALUE 'Queued';
            END IF;
        END $$;

        -- Add unique index to prevent duplicate cover images (but allow multiple screenshots)
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE c.relname = 'unique_game_cover_image' AND n.nspname = 'public'
            ) THEN
                CREATE UNIQUE INDEX unique_game_cover_image 
                ON images (game_uuid) 
                WHERE image_type = 'cover';
            END IF;
        END $$;

        -- Rename columns in filters table from old release group terminology to scanning filter terminology
        DO $$
        BEGIN
            -- Rename rlsgroup to filter_pattern if the old column exists
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='filters' AND column_name='rlsgroup'
            ) THEN
                ALTER TABLE filters RENAME COLUMN rlsgroup TO filter_pattern;
                RAISE NOTICE 'Renamed column rlsgroup to filter_pattern in filters table';
            END IF;

            -- Rename rlsgroupcs to case_sensitive if the old column exists
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='filters' AND column_name='rlsgroupcs'
            ) THEN
                ALTER TABLE filters RENAME COLUMN rlsgroupcs TO case_sensitive;
                RAISE NOTICE 'Renamed column rlsgroupcs to case_sensitive in filters table';
            END IF;
        END $$;

        -- Add attract mode settings to global_settings table
        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS attract_mode_enabled BOOLEAN DEFAULT FALSE;

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS attract_mode_idle_timeout INTEGER DEFAULT 60;

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS attract_mode_settings TEXT;

        -- Create user_attract_mode_settings table if it doesn't exist
        CREATE TABLE IF NOT EXISTS user_attract_mode_settings (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(36) UNIQUE NOT NULL,
            has_customized BOOLEAN DEFAULT FALSE,
            filter_settings TEXT,
            autoplay_settings TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
        );

        -- Add HowLongToBeat integration fields to games table
        ALTER TABLE games
        ADD COLUMN IF NOT EXISTS hltb_id INTEGER;

        ALTER TABLE games
        ADD COLUMN IF NOT EXISTS hltb_main_story FLOAT;

        ALTER TABLE games
        ADD COLUMN IF NOT EXISTS hltb_main_extra FLOAT;

        ALTER TABLE games
        ADD COLUMN IF NOT EXISTS hltb_completionist FLOAT;

        ALTER TABLE games
        ADD COLUMN IF NOT EXISTS hltb_all_styles FLOAT;

        ALTER TABLE games
        ADD COLUMN IF NOT EXISTS hltb_last_updated TIMESTAMP;

        -- Add HowLongToBeat settings to global_settings table
        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS enable_hltb_integration BOOLEAN DEFAULT TRUE;

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS hltb_rate_limit_delay FLOAT DEFAULT 2.0;

        -- Add Local Metadata & Image Override settings to global_settings table
        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS use_local_metadata BOOLEAN DEFAULT FALSE;

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS write_local_metadata BOOLEAN DEFAULT FALSE;

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS use_local_images BOOLEAN DEFAULT FALSE;

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS local_metadata_filename VARCHAR(50) DEFAULT 'gametheca.json';

        -- Add Propose-Only Scan setting to global_settings table
        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS propose_only_scan BOOLEAN DEFAULT FALSE;

        -- Game freshness (local vs store version / DLC)
        ALTER TABLE games
        ADD COLUMN IF NOT EXISTS steam_app_id INTEGER;

        ALTER TABLE games
        ADD COLUMN IF NOT EXISTS local_version VARCHAR(100);

        ALTER TABLE games
        ADD COLUMN IF NOT EXISTS remote_version_summary VARCHAR(255);

        ALTER TABLE games
        ADD COLUMN IF NOT EXISTS freshness_status VARCHAR(32);

        ALTER TABLE games
        ADD COLUMN IF NOT EXISTS freshness_confidence VARCHAR(16);

        ALTER TABLE games
        ADD COLUMN IF NOT EXISTS freshness_checked_at TIMESTAMP;

        ALTER TABLE games
        ADD COLUMN IF NOT EXISTS freshness_payload JSONB;

        -- Library scan depth + last scan folder
        ALTER TABLE libraries
        ADD COLUMN IF NOT EXISTS scan_depth INTEGER DEFAULT 1;

        ALTER TABLE libraries
        ADD COLUMN IF NOT EXISTS last_scan_folder VARCHAR(512);

        -- Parental / child library allow-list
        CREATE TABLE IF NOT EXISTS user_library_access (
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            library_uuid VARCHAR(36) NOT NULL REFERENCES libraries(uuid) ON DELETE CASCADE,
            PRIMARY KEY (user_id, library_uuid)
        );
        CREATE INDEX IF NOT EXISTS ix_user_library_access_user_id ON user_library_access(user_id);
        CREATE INDEX IF NOT EXISTS ix_user_library_access_library_uuid ON user_library_access(library_uuid);

        -- Parental / child genre & theme deny-list
        CREATE TABLE IF NOT EXISTS user_content_filters (
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            filter_type VARCHAR(16) NOT NULL,
            name VARCHAR(50) NOT NULL,
            PRIMARY KEY (user_id, filter_type, name)
        );
        CREATE INDEX IF NOT EXISTS ix_user_content_filters_user_id ON user_content_filters(user_id);

        -- Personal API tokens for OpenAPI / companion clients
        CREATE TABLE IF NOT EXISTS api_tokens (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            token_prefix VARCHAR(16) NOT NULL,
            token_hash VARCHAR(255) NOT NULL,
            scopes JSONB NOT NULL DEFAULT '[]',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_used_at TIMESTAMP,
            revoked_at TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS ix_api_tokens_user_id ON api_tokens(user_id);
        CREATE INDEX IF NOT EXISTS ix_api_tokens_token_prefix ON api_tokens(token_prefix);

        -- Companion client heartbeat presence
        CREATE TABLE IF NOT EXISTS client_devices (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            device_id VARCHAR(64) NOT NULL,
            device_kind VARCHAR(16) NOT NULL DEFAULT 'companion',
            device_name VARCHAR(128),
            client_version VARCHAR(64),
            user_agent VARCHAR(512),
            last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT uq_client_devices_user_device UNIQUE (user_id, device_id)
        );
        CREATE INDEX IF NOT EXISTS ix_client_devices_user_id ON client_devices(user_id);
        CREATE INDEX IF NOT EXISTS ix_client_devices_last_seen_at ON client_devices(last_seen_at);

        -- Playtime sessions + aggregates
        CREATE TABLE IF NOT EXISTS play_sessions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            game_uuid VARCHAR(36) NOT NULL REFERENCES games(uuid) ON DELETE CASCADE,
            started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_heartbeat_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            ended_at TIMESTAMP,
            duration_seconds INTEGER NOT NULL DEFAULT 0,
            client VARCHAR(64),
            status VARCHAR(16) NOT NULL DEFAULT 'active'
        );
        CREATE INDEX IF NOT EXISTS ix_play_sessions_user_id ON play_sessions(user_id);
        CREATE INDEX IF NOT EXISTS ix_play_sessions_game_uuid ON play_sessions(game_uuid);

        CREATE TABLE IF NOT EXISTS user_game_progress (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            game_uuid VARCHAR(36) NOT NULL REFERENCES games(uuid) ON DELETE CASCADE,
            total_seconds INTEGER NOT NULL DEFAULT 0,
            session_count INTEGER NOT NULL DEFAULT 0,
            last_played_at TIMESTAMP,
            CONSTRAINT uq_user_game_progress UNIQUE (user_id, game_uuid)
        );
        CREATE INDEX IF NOT EXISTS ix_user_game_progress_user_id ON user_game_progress(user_id);
        CREATE INDEX IF NOT EXISTS ix_user_game_progress_game_uuid ON user_game_progress(game_uuid);

        -- Collections + announcements
        CREATE TABLE IF NOT EXISTS game_collections (
            id SERIAL PRIMARY KEY,
            uuid VARCHAR(36) UNIQUE NOT NULL,
            name VARCHAR(120) NOT NULL,
            description TEXT,
            owner_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            is_public BOOLEAN NOT NULL DEFAULT TRUE,
            is_system BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS game_collection_items (
            id SERIAL PRIMARY KEY,
            collection_id INTEGER NOT NULL REFERENCES game_collections(id) ON DELETE CASCADE,
            game_uuid VARCHAR(36) NOT NULL REFERENCES games(uuid) ON DELETE CASCADE,
            position INTEGER NOT NULL DEFAULT 0,
            CONSTRAINT uq_collection_game UNIQUE (collection_id, game_uuid)
        );

        CREATE TABLE IF NOT EXISTS announcements (
            id SERIAL PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            body TEXT NOT NULL,
            published BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS game_requests (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            notes TEXT,
            status VARCHAR(32) NOT NULL DEFAULT 'pending',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            resolved_at TIMESTAMP,
            resolved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            linked_game_uuid VARCHAR(36) REFERENCES games(uuid) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS ix_game_requests_user_id ON game_requests(user_id);

        -- Remove unused library_name column from games table (replaced by library relationship via library_uuid)
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='games' AND column_name='library_name'
            ) THEN
                ALTER TABLE games DROP COLUMN library_name;
                RAISE NOTICE 'Dropped unused library_name column from games table';
            END IF;
        END $$;

        -- OIDC / SSO settings (global_settings)
        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS oidc_enabled BOOLEAN DEFAULT FALSE;

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS oidc_issuer_url VARCHAR(512);

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS oidc_client_id VARCHAR(255);

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS oidc_client_secret VARCHAR(512);

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS oidc_redirect_uri VARCHAR(512);

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS oidc_scopes VARCHAR(255) DEFAULT 'openid email profile';

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS oidc_role_claim VARCHAR(64) DEFAULT 'groups';

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS oidc_role_map TEXT;

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS oidc_display_name VARCHAR(120) DEFAULT 'Sign in with SSO';

        -- Store ownership sync (register-only; no store downloads)
        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS enable_store_ownership_sync BOOLEAN DEFAULT TRUE;

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS steam_web_api_key VARCHAR(255);

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS steamgriddb_api_key VARCHAR(255);

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS emulator_profiles TEXT;

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS enable_arr_module BOOLEAN DEFAULT TRUE;

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS enable_emulator_save_sync BOOLEAN DEFAULT TRUE;

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS arr_settings TEXT;

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS encrypt_emulator_saves BOOLEAN DEFAULT FALSE;

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS giantbomb_api_key VARCHAR(255);

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS mobygames_api_key VARCHAR(255);

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS thegamesdb_api_key VARCHAR(255);

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS quality_profiles TEXT;

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS detail_layout TEXT;

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS enable_ai_assist BOOLEAN DEFAULT TRUE;

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS enable_malware_scan BOOLEAN DEFAULT TRUE;

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS ollama_base_url VARCHAR(512);

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS ollama_model VARCHAR(120);

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS community_chat_url VARCHAR(512);

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS community_chat_label VARCHAR(120);

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS enable_remote_play BOOLEAN DEFAULT FALSE;

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS remote_play_settings TEXT;

        ALTER TABLE user_preferences
        ADD COLUMN IF NOT EXISTS locale VARCHAR(10) DEFAULT 'en';

        -- Custom discovery zones (manual game list or library/platform/genre filter)
        ALTER TABLE discovery_sections
        ADD COLUMN IF NOT EXISTS section_type VARCHAR(20) DEFAULT 'seed';

        ALTER TABLE discovery_sections
        ADD COLUMN IF NOT EXISTS config TEXT;

        UPDATE discovery_sections SET section_type = 'seed' WHERE section_type IS NULL;

        ALTER TABLE user_preferences
        ADD COLUMN IF NOT EXISTS tile_size VARCHAR(8) DEFAULT '50';

        ALTER TABLE user_preferences
        ALTER COLUMN tile_size TYPE VARCHAR(8);

        UPDATE user_preferences SET tile_size = '25' WHERE tile_size = 'S';
        UPDATE user_preferences SET tile_size = '50' WHERE tile_size = 'M' OR tile_size IS NULL OR tile_size = '';
        UPDATE user_preferences SET tile_size = '75' WHERE tile_size = 'L';
        UPDATE user_preferences SET tile_size = '100' WHERE tile_size = 'XL';

        ALTER TABLE user_preferences
        ADD COLUMN IF NOT EXISTS icon_pack VARCHAR(50) DEFAULT 'outline';

        CREATE TABLE IF NOT EXISTS emulator_saves (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            game_uuid VARCHAR(36) NOT NULL REFERENCES games(uuid) ON DELETE CASCADE,
            slot_name VARCHAR(64) NOT NULL DEFAULT 'slot1',
            filename VARCHAR(255) NOT NULL,
            size_bytes INTEGER NOT NULL DEFAULT 0,
            storage_path VARCHAR(1024) NOT NULL,
            encrypted BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT uq_emulator_save_slot UNIQUE (user_id, game_uuid, slot_name)
        );

        ALTER TABLE emulator_saves
        ADD COLUMN IF NOT EXISTS encrypted BOOLEAN DEFAULT FALSE;
        CREATE INDEX IF NOT EXISTS ix_emulator_saves_user_id ON emulator_saves(user_id);
        CREATE INDEX IF NOT EXISTS ix_emulator_saves_game_uuid ON emulator_saves(game_uuid);

        CREATE TABLE IF NOT EXISTS user_friendships (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            friend_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status VARCHAR(16) NOT NULL DEFAULT 'pending',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT uq_user_friendship UNIQUE (user_id, friend_user_id)
        );
        CREATE INDEX IF NOT EXISTS ix_user_friendships_user_id ON user_friendships(user_id);
        CREATE INDEX IF NOT EXISTS ix_user_friendships_friend_user_id ON user_friendships(friend_user_id);

        CREATE TABLE IF NOT EXISTS store_accounts (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            store VARCHAR(16) NOT NULL,
            external_account_id VARCHAR(64),
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT uq_store_account_user_store UNIQUE (user_id, store)
        );
        CREATE INDEX IF NOT EXISTS ix_store_accounts_user_id ON store_accounts(user_id);

        CREATE TABLE IF NOT EXISTS user_owned_titles (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            store VARCHAR(16) NOT NULL,
            external_app_id VARCHAR(32) NOT NULL,
            name VARCHAR(255),
            matched_game_uuid VARCHAR(36) REFERENCES games(uuid) ON DELETE SET NULL,
            last_synced_at TIMESTAMP,
            CONSTRAINT uq_user_owned_title UNIQUE (user_id, store, external_app_id)
        );
        CREATE INDEX IF NOT EXISTS ix_user_owned_titles_user_id ON user_owned_titles(user_id);
        CREATE INDEX IF NOT EXISTS ix_user_owned_titles_matched_game_uuid ON user_owned_titles(matched_game_uuid);

        ALTER TABLE user_preferences
        ADD COLUMN IF NOT EXISTS notify_friend_requests BOOLEAN DEFAULT TRUE;
        ALTER TABLE user_preferences
        ADD COLUMN IF NOT EXISTS notify_activity BOOLEAN DEFAULT TRUE;
        ALTER TABLE user_preferences
        ADD COLUMN IF NOT EXISTS notify_mentions BOOLEAN DEFAULT TRUE;
        ALTER TABLE user_preferences
        ADD COLUMN IF NOT EXISTS notify_chat BOOLEAN DEFAULT TRUE;

        CREATE TABLE IF NOT EXISTS user_notifications (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            kind VARCHAR(32) NOT NULL DEFAULT 'info',
            title VARCHAR(200) NOT NULL,
            body VARCHAR(500),
            link VARCHAR(512),
            actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            payload TEXT,
            read_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS ix_user_notifications_user_id ON user_notifications(user_id);

        CREATE TABLE IF NOT EXISTS chat_channels (
            id SERIAL PRIMARY KEY,
            kind VARCHAR(16) NOT NULL DEFAULT 'channel',
            name VARCHAR(120) NOT NULL,
            slug VARCHAR(64) UNIQUE,
            is_child_safe BOOLEAN NOT NULL DEFAULT TRUE,
            created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS chat_channel_members (
            id SERIAL PRIMARY KEY,
            channel_id INTEGER NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            last_read_message_id INTEGER,
            muted BOOLEAN NOT NULL DEFAULT FALSE,
            joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT uq_chat_channel_member UNIQUE (channel_id, user_id)
        );
        CREATE INDEX IF NOT EXISTS ix_chat_channel_members_channel_id ON chat_channel_members(channel_id);
        CREATE INDEX IF NOT EXISTS ix_chat_channel_members_user_id ON chat_channel_members(user_id);

        CREATE TABLE IF NOT EXISTS chat_messages (
            id SERIAL PRIMARY KEY,
            channel_id INTEGER NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            body TEXT NOT NULL,
            parent_message_id INTEGER REFERENCES chat_messages(id) ON DELETE SET NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS ix_chat_messages_channel_id ON chat_messages(channel_id);
        CREATE INDEX IF NOT EXISTS ix_chat_messages_user_id ON chat_messages(user_id);
        ALTER TABLE chat_messages
        ADD COLUMN IF NOT EXISTS parent_message_id INTEGER REFERENCES chat_messages(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS ix_chat_messages_parent_message_id ON chat_messages(parent_message_id);

        CREATE TABLE IF NOT EXISTS chat_message_reactions (
            id SERIAL PRIMARY KEY,
            message_id INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            emoji VARCHAR(32) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT uq_chat_message_reaction UNIQUE (message_id, user_id, emoji)
        );
        CREATE INDEX IF NOT EXISTS ix_chat_message_reactions_message_id ON chat_message_reactions(message_id);
        CREATE INDEX IF NOT EXISTS ix_chat_message_reactions_user_id ON chat_message_reactions(user_id);

        ALTER TABLE user_preferences
        ADD COLUMN IF NOT EXISTS notify_support BOOLEAN DEFAULT TRUE;

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS admin_notify_new_games BOOLEAN DEFAULT TRUE;
        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS admin_notify_game_updates BOOLEAN DEFAULT FALSE;
        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS admin_notify_game_extras BOOLEAN DEFAULT FALSE;
        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS admin_notify_downloads BOOLEAN DEFAULT FALSE;
        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS admin_notify_support BOOLEAN DEFAULT TRUE;

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS loading_icon_mode VARCHAR(16) DEFAULT 'rotate';

        ALTER TABLE global_settings
        ADD COLUMN IF NOT EXISTS loading_icon_id VARCHAR(64);

        CREATE TABLE IF NOT EXISTS support_tickets (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(200) NOT NULL,
            body TEXT NOT NULL,
            area VARCHAR(64),
            severity VARCHAR(8) NOT NULL DEFAULT 'P2',
            role_at_submit VARCHAR(32),
            deploy_hint VARCHAR(64),
            client_hint VARCHAR(120),
            url_hint VARCHAR(512),
            logs TEXT,
            status VARCHAR(32) NOT NULL DEFAULT 'open',
            github_issue_number INTEGER,
            github_issue_url VARCHAR(512),
            github_sync VARCHAR(32) NOT NULL DEFAULT 'pending',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            resolved_at TIMESTAMP,
            resolved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS ix_support_tickets_user_id ON support_tickets(user_id);

        ALTER TABLE user_preferences
        ADD COLUMN IF NOT EXISTS notify_free_games BOOLEAN DEFAULT TRUE;
        ALTER TABLE user_preferences
        ADD COLUMN IF NOT EXISTS email_notify_social BOOLEAN DEFAULT FALSE;
        ALTER TABLE user_preferences
        ADD COLUMN IF NOT EXISTS email_digest_daily BOOLEAN DEFAULT FALSE;
        ALTER TABLE user_preferences
        ADD COLUMN IF NOT EXISTS email_digest_last_sent_at TIMESTAMP;

        CREATE TABLE IF NOT EXISTS free_game_offers (
            id SERIAL PRIMARY KEY,
            store VARCHAR(16) NOT NULL,
            external_id VARCHAR(64) NOT NULL,
            title VARCHAR(255) NOT NULL,
            description VARCHAR(500),
            image_url VARCHAR(1024),
            claim_url VARCHAR(1024),
            store_url VARCHAR(1024),
            worth VARCHAR(64),
            starts_at TIMESTAMP,
            ends_at TIMESTAMP,
            source VARCHAR(32) NOT NULL DEFAULT 'gamerpower',
            active BOOLEAN NOT NULL DEFAULT TRUE,
            first_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT uq_free_game_offer_store_ext UNIQUE (store, external_id)
        );
        CREATE INDEX IF NOT EXISTS ix_free_game_offers_store ON free_game_offers(store);
        CREATE INDEX IF NOT EXISTS ix_free_game_offers_source ON free_game_offers(source);
        CREATE INDEX IF NOT EXISTS ix_free_game_offers_active ON free_game_offers(active);

        -- Wave 19: new LibraryPlatform enum labels (SQLAlchemy type: libraryplatform)
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'libraryplatform') THEN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_enum
                    WHERE enumlabel = 'WII'
                      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'libraryplatform')
                ) THEN
                    ALTER TYPE libraryplatform ADD VALUE 'WII';
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM pg_enum
                    WHERE enumlabel = 'N3DS'
                      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'libraryplatform')
                ) THEN
                    ALTER TYPE libraryplatform ADD VALUE 'N3DS';
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM pg_enum
                    WHERE enumlabel = 'SEGA_DC'
                      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'libraryplatform')
                ) THEN
                    ALTER TYPE libraryplatform ADD VALUE 'SEGA_DC';
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM pg_enum
                    WHERE enumlabel = 'PSVITA'
                      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'libraryplatform')
                ) THEN
                    ALTER TYPE libraryplatform ADD VALUE 'PSVITA';
                END IF;
                -- LOCKED console leaf enums (NEOGEO / PSP / SWITCH / ARCADE)
                IF NOT EXISTS (
                    SELECT 1 FROM pg_enum
                    WHERE enumlabel = 'PSP'
                      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'libraryplatform')
                ) THEN
                    ALTER TYPE libraryplatform ADD VALUE 'PSP';
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM pg_enum
                    WHERE enumlabel = 'NEOGEO'
                      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'libraryplatform')
                ) THEN
                    ALTER TYPE libraryplatform ADD VALUE 'NEOGEO';
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM pg_enum
                    WHERE enumlabel = 'SWITCH'
                      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'libraryplatform')
                ) THEN
                    ALTER TYPE libraryplatform ADD VALUE 'SWITCH';
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM pg_enum
                    WHERE enumlabel = 'ARCADE'
                      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'libraryplatform')
                ) THEN
                    ALTER TYPE libraryplatform ADD VALUE 'ARCADE';
                END IF;
            END IF;
        END $$;

        CREATE TABLE IF NOT EXISTS custom_emoji (
            id SERIAL PRIMARY KEY,
            slug VARCHAR(24) NOT NULL UNIQUE,
            label VARCHAR(64) NOT NULL,
            file_name VARCHAR(80) NOT NULL,
            uploaded_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        -- Wave 16 chat: pending-then-bind message attachments
        CREATE TABLE IF NOT EXISTS chat_message_attachments (
            id SERIAL PRIMARY KEY,
            channel_id INTEGER NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
            message_id INTEGER REFERENCES chat_messages(id) ON DELETE CASCADE,
            uploaded_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            file_name VARCHAR(120) NOT NULL,
            original_name VARCHAR(255) NOT NULL,
            mime VARCHAR(128) NOT NULL,
            size_bytes INTEGER NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS ix_chat_message_attachments_channel_id
            ON chat_message_attachments(channel_id);
        CREATE INDEX IF NOT EXISTS ix_chat_message_attachments_message_id
            ON chat_message_attachments(message_id);
        CREATE INDEX IF NOT EXISTS ix_chat_message_attachments_uploaded_by_user_id
            ON chat_message_attachments(uploaded_by_user_id);

        CREATE TABLE IF NOT EXISTS reference_sets (
            id SERIAL PRIMARY KEY,
            library_platform VARCHAR(32) NOT NULL,
            region VARCHAR(16) NOT NULL,
            source VARCHAR(16) NOT NULL DEFAULT 'nointro',
            name VARCHAR(255) NOT NULL DEFAULT '',
            entry_count INTEGER NOT NULL DEFAULT 0,
            uploaded_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT uq_reference_set_platform_region UNIQUE (library_platform, region)
        );
        CREATE INDEX IF NOT EXISTS ix_reference_sets_library_platform ON reference_sets(library_platform);
        CREATE INDEX IF NOT EXISTS ix_reference_sets_region ON reference_sets(region);

        CREATE TABLE IF NOT EXISTS reference_set_entries (
            id SERIAL PRIMARY KEY,
            set_id INTEGER NOT NULL REFERENCES reference_sets(id) ON DELETE CASCADE,
            name VARCHAR(512) NOT NULL,
            normalized_name VARCHAR(512) NOT NULL,
            crc VARCHAR(16),
            md5 VARCHAR(32),
            sha1 VARCHAR(40),
            size BIGINT,
            serial VARCHAR(64)
        );
        CREATE INDEX IF NOT EXISTS ix_reference_set_entries_set_id ON reference_set_entries(set_id);
        CREATE INDEX IF NOT EXISTS ix_reference_set_entries_set_norm ON reference_set_entries(set_id, normalized_name);

        CREATE TABLE IF NOT EXISTS game_servers (
            id SERIAL PRIMARY KEY,
            uuid VARCHAR(36) NOT NULL UNIQUE,
            display_name VARCHAR(255) NOT NULL,
            connect_string VARCHAR(512) NOT NULL,
            game_uuid VARCHAR(36) REFERENCES games(uuid) ON DELETE SET NULL,
            health_url VARCHAR(512),
            compose_project VARCHAR(128),
            container_id VARCHAR(128),
            invite_note TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS ix_game_servers_game_uuid ON game_servers(game_uuid);

        ALTER TABLE client_devices ADD COLUMN IF NOT EXISTS device_kind VARCHAR(16) NOT NULL DEFAULT 'companion';

        ALTER TABLE games ADD COLUMN IF NOT EXISTS file_crc VARCHAR(16);
        ALTER TABLE games ADD COLUMN IF NOT EXISTS file_md5 VARCHAR(32);
        ALTER TABLE games ADD COLUMN IF NOT EXISTS file_sha1 VARCHAR(40);
        ALTER TABLE games ADD COLUMN IF NOT EXISTS rom_region VARCHAR(16);
        ALTER TABLE games ADD COLUMN IF NOT EXISTS rom_languages VARCHAR(64);
        ALTER TABLE games ADD COLUMN IF NOT EXISTS has_english BOOLEAN;
        ALTER TABLE game_extras ADD COLUMN IF NOT EXISTS extra_kind VARCHAR(32);
        ALTER TABLE game_extras ADD COLUMN IF NOT EXISTS patch_format VARCHAR(8);
        ALTER TABLE game_extras ADD COLUMN IF NOT EXISTS target_language VARCHAR(16);
        ALTER TABLE game_extras ADD COLUMN IF NOT EXISTS source_url VARCHAR(512);
        ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS preferred_game_locale VARCHAR(16) DEFAULT 'en-US';
        CREATE INDEX IF NOT EXISTS ix_games_file_crc ON games(file_crc);
        CREATE INDEX IF NOT EXISTS ix_games_file_md5 ON games(file_md5);
        CREATE INDEX IF NOT EXISTS ix_games_file_sha1 ON games(file_sha1);
        CREATE INDEX IF NOT EXISTS ix_games_library_uuid ON games(library_uuid);
        CREATE INDEX IF NOT EXISTS ix_games_name ON games(name);
        CREATE INDEX IF NOT EXISTS ix_games_date_created ON games(date_created DESC);
        CREATE INDEX IF NOT EXISTS ix_games_rating ON games(rating);

        ALTER TABLE unmatched_folders ADD COLUMN IF NOT EXISTS matched_game_uuid VARCHAR(36);
        ALTER TABLE unmatched_folders ADD COLUMN IF NOT EXISTS match_reason VARCHAR(64);
        ALTER TABLE unmatched_folders ADD COLUMN IF NOT EXISTS match_score DOUBLE PRECISION;
        ALTER TABLE unmatched_folders ADD COLUMN IF NOT EXISTS suggested_kind VARCHAR(16);
        ALTER TABLE unmatched_folders ADD COLUMN IF NOT EXISTS suggested_candidate_name VARCHAR(255);
        ALTER TABLE unmatched_folders ADD COLUMN IF NOT EXISTS stage_e_candidates JSON;
        ALTER TABLE unmatched_folders ADD COLUMN IF NOT EXISTS stage_e JSON;
        ALTER TABLE unmatched_folders ADD COLUMN IF NOT EXISTS search_name VARCHAR(255);
        ALTER TABLE unmatched_folders ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);
        CREATE INDEX IF NOT EXISTS ix_unmatched_folders_matched_game_uuid ON unmatched_folders(matched_game_uuid);

        ALTER TABLE games ADD COLUMN IF NOT EXISTS item_kind VARCHAR(16) DEFAULT 'game';
        UPDATE games SET item_kind = 'game' WHERE item_kind IS NULL;
        CREATE INDEX IF NOT EXISTS ix_games_item_kind ON games(item_kind);

        ALTER TABLE games ADD COLUMN IF NOT EXISTS path_status VARCHAR(16);
        CREATE INDEX IF NOT EXISTS ix_games_path_status ON games(path_status);

        ALTER TABLE libraries ADD COLUMN IF NOT EXISTS watch_enabled BOOLEAN;
        -- null = follow GT_LIBRARY_WATCH global; false = opt-out; true = prefer watch

        CREATE TABLE IF NOT EXISTS duplicate_fix_logs (
            id SERIAL PRIMARY KEY,
            unmatched_folder_id VARCHAR(36),
            folder_path VARCHAR(1024) NOT NULL,
            matched_game_uuid VARCHAR(36),
            match_reason VARCHAR(64),
            match_score DOUBLE PRECISION,
            action VARCHAR(32) NOT NULL,
            actor_user_id INTEGER REFERENCES users(id),
            notes VARCHAR(512),
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS ix_duplicate_fix_logs_created_at ON duplicate_fix_logs(created_at DESC);
        CREATE INDEX IF NOT EXISTS ix_duplicate_fix_logs_matched_game ON duplicate_fix_logs(matched_game_uuid);

        ALTER TABLE chat_channels ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;

        """
        print("Upgrading database to the latest schema")
        try:
            # Execute each statement in its own short transaction so one failure
            # does not abort later ALTERs (Postgres InFailedSqlTransaction).
            with self.engine.connect() as connection:
                statements = self._parse_sql_statements(add_columns_sql)
                for statement in statements:
                    if not statement.strip():
                        continue
                    try:
                        with connection.begin():
                            connection.execute(text(statement))
                    except Exception as stmt_error:
                        print(f"Warning: Failed to execute statement: {statement[:100]}...")
                        print(f"Error: {stmt_error}")
                        continue

            # Clean up duplicate discovery sections
            self.cleanup_duplicate_discovery_sections()

            print("Database schema update completed successfully.")
        except Exception as e:
            print(f"An error occurred during schema update: {e}")
            # Don't raise the exception - let the application continue
            print("Application will continue with existing schema...")
        finally:
            # Close the database connection
            self.engine.dispose()

    def cleanup_duplicate_discovery_sections(self):
        """
        Clean up duplicate discovery sections created by conflicting initialization code.
        Removes outdated sections with wrong identifiers (latest, random, popular).
        """
        cleanup_sql = """
        -- Delete outdated discovery sections with wrong identifiers
        DELETE FROM discovery_sections
        WHERE identifier IN ('latest', 'random', 'popular');

        -- Log what was done
        DO $$
        DECLARE
            deleted_count INTEGER;
        BEGIN
            GET DIAGNOSTICS deleted_count = ROW_COUNT;
            IF deleted_count > 0 THEN
                RAISE NOTICE 'Removed % outdated discovery sections', deleted_count;
            END IF;
        END $$;
        """

        print("Cleaning up duplicate discovery sections...")
        try:
            with self.engine.begin() as connection:
                connection.execute(text(cleanup_sql))
                print("Discovery sections cleanup completed successfully.")
        except Exception as e:
            print(f"Warning: Discovery sections cleanup failed: {e}")
            print("Application will continue...")

    def _parse_sql_statements(self, sql_text):
        """
        Parse SQL text into individual statements, properly handling PostgreSQL 
        dollar-quoted blocks like DO $$ ... END $$;
        """
        statements = []
        current_statement = ""
        in_dollar_quote = False
        dollar_tag = ""
        
        lines = sql_text.split('\n')
        
        for line in lines:
            stripped_line = line.strip()
            
            # Skip empty lines and comments
            if not stripped_line or stripped_line.startswith('--'):
                current_statement += line + '\n'
                continue
                
            # Check for start of dollar-quoted block
            if not in_dollar_quote:
                # Look for DO $$ or DO $tag$
                if 'DO $' in stripped_line.upper():
                    # Extract the dollar tag (e.g., $$ or $tag$)
                    import re
                    match = re.search(r'DO\s+(\$[^$]*\$)', stripped_line.upper())
                    if match:
                        dollar_tag = match.group(1)
                        in_dollar_quote = True
                        
            current_statement += line + '\n'
            
            # Check for end of dollar-quoted block
            if in_dollar_quote:
                if dollar_tag in stripped_line and stripped_line.endswith(';'):
                    in_dollar_quote = False
                    dollar_tag = ""
                    # End of DO block, add as complete statement
                    statements.append(current_statement.strip())
                    current_statement = ""
            else:
                # Regular statement ending with semicolon
                if stripped_line.endswith(';'):
                    statements.append(current_statement.strip())
                    current_statement = ""
        
        # Add any remaining statement
        if current_statement.strip():
            statements.append(current_statement.strip())
            
        return [stmt for stmt in statements if stmt.strip()]

# Example of how to use the class
# db_manager = DatabaseManager()
# db_manager.add_column_if_not_exists()
