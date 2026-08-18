import os
import shutil
from gametheca import db
from gametheca.init_manager import InitManager
from gametheca.models import DiscoverySection
from gametheca.utils.preset_themes import install_preset_themes
from gametheca.utils.icon_themes import install_icon_themes
from sqlalchemy import select

# Default allowed file types
DEFAULT_ALLOWED_FILE_TYPES = [
    'zip', 'rar', '7z', 'iso', 'nfo', 'nes', 'sfc', 'smc', 'sms', '32x',
    'gen', 'gg', 'gba', 'gb', 'gbc', 'nds', 'ndc', 'prg', 'dat', 'tap', 'z64',
    'n64', 'md', 'd64', 'dsk', 'img', 'bin', 'cue', 'chd', 'st', 'stx', 'j64',
    'jag', 'lnx', 'adf', 'ngc', 'gcm', 'rvz', 'wbfs', 'wad', 'gz', 'm2v', 'ogg',
    'fpt', 'fpl', 'vec', 'pce', 'a26', 'a52', 'a78', 'rom', 'pbp', 'cso',
    'cia', '3ds', 'nsp', 'xci', 'nsz', 'xcz', 'gdi', 'cdi',
]

from gametheca.models import ReleaseGroup
from gametheca.utils.event_logging import log_system_event
from gametheca.utils.global_settings import (
    global_settings_row,
    global_settings_row_or_create,
)

DEFAULT_GLOBAL_SETTINGS = {
    'showSystemLogo': True,
    'showHelpButton': True,
    'allowUsersToInviteOthers': True,
    'enableWebLinksOnDetailsPage': True,
    'enableServerStatusFeature': True,
    'enableNewsletterFeature': True,
    'showVersion': True,
}


def initialize_default_settings():
    """Initialize default global settings if they don't exist."""
    print("Initializing default global settings...")
    try:
        # Fetch-or-create through the shared helper: this runs at boot, which is
        # exactly when several workers start at once and race for the first row.
        # The singleton unique index makes that collision an IntegrityError now,
        # and the helper's SAVEPOINT turns it back into "read the winner's row"
        # instead of leaving this worker with nothing.
        existed = global_settings_row() is not None
        settings_record = global_settings_row_or_create()

        if not settings_record.settings:
            # Covers both the row we just made and a pre-existing one whose
            # settings blob is empty. A populated blob is never overwritten.
            settings_record.settings = dict(DEFAULT_GLOBAL_SETTINGS)
            db.session.commit()
            print(
                "Updated existing global settings with default values"
                if existed
                else "Created default global settings"
            )
        else:
            # Nothing to persist: reaching here means a populated row already
            # existed, so the helper read rather than created.
            print("Global settings already exist with values, preserving them")
    except Exception as e:
        print(f"Error initializing default settings: {e}")
        db.session.rollback()

