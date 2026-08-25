import os
import time
from PIL import Image as PILImage
import requests
import re
import html
from wtforms.validators import ValidationError
from gametheca import db
from gametheca.models import ReleaseGroup, Library, Game
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import select, func
from gametheca.models import GlobalSettings
from flask import url_for, current_app
from gametheca.utils.security import is_safe_path, get_allowed_base_directories
from gametheca.utils.quality_profiles import active_exclude_terms_for_scan
from gametheca.utils.global_settings import global_settings_row

# Default cap for recursive size walks (NAS/Unraid trees can take minutes otherwise).
_DEFAULT_FOLDER_SIZE_TIMEOUT_SEC = 60


def _excluded_size_folder_names(settings) -> set[str]:
    """Lowercased update/extras folder basenames to skip during size walks."""
    names: set[str] = set()
    if not settings:
        return names
    for attr in ('update_folder_name', 'extras_folder_name'):
        value = getattr(settings, attr, None)
        if value and str(value).strip():
            names.add(str(value).strip().lower())
    return names


def _path_has_excluded_component(dirpath: str, root: str, excluded: set[str]) -> bool:
    if not excluded:
        return False
    try:
        rel = os.path.relpath(dirpath, root)
    except ValueError:
        rel = dirpath
    if rel in ('.', ''):
        return False
    return any(part.lower() in excluded for part in rel.replace('\\', '/').split('/'))

def format_size(size_in_bytes):
    """Format file size from bytes to human-readable format."""
    try:
        if size_in_bytes is None:
            return '0 MB'
        units = ['KB', 'MB', 'GB', 'TB', 'PB', 'EB']
        size = size_in_bytes / 1024  # Start with KB
        unit_index = 0
        while size >= 1024 and unit_index < len(units) - 1:
            size /= 1024
            unit_index += 1
        return f"{size:.2f} {units[unit_index]}"
    except Exception as e:
        print(f"An error occurred: {e}")
        return '0 MB'