def initialize_library_folders():
    """Initialize the required folders and theme files for the application."""
    print("Initializing library folders...")
    library_path = os.path.join(os.path.dirname(__file__), 'static', 'library')
    themes_path = os.path.join(library_path, 'themes')
    images_path = os.path.join(library_path, 'images')
    zips_path = os.path.join(library_path, 'zips')
    icon_themes_path = os.path.join(library_path, 'icon-themes')
    
    # Check if default theme exists
    default_theme_target = os.path.join(themes_path, 'default')
    default_theme_source = InitManager.default_theme_source()
    if not os.path.exists(os.path.join(default_theme_target, 'theme.json')):
        print(f"Default theme not found at {os.path.join(default_theme_target, 'theme.json')}")
        log_system_event(f"Default theme not found at {os.path.join(default_theme_target, 'theme.json')}", event_type='startup', event_level='warning', audit_user='system')
        if os.path.exists(default_theme_source):
            try:
                # Create themes directory if it doesn't exist
                os.makedirs(themes_path, exist_ok=True)
                # Copy the entire default theme directory
                shutil.copytree(default_theme_source, default_theme_target)
                print("Default theme copied successfully")
                log_system_event("Default theme copied successfully from source directory", event_type='startup', event_level='info', audit_user='system')
                install_preset_themes(themes_path, default_theme_source)
            except Exception as e:
                print(f"Error copying default theme: {str(e)}")
                log_system_event(f"Error copying default theme: {str(e)}", event_type='startup', event_level='error', audit_user='system')
        else:
            print("Warning: default theme source not found in gametheca/setup/default_theme")
            log_system_event("Warning: default theme source not found in gametheca/setup/default_theme", event_type='startup', event_level='warning', audit_user='system')
    else:
        print("Default theme found, skipping copy")
        # Ensure colour presets exist even when default was copied earlier.
        if os.path.exists(default_theme_source):
            try:
                install_preset_themes(themes_path, default_theme_source)
            except Exception as e:
                print(f"Error installing preset themes: {str(e)}")
    # Create images folder if it doesn't exist
    if not os.path.exists(images_path):
        os.makedirs(images_path)
        print("Created images folder")

    # Create zips folder if it doesn't exist
    if not os.path.exists(zips_path):
        os.makedirs(zips_path)
        print("Created zips folder")

    # Icon packs (orthogonal to color themes)
    os.makedirs(icon_themes_path, exist_ok=True)
    try:
        installed = install_icon_themes(force=False)
        print(f"Icon packs ready: {', '.join(installed)}")
    except Exception as e:
        print(f"Error installing icon packs: {e}")
        log_system_event(f"Error installing icon packs: {e}", event_type='startup', event_level='warning', audit_user='system')

    # Fonts and firmware, so an install arrives with both rather than needing
    # two scripts run by hand. Both are best-effort and never block boot.
    os.makedirs(os.path.join(library_path, 'fonts'), exist_ok=True)
    initialize_theme_fonts()
    initialize_emulator_bios()


def initialize_theme_fonts():
    """Install the built-in OFL faces the font picker offers.

    A local copy from ``gametheca/setup/fonts``, inline — five small files, no
    network, so there is nothing to background and nothing to fail. The picker
    lists these faces and reports ``installed: False`` for any whose file is
    absent, which was honest and still meant a fresh install offered five fonts
    and shipped none of them.

    It used to download them from google/fonts on a background thread, which is
    why it was best-effort and why so many installs never got them: a proxy, an
    air-gapped host, or a fetch that failed quietly all ended in a picker full
    of "not installed" with the fix being a script nobody knew to run.

    Anything the bundle does not carry — a face added to ``BUILT_IN_FONTS``
    after a release — still falls back to the network, and
    ``FETCH_FONTS_ON_BOOT=false`` disables *that* half for air-gapped installs.
    The bundled copy always runs; there is no reason to opt out of a file copy.
    """
    from flask import current_app

    from gametheca.utils.font_install import (
        install_builtin_fonts,
        missing_builtin_fonts,
        seed_builtin_fonts,
    )
    from gametheca.utils.theme_fonts import fonts_dir

    root = fonts_dir()
    os.makedirs(root, exist_ok=True)

    try:
        written = seed_builtin_fonts(root)
    except Exception as exc:  # noqa: BLE001 — cosmetics never block a boot
        log_system_event(
            f"Theme fonts not installed ({exc})",
            event_type='startup', event_level='warning', audit_user='system',
        )
        return

    if written:
        print(f"Installed {written} bundled theme font(s)")

    missing = missing_builtin_fonts(root)
    if not missing or not current_app.config.get('FETCH_FONTS_ON_BOOT', True):
        return

    # Only faces the bundle does not carry reach the network, and only in the
    # background — that half keeps its old best-effort contract.
    def _fetch():
        try:
            fetched = install_builtin_fonts(root)
            if fetched:
                log_system_event(
                    f"Fetched {fetched} theme font(s) not in the bundle",
                    event_type='startup', event_level='info', audit_user='system',
                )
        except Exception as exc:
            log_system_event(
                f"Theme fonts not fetched ({exc}); run scripts/fetch-fonts.py",
                event_type='startup', event_level='warning', audit_user='system',
            )

    from gametheca.utils.background import run_in_background

    run_in_background(current_app._get_current_object(), _fetch, name='font-install')
    print(f"Fetching {len(missing)} theme font(s) not in the bundle")