def square_image(image, size):
    """Create a square image with the given size."""
    image.thumbnail((size, size))
    if image.size[0] != size or image.size[1] != size:
        new_image = PILImage.new('RGB', (size, size), color='black')
        offset = ((size - image.size[0]) // 2, (size - image.size[1]) // 2)
        new_image.paste(image, offset)
        image = new_image
    return image

def get_path_size(file_path):
    """Calculate size of a file or directory in bytes (download initiate helper)."""
    try:
        if os.path.isfile(file_path):
            return os.path.getsize(file_path)
        if os.path.isdir(file_path):
            total_size = 0
            for dirpath, _dirnames, filenames in os.walk(file_path):
                for filename in filenames:
                    filepath = os.path.join(dirpath, filename)
                    try:
                        total_size += os.path.getsize(filepath)
                    except OSError:
                        pass
            return total_size
    except OSError:
        pass
    return 0


def get_folder_size_in_bytes(folder_path, timeout=_DEFAULT_FOLDER_SIZE_TIMEOUT_SEC):
    """Calculate the total size of a folder in bytes.
    
    Args:
        folder_path (str): Path to the folder
        timeout (int): Maximum time in seconds to spend calculating size
    
    Returns:
        int: Total size in bytes, or 0 if there was an error
    """
    try:
        # Validate folder path security (only if we're in an application context)
        try:
            if current_app:
                allowed_bases = get_allowed_base_directories(current_app)
                if not allowed_bases:
                    print(f"Security error: No allowed base directories configured for path: {folder_path}")
                    return 0

                is_safe, error_message = is_safe_path(folder_path, allowed_bases)
                if not is_safe:
                    print(f"Security error: Path validation failed for {folder_path}: {error_message}")
                    return 0
        except RuntimeError:
            # Working outside of application context - skip validation for now
            # This is expected during unit tests
            pass
        # Check if path exists and is accessible
        if not os.path.exists(folder_path):
            print(f"Error: Path does not exist: {folder_path}")
            return 0
            
        # Handle single file case first
        if os.path.isfile(folder_path):
            return os.path.getsize(folder_path)
            
        if not os.access(folder_path, os.R_OK):
            print(f"Error: No read permission for path: {folder_path}")
            return 0

        timeout_sec = max(1, int(timeout or _DEFAULT_FOLDER_SIZE_TIMEOUT_SEC))
        deadline = time.monotonic() + timeout_sec
        total_size = 0
        timed_out = False
        for dirpath, dirnames, filenames in os.walk(folder_path):
            if time.monotonic() >= deadline:
                timed_out = True
                break
            try:
                # Skip if we can't access the directory
                if not os.access(dirpath, os.R_OK):
                    print(f"Warning: Skipping inaccessible directory: {dirpath}")
                    dirnames[:] = []
                    continue

                for f in filenames:
                    if time.monotonic() >= deadline:
                        timed_out = True
                        break
                    try:
                        fp = os.path.join(dirpath, f)
                        # Skip symlinks unless they point to regular files
                        if os.path.islink(fp):
                            continue
                        total_size += os.path.getsize(fp)
                    except (OSError, IOError) as e:
                        print(f"Error processing file {f}: {e}")
                        continue
            except (OSError, IOError) as e:
                print(f"Error accessing directory {dirpath}: {e}")
                continue
            if timed_out:
                break

        if timed_out:
            print(
                f"Folder size timed out after {timeout_sec}s for {folder_path} "
                f"(partial={total_size} bytes)"
            )

        return max(total_size, 1)

    except Exception as e:
        print(f"Unexpected error calculating folder size: {e}")
        return 0


def get_folder_size_in_bytes_updates(folder_path, timeout=_DEFAULT_FOLDER_SIZE_TIMEOUT_SEC):
    """Calculate folder size excluding update and extras folders."""
    try:
        # Validate folder path security (only if we're in an application context)
        try:
            if current_app:
                allowed_bases = get_allowed_base_directories(current_app)
                if not allowed_bases:
                    print(f"Security error: No allowed base directories configured for path: {folder_path}")
                    return 0

                is_safe, error_message = is_safe_path(folder_path, allowed_bases)
                if not is_safe:
                    print(f"Security error: Path validation failed for {folder_path}: {error_message}")
                    return 0
        except RuntimeError:
            # Working outside of application context - skip validation for now  
            # This is expected during unit tests
            pass
        # Handle single file case first
        if os.path.isfile(folder_path):
            return os.path.getsize(folder_path)
            
        if not os.path.exists(folder_path):
            print(f"Error: Path does not exist: {folder_path}")
            return 0
            
        if not os.access(folder_path, os.R_OK):
            print(f"Error: No read permission for path: {folder_path}")
            return 0

        settings = global_settings_row()
        excluded = _excluded_size_folder_names(settings)
        timeout_sec = max(1, int(timeout or _DEFAULT_FOLDER_SIZE_TIMEOUT_SEC))
        deadline = time.monotonic() + timeout_sec
        total_size = 0
        timed_out = False
        
        for dirpath, dirnames, filenames in os.walk(folder_path):
            if time.monotonic() >= deadline:
                timed_out = True
                break
            try:
                # Prune update/extras children so we do not walk those trees.
                if excluded:
                    dirnames[:] = [d for d in dirnames if d.lower() not in excluded]

                # Skip if we can't access the directory
                if not os.access(dirpath, os.R_OK):
                    print(f"Warning: Skipping inaccessible directory: {dirpath}")
                    dirnames[:] = []
                    continue

                if _path_has_excluded_component(dirpath, folder_path, excluded):
                    dirnames[:] = []
                    continue

                for f in filenames:
                    if time.monotonic() >= deadline:
                        timed_out = True
                        break
                    try:
                        fp = os.path.join(dirpath, f)
                        if os.path.islink(fp):
                            continue
                        total_size += os.path.getsize(fp)
                    except (OSError, IOError) as e:
                        print(f"Error processing file {f}: {e}")
                        continue

            except (OSError, IOError) as e:
                print(f"Error accessing directory {dirpath}: {e}")
                continue
            if timed_out:
                break

        if timed_out:
            print(
                f"Folder size (excl. updates/extras) timed out after {timeout_sec}s "
                f"for {folder_path} (partial={total_size} bytes)"
            )

        return max(total_size, 1)

    except Exception as e:
        print(f"Unexpected error calculating folder size: {e}")
        return 0


def read_first_nfo_content(full_disk_path):
    """Read the content of the first NFO file found in the given path."""
    
    # Validate folder path security (only if we're in an application context)
    try:
        if current_app:
            allowed_bases = get_allowed_base_directories(current_app)
            if not allowed_bases:
                print(f"Security error: No allowed base directories configured for path: {full_disk_path}")
                return None

            is_safe, error_message = is_safe_path(full_disk_path, allowed_bases)
            if not is_safe:
                print(f"Security error: Path validation failed for {full_disk_path}: {error_message}")
                return None
    except RuntimeError:
        # Working outside of application context - skip validation for now  
        # This is expected during unit tests
        pass
    
    if os.path.isfile(full_disk_path):
        print("Path is a file, not a directory. Skipping NFO scan.")
        return None
        
    try:
        for file in os.listdir(full_disk_path):
            if file.lower().endswith('.nfo'):
                nfo_path = os.path.join(full_disk_path, file)
                
                try:
                    with open(nfo_path, 'r', encoding='utf-8', errors='ignore') as nfo_file:
                        content = nfo_file.read()
                        sanitized_content = content.replace('\x00', '')
                        return sanitized_content
                except Exception as e:
                    print(f"Error reading NFO file {nfo_path}: {str(e)}")
                    continue
                    
    except Exception as e:
        print(f"Error accessing directory {full_disk_path}: {str(e)}")
    
    print("No NFO file found")
    return None

def download_image(url, save_path):
    """Download an image from a URL and save it to the specified path.

    Returns (success, error_message). ``error_message`` is ``None`` on
    success so callers (image queue, art studio, batch downloaders) can
    surface *why* a download failed instead of silently marking it done.
    """
    if not url.startswith(('http://', 'https://')):
        url = 'https:' + url

    url = url.replace('/t_thumb/', '/t_original/')

    from gametheca.utils.http_safe import safe_get
    from gametheca.utils.security import validate_user_outbound_http_url
    ok, result = validate_user_outbound_http_url(url)
    if not ok:
        error = f"Blocked outbound URL: {result}"
        print(f"download_image blocked: {result}")
        return False, error
    url = result

    try:
        # safe_get, not requests.get: the validation above covers the URL we
        # asked for, and a 302 from a valid host to 169.254.169.254 used to be
        # followed without any further check. Every hop is revalidated now.
        response = safe_get(url, validator=validate_user_outbound_http_url, timeout=30)
        if response.status_code == 200:
            directory = os.path.dirname(save_path)

            if not os.path.exists(directory):
                print(f"'{directory}' does not exist. Attempting to create it.")
                try:
                    os.makedirs(directory, exist_ok=True)
                    print(f"Successfully created the directory '{directory}'.")
                except Exception as e:
                    error = f"Failed to create directory '{directory}': {e}"
                    print(error)
                    return False, error

            if os.access(directory, os.W_OK):
                with open(save_path, 'wb') as f:
                    f.write(response.content)
                return True, None
            else:
                error = f"Directory '{directory}' is not writable by the GameTheca process."
                print(f"Error: {error}")
                return False, error
        else:
            error = f"HTTP {response.status_code} downloading image."
            print(f"Failed to download the image. Status Code: {response.status_code}")
            return False, error
    except requests.exceptions.RequestException as e:
        error = f"Network error: {e}"
        print(f"Error downloading image from {url}: {e}")
        return False, error
    except OSError as e:
        error = f"Disk error writing to '{save_path}': {e}"
        print(f"An error occurred while saving the image to {save_path}: {e}")
        return False, error
    except Exception as e:
        error = f"Unexpected error: {e}"
        print(f"An error occurred while saving the image to {save_path}: {e}")
        return False, error

def comma_separated_urls(form, field):
    """Validate comma-separated YouTube embed URLs."""
    urls = field.data.split(',')
    url_pattern = re.compile(
        r'^(https?:\/\/)?(www\.)?youtube\.com\/embed\/[\w-]+$'
    )
    for url in urls:
        if not url_pattern.match(url.strip()):
            raise ValidationError('One or more URLs are invalid. Please provide valid YouTube embed URLs.')


def website_category_to_string(category_id, url=None):
    """
    Convert IGDB website category ID to a readable string.
    
    Args:
        category_id (int): IGDB website category ID
        url (str, optional): URL to use for fallback pattern matching
        
    Returns:
        str: Human-readable website category string
    """
    # Mapping based on IGDB API documentation for website categories
    category_mapping = {
        1: "official",
        2: "wikia", 
        3: "wikipedia",
        4: "facebook",
        5: "twitter",
        6: "twitch",
        7: "website",  # Added missing category ID 7
        8: "instagram",
        9: "youtube",
        10: "iphone",
        11: "ipad", 
        12: "android",
        13: "steam",
        14: "reddit",
        15: "itch",
        16: "epicgames",
        17: "gog"
    }
    
    # Return mapped category if found
    if category_id in category_mapping:
        return category_mapping[category_id]
    
    # Fallback: Try to detect type from URL pattern matching if URL provided
    detected_type = _detect_url_type_from_pattern(url)
    if detected_type:
        return detected_type
    
    # Final fallback: return "website" instead of "unknown"
    return "website"

PLATFORM_IDS = {
    "PCWIN": 6,
    "PCDOS": 13,
    "N64": 4,
    "GB": 33,
    "GBA": 24,
    "NDS": 20,
    "NES": 18,
    "SNES": 19,
    "NGC" : 21,
    "WII": 5,
    "N3DS": 37,
    "SWITCH": 130,
    "XBOX": 11,
    "X360": 12,
    "XONE": 49,
    "XSX": 169,
    "PSX": 7,
    "PS2": 8,
    "PS3": 9,
    "PS4": 48,
    "PS5": 167,
    "PSP": 38,
    "PSVITA": 46,
    "VB": 87,
    "SEGA_MD": 29,
    "SEGA_MS": 86,
    "SEGA_CD": 78,
    "LYNX": 61,
    "SEGA_32X": 30,
    "JAGUAR": 62,
    "SEGA_GG": 35,
    "SEGA_SATURN": 32,
    "SEGA_DC": 23,
    "ATARI_7800": 60,
    "ATARI_2600": 59,
    "PCE": 128,
    "PCFX": 274,
    "NGP": 119,
    "NEOGEO_CD": 136,
    "NEOGEO": 79,
    "ARCADE": 52,
    "WS": 57,
    "COLECO": 68,
    "VICE_X64SC": 15,
    "VICE_X128": 15,
    "VICE_XVIC": 71,
    "VICE_XPLUS4": 94,
    "VICE_XPET": 90,
    "OTHER": None,  # Assuming "Other/Mixed" has no specific ID
}


# Folder-name globs skipped while listing game dirs (emu installs / FE / tools).
# Case-insensitive fnmatch. Source of truth: docs/strategy/console-gaming-libraries.md.
# Operators may add more via Admin → Scanning filters with prefix ``dir:``
# (e.g. ``dir:_MyTools``). Name-clean ReleaseGroup rows (no ``dir:``) are unchanged.
# Prefer prefix globs (``emu*``) over substring (``*emu*``) so real titles are
# not skipped — e.g. ``*dolphin*`` killed ``Ecco the Dolphin``; ``GOD *`` /
# ``GOD*`` killed ``God of War`` / ``God Hand``. Align with
# docs/strategy/console-gaming-libraries.md exclude list.
DEFAULT_SKIP_DIR_GLOBS = (
    '_Emulators',
    'Emulators',
    '*duckstation*',  # portable builds often have version prefixes
    'yuzu*',
    'ryujinx*',
    'xenia*',
    'bsnes*',
    'mgba*',
    'snes9x*',
    'virtualjaguar*',
    'pcsx2*',
    'dolphin*',
    'citra*',
    'flycast*',
    'vita3k*',
    'retroarch*',
    'cru-*',
    'pegasus*',
    'pegasus-fe*',
    'GOD v*',  # tool folder e.g. "GOD v1.0" — not "God of War"
    # Emulator install scaffolding (defense-in-depth when lib is pointed too high)
    'Config',
    'Lang',
    'Plugin',
    'ROMs',
    'docs',
    # Scan-root / lane leaks — never game folders
    '_console-gaming',
    '_pc',
    # Walkthrough / guide trees (not games)
    'walkthroughs',
    '_walkthroughs',
    '*walkthrough*',
    # Mod / VR-mod pack folders (generic markers — avoid ``*mod*`` mid-title false positives)
    '* MOD',
    '* MOD *',
    '*-MOD',
    '*-MOD-*',
    '* VR Mod*',
    '* VR mod*',
)

# Folder basenames matching these regexes are skipped (repack bracket tags, etc.).
# Operators may add more via Admin scanning filters prefixed with ``re:``.
DEFAULT_SKIP_DIR_REGEXES = (
    re.compile(
        r'\[\s*(?:[^\]]*?[^\s\]]\s+)?(?:HV\s+)?Repack\s*\]',
        re.IGNORECASE,
    ),
)

_DIR_FILTER_PREFIX = 'dir:'
_REGEX_FILTER_PREFIX = 're:'


def load_skip_dir_patterns():
    """Built-in skip-dir globs plus Admin scanning filters prefixed with ``dir:``."""
    patterns = list(DEFAULT_SKIP_DIR_GLOBS)
    try:
        rows = db.session.execute(
            select(ReleaseGroup).filter(ReleaseGroup.filter_pattern.isnot(None))
        ).scalars().all()
        for rg in rows:
            raw = (rg.filter_pattern or '').strip()
            if not raw.lower().startswith(_DIR_FILTER_PREFIX):
                continue
            extra = raw[len(_DIR_FILTER_PREFIX):].strip()
            if extra:
                patterns.append(extra)
        return patterns
    except SQLAlchemyError as e:
        print(f"An error occurred while fetching skip-dir patterns: {e}")
        return list(DEFAULT_SKIP_DIR_GLOBS)


def load_skip_dir_regex_patterns():
    """Built-in skip-dir regexes plus Admin scanning filters prefixed with ``re:``."""
    patterns = list(DEFAULT_SKIP_DIR_REGEXES)
    try:
        rows = db.session.execute(
            select(ReleaseGroup).filter(ReleaseGroup.filter_pattern.isnot(None))
        ).scalars().all()
        for rg in rows:
            raw = (rg.filter_pattern or '').strip()
            if not raw.lower().startswith(_REGEX_FILTER_PREFIX):
                continue
            extra = raw[len(_REGEX_FILTER_PREFIX):].strip()
            if not extra:
                continue
            try:
                patterns.append(re.compile(extra, re.IGNORECASE))
            except re.error as exc:
                print(f"Invalid skip-dir regex filter {extra!r}: {exc}")
        return patterns
    except SQLAlchemyError as e:
        print(f"An error occurred while fetching skip-dir regex patterns: {e}")
        return list(DEFAULT_SKIP_DIR_REGEXES)


# Truthy forms historically written by scan_management (bool) vs edit_filters ('yes'|'no').
_CASE_SENSITIVE_TRUE = frozenset({'yes', 'true', '1', 'y', 'on'})


def is_case_sensitive_flag(value) -> bool:
    """Normalize ReleaseGroup.case_sensitive stored forms to bool.

    Accepts bool, int/float (nonzero), and common string forms
    (``'yes'|'no'``, ``'true'|'false'``, ``'1'|'0'``).
    """
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    text = str(value).strip().lower()
    if not text:
        return False
    return text in _CASE_SENSITIVE_TRUE


def normalize_case_sensitive(value) -> str:
    """Canonical DB string for ``filters.case_sensitive`` (String column)."""
    return 'yes' if is_case_sensitive_flag(value) else 'no'


def load_scanning_filter_patterns():
    try:
        # Fetching insensitive patterns (not case-sensitive).
        # Skip ``dir:`` rows — those are folder-skip globs, not name cleaners.
        name_filter_rows = [
            rg for rg in db.session.execute(
                select(ReleaseGroup).filter(ReleaseGroup.filter_pattern.isnot(None))
            ).scalars().all()
            if not (rg.filter_pattern or '').strip().lower().startswith(_DIR_FILTER_PREFIX)
            and not (rg.filter_pattern or '').strip().lower().startswith(_REGEX_FILTER_PREFIX)
        ]
        insensitive_patterns = [
            "-" + rg.filter_pattern for rg in name_filter_rows
        ] + [
            "." + rg.filter_pattern for rg in name_filter_rows
        ]

        # Rows with a case_sensitive flag (any stored shape) drive the
        # (pattern, is_case_sensitive) pairs used by name cleaning.
        sensitive_patterns = []
        for rg in db.session.execute(select(ReleaseGroup).filter(ReleaseGroup.case_sensitive.isnot(None))).scalars().all():
            raw_fp = (rg.filter_pattern or '').strip().lower()
            if raw_fp.startswith(_DIR_FILTER_PREFIX) or raw_fp.startswith(_REGEX_FILTER_PREFIX):
                continue
            is_case_sensitive = is_case_sensitive_flag(rg.case_sensitive)
            sensitive_patterns.append(("-" + rg.filter_pattern, is_case_sensitive))
            sensitive_patterns.append(("." + rg.filter_pattern, is_case_sensitive))

        # Active quality profile blocked groups / excluded terms (P1-12) —
        # same strip shape as ReleaseGroup name cleaners (-tag / .tag).
        try:
            for term in active_exclude_terms_for_scan():
                if not term:
                    continue
                insensitive_patterns.append("-" + term)
                insensitive_patterns.append("." + term)
                sensitive_patterns.append(("-" + term, False))
                sensitive_patterns.append(("." + term, False))
        except Exception as qp_exc:
            print(f"Quality profile scan filters skipped: {qp_exc}")

        return insensitive_patterns, sensitive_patterns
    except SQLAlchemyError as e:
        print(f"An error occurred while fetching scanning filter patterns: {e}")
        return [], []


def get_library_count():
    return int(db.session.execute(select(func.count()).select_from(Library)).scalar() or 0)


def get_games_count():
    return int(db.session.execute(select(func.count()).select_from(Game)).scalar() or 0)

def delete_associations_for_game(game_to_delete):
    associations = [game_to_delete.genres, game_to_delete.platforms, game_to_delete.game_modes,
                    game_to_delete.themes, game_to_delete.player_perspectives, game_to_delete.multiplayer_modes]
    
    for association in associations:
        association.clear()

def sanitize_string_input(input_str, max_length, allow_html=False):
    """Sanitize string input to prevent XSS and ensure length limits."""
    if not input_str:
        return ''
    
    # Convert to string and strip whitespace
    sanitized = str(input_str).strip()
    
    # HTML escape if not allowing HTML
    if not allow_html:
        sanitized = html.escape(sanitized)
    
    # Enforce length limit
    if len(sanitized) > max_length:
        sanitized = sanitized[:max_length]
    
    return sanitized


def _detect_url_type_from_pattern(url):
    """
    Helper function to detect URL type from domain patterns.
    
    Args:
        url (str): The URL to analyze
        
    Returns:
        str or None: Detected URL type, or None if no pattern matches
    """
    if not url:
        return None
        
    url_lower = url.lower()
    
    # URL pattern mapping for detection
    url_patterns = {
        "steam": ["steampowered.com", "store.steampowered.com"],
        "gog": ["gog.com", "www.gog.com"],
        "epicgames": ["epicgames.com", "store.epicgames.com"],
        "itch": ["itch.io"],
        "youtube": ["youtube.com", "youtu.be"],
        "twitch": ["twitch.tv"],
        "reddit": ["reddit.com"],
        "facebook": ["facebook.com", "fb.com"],
        "twitter": ["twitter.com", "x.com"],
        "instagram": ["instagram.com"],
        "wikipedia": ["wikipedia.org"],
        "wikia": ["fandom.com", "wikia.com"]
    }
    
    # Check URL patterns for known types
    for pattern_type, domains in url_patterns.items():
        for domain in domains:
            if domain in url_lower:
                return pattern_type
    
    return None


def get_url_icon(url_type, url):
    """
    Get the appropriate Font Awesome icon for a URL based on type and URL pattern matching.
    
    Args:
        url_type (str): The stored URL type from database
        url (str): The actual URL for pattern matching fallback
    
    Returns:
        str: Font Awesome icon class
    """
    # Primary icon mapping based on stored type
    type_icons = {
        "official": "fa-solid fa-globe",
        "website": "fa-solid fa-link",
        "wikia": "fa-brands fa-wikimedia", 
        "wikipedia": "fa-brands fa-wikipedia-w",
        "facebook": "fa-brands fa-facebook",
        "twitter": "fa-brands fa-twitter", 
        "twitch": "fa-brands fa-twitch",
        "instagram": "fa-brands fa-instagram",
        "youtube": "fa-brands fa-youtube",
        "steam": "fa-brands fa-steam",
        "reddit": "fa-brands fa-reddit",
        "itch": "fa-brands fa-itch-io",
        "epicgames": "fa-brands fa-epic-games",
        "gog": "fa-brands fa-gog",
        "android": "fa-brands fa-android",
        "iphone": "fa-brands fa-apple",
        "ipad": "fa-brands fa-apple"
    }
    
    # If we have a known type, use it
    if url_type in type_icons:
        return type_icons[url_type]
    
    # Fallback: Pattern matching for "unknown" or unmapped types
    if not url:
        return "fa-solid fa-link"
        
    # Use helper function to detect URL type from pattern
    detected_type = _detect_url_type_from_pattern(url)
    if detected_type and detected_type in type_icons:
        return type_icons[detected_type]
    
    # Default fallback
    return "fa-solid fa-link"