def initialize_emulator_bios():
    """Import firmware from an operator-supplied folder, if one is configured.

    `scripts/import_bios.py` already knew how to do this; nothing called it, so
    a local collection sat on disk while the Emulators page reported no firmware
    — reported as "bios we push for my local repo dont show as loaded".

    Set `BIOS_IMPORT_SOURCE` to that folder. Existing files are never
    overwritten, so this is safe to re-run on every boot: it tops up what is
    missing and leaves anything already installed alone.
    """
    from flask import current_app

    source = current_app.config.get('BIOS_IMPORT_SOURCE') or os.environ.get('BIOS_IMPORT_SOURCE')
    if not source:
        return
    if not os.path.isdir(source):
        log_system_event(
            f"BIOS_IMPORT_SOURCE is set but not a folder: {source}",
            event_type='startup', event_level='warning', audit_user='system',
        )
        return

    try:
        from gametheca.utils.bios_install import import_bios_from

        copied = import_bios_from(source)
        if copied:
            log_system_event(
                f"Imported {copied} firmware file(s) from {source}",
                event_type='startup', event_level='info', audit_user='system',
            )
            print(f"Imported {copied} firmware file(s)")
    except Exception as exc:
        log_system_event(
            f"Firmware import from {source} failed: {exc}",
            event_type='startup', event_level='warning', audit_user='system',
        )


def insert_default_scanning_filters():
    """Initialize default scanning filters in the database."""
    default_name_filters = [
        {'filter_pattern': 'Open Source', 'case_sensitive': 'no'},
        {'filter_pattern': 'Public Domain', 'case_sensitive': 'no'},
        {'filter_pattern': 'GOG', 'case_sensitive': 'no'},
    ]

    existing_groups = db.session.execute(select(ReleaseGroup.filter_pattern)).scalars().all()
    existing_group_names = set(existing_groups)

    for group in default_name_filters:
        if group['filter_pattern'] not in existing_group_names:
            new_group = ReleaseGroup(filter_pattern=group['filter_pattern'], case_sensitive=group['case_sensitive'])
            db.session.add(new_group)
    db.session.commit()

def initialize_allowed_file_types():
    """Initialize default allowed file types if they don't exist."""
    from gametheca.models import AllowedFileType
    
    print("Initializing default allowed file types...")
    existing_types = {ft.value for ft in db.session.execute(select(AllowedFileType)).scalars().all()}
    
    for file_type in DEFAULT_ALLOWED_FILE_TYPES:
        if file_type not in existing_types:
            try:
                new_type = AllowedFileType(value=file_type)
                db.session.add(new_type)
            except Exception as e:
                print(f"Error adding file type {file_type}: {e}")
                db.session.rollback()
                continue
    
    try:
        db.session.commit()
        print("Created default allowed file types")
    except Exception as e:
        print(f"Error committing default file types: {e}")
        db.session.rollback()


def initialize_discovery_sections():
    """Initialize default discovery sections if they don't exist."""
    print("Initializing default discovery sections...")
    
    default_sections = [
        {
            'name': 'Libraries',
            'identifier': 'libraries',
            'is_visible': False,
            'display_order': 0
        },
        {
            'name': 'Latest Games',
            'identifier': 'latest_games',
            'is_visible': True,
            'display_order': 1
        },
        {
            'name': 'Most Downloaded',
            'identifier': 'most_downloaded',
            'is_visible': True,
            'display_order': 2
        },
        {
            'name': 'Highest Rated',
            'identifier': 'highest_rated',
            'is_visible': True,
            'display_order': 3
        },
        {
            'name': 'Last Updated',
            'identifier': 'last_updated',
            'is_visible': True,
            'display_order': 4
        },
        {
            'name': 'Most Favorited',
            'identifier': 'most_favorited',
            'is_visible': True,
            'display_order': 5
        }
    ]

    # Get existing section identifiers
    existing_sections = {section.identifier for section in db.session.execute(select(DiscoverySection)).scalars().all()}

    # Add any missing sections
    for section in default_sections:
        if section['identifier'] not in existing_sections:
            try:
                new_section = DiscoverySection(
                    name=section['name'],
                    identifier=section['identifier'],
                    is_visible=section['is_visible'],
                    display_order=section['display_order']
                )
                db.session.add(new_section)
                print(f"Adding discovery section: {section['name']}")
            except Exception as e:
                print(f"Error adding discovery section {section['name']}: {e}")
                db.session.rollback()
                continue

    try:
        db.session.commit()
        print("Default discovery sections initialized")
    except Exception as e:
        print(f"Error committing discovery sections: {e}")
        db.session.rollback()
