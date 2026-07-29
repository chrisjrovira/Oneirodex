from datetime import datetime, UTC
from flask import flash, current_app, abort, has_request_context
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select, update, delete
from werkzeug.utils import secure_filename
import os, uuid

from gametheca import db
from gametheca.models import (
    Game, Image, Library, GlobalSettings,
    Developer, Publisher, Genre, Theme, GameMode, Platform, 
    PlayerPerspective, GameURL, ScanJob, Category, Status,
    game_developer_association
)
from gametheca.utils.functions import (
    read_first_nfo_content, delete_associations_for_game,
    website_category_to_string,
    PLATFORM_IDS, format_size, download_image,
    get_folder_size_in_bytes_updates
)
from gametheca.utils.igdb_api import make_igdb_api_request
from gametheca.utils.gamenames import generate_goty_variants
from gametheca.utils.match_scoring import select_best_match, rank_candidates
from gametheca.utils.match_proposal import build_match_proposal, write_match_proposal
from gametheca.utils.game_name_parse import parse_game_label
from gametheca.utils.steam_lookup import fetch_steam_title_by_app_id
from gametheca.utils.secondary_scrapers import (
    fetch_steam_data, game_indicates_vr, normalize_perspective_name, VR_PERSPECTIVE_NAME
)
from gametheca.utils.metadata_enrichment import apply_enriched_metadata
from gametheca.utils.notifications import notify_admins_new_game
from gametheca.utils.scanning import log_unmatched_folder, delete_game_images
from gametheca.utils.event_logging import log_system_event
from gametheca.utils.duplicate_check import should_mark_as_duplicate
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

# IGDB API mapping dictionaries for category, status, and player perspective
category_mapping = {
    0: Category.MAIN_GAME,
    1: Category.DLC_ADDON,
    2: Category.EXPANSION,
    3: Category.BUNDLE,
    4: Category.STANDALONE_EXPANSION,
    5: Category.MOD,
    6: Category.EPISODE,
    7: Category.SEASON,
    8: Category.REMAKE,
    9: Category.REMASTER,
    10: Category.EXPANDED_GAME,
    11: Category.PORT,
    12: Category.PACK,
    13: Category.UPDATE
}

status_mapping = {
    1: Status.RELEASED,
    2: Status.ALPHA,
    3: Status.BETA,
    4: Status.EARLY_ACCESS,
    6: Status.OFFLINE,
    7: Status.CANCELLED
}


def handle_existing_igdb_collision(
    *,
    existing_game,
    igdb_id,
    full_disk_path,
    game_name,
    scan_job_id,
    library_uuid,
    candidates=None,
    steam_title=None,
):
    """
    Same IGDB ID already in library. Mark Duplicate only for true title/path
    copies; otherwise Unmatched + proposal so remasters/collections can be reviewed.
    Returns None (caller should abort import).
    """
    if should_mark_as_duplicate(existing_game, full_disk_path, game_name):
        print(
            f"Duplicate folder for IGDB ID {igdb_id}: "
            f"'{game_name}' ≈ existing '{existing_game.name}' "
            f"({existing_game.full_disk_path})"
        )
        log_unmatched_folder(scan_job_id, full_disk_path, 'Duplicate', library_uuid=library_uuid)
        return None

    print(
        f"IGDB ID {igdb_id} already used by '{existing_game.name}' "
        f"at {existing_game.full_disk_path}, but folder '{game_name}' looks different — "
        "logging Unmatched for review (not Duplicate)."
    )
    log_unmatched_folder(scan_job_id, full_disk_path, 'Unmatched', library_uuid=library_uuid)
    try:
        proposal = build_match_proposal(
            game_name,
            candidates or [{'id': igdb_id, 'name': existing_game.name}],
            steam_title=steam_title,
            confidence='low',
        )
        proposal['proposal']['already_in_library'] = {
            'uuid': existing_game.uuid,
            'name': existing_game.name,
            'path': existing_game.full_disk_path,
            'igdb_id': igdb_id,
            'reason': 'igdb_id_collision_different_folder_title',
        }
        write_match_proposal(full_disk_path, proposal)
    except Exception as proposal_err:
        print(f"⚠️ Failed to write collision proposal for {full_disk_path}: {proposal_err}")
    return None


def get_or_create_entity(model_class, name_field="name", **kwargs):
    """
    Thread-safe helper to get an existing entity or create a new one.
    Handles race conditions that occur during multithreaded scanning.
    
    Args:
        model_class: The SQLAlchemy model class (Genre, Theme, etc.)
        name_field: The field name to query by (default: "name")
        **kwargs: The attributes to query and create with
        
    Returns:
        The existing or newly created entity instance
    """
    filter_value = kwargs.get(name_field)
    
    # First attempt: try to get existing entity
    entity = db.session.execute(
        select(model_class).filter_by(**{name_field: filter_value})
    ).scalar_one_or_none()
    
    if entity:
        return entity
    
    # Entity doesn't exist, try to create it
    try:
        entity = model_class(**kwargs)
        db.session.add(entity)
        db.session.flush()  # Flush to check for constraint violations immediately
        return entity
    except IntegrityError:
        # Handle race condition: another thread created the entity
        db.session.rollback()
        # Query again to get the entity created by the other thread
        entity = db.session.execute(
            select(model_class).filter_by(**{name_field: filter_value})
        ).scalar_one_or_none()
        if entity:
            return entity
        else:
            # This should not happen, but raise an error if it does
            raise RuntimeError(f"Failed to create or retrieve {model_class.__name__} with {name_field}='{filter_value}'")


def is_propose_only_scan(settings):
    """
    Determine whether the propose-only scan setting is enabled.

    Accepts either a settings dict (as built/threaded through scan helpers)
    or a GlobalSettings SQLAlchemy instance. When enabled, the scanner must
    never auto-import a game — even on a high-confidence IGDB match — and
    should instead write a match proposal sidecar for admin review.
    """
    if not settings:
        return False
    if isinstance(settings, dict):
        return bool(settings.get('propose_only_scan'))
    return bool(getattr(settings, 'propose_only_scan', False))


def enrich_game_with_steam(game, lookup_name=None):
    """Backfill Steam store metadata (VR perspectives, summary) onto a Game instance.

    The Steam HTTP lookup happens first and touches no DB state; the
    resulting metadata is then attached inside a SQLAlchemy savepoint
    (see `apply_enriched_metadata`) so a failure while attaching it
    cannot poison the caller's larger create/scan transaction.
    """
    name = lookup_name or getattr(game, 'name', None)
    if not name:
        result = {
            'applied': False,
            'is_vr': False,
            'perspectives_added': [],
            'reason': 'no_name',
        }
        print("Steam enrichment skipped (no_name); Steam VR: no")
        return result

    if game_indicates_vr(game):
        result = {
            'applied': False,
            'is_vr': True,
            'perspectives_added': [],
            'reason': 'already_vr',
        }
        print(f"Steam enrichment for '{name}': skipped (already_vr); Steam VR: yes")
        return result

    steam_data = fetch_steam_data(name)
    if not steam_data:
        result = {
            'applied': False,
            'is_vr': False,
            'perspectives_added': [],
            'reason': 'no_steam_data',
        }
        print(f"Steam enrichment for '{name}': skipped (no_steam_data); Steam VR: no")
        return result

    is_vr = bool(steam_data.get('is_vr'))
    existing_names = {
        normalize_perspective_name(getattr(p, 'name', '') or '')
        for p in (game.player_perspectives or [])
    }
    perspective_names = [
        normalize_perspective_name(n)
        for n in (steam_data.get('player_perspectives') or [])
    ]
    new_names = [name_ for name_ in perspective_names if name_ and name_ not in existing_names]

    enriched = {
        'summary': steam_data.get('summary'),
        'player_perspectives': new_names,
    }
    applied_ok = apply_enriched_metadata(
        game,
        enriched,
        perspective_factory=lambda persp_name: get_or_create_entity(PlayerPerspective, name=persp_name),
    )
    perspectives_added = new_names if applied_ok else []
    reason = None if applied_ok else 'enrichment_savepoint_rollback'

    result = {
        'applied': applied_ok,
        'is_vr': is_vr or VR_PERSPECTIVE_NAME in perspectives_added or game_indicates_vr(game),
        'perspectives_added': perspectives_added,
        'reason': reason,
        'steam_app_id': steam_data.get('steam_app_id'),
    }
    vr_label = 'yes' if result['is_vr'] else 'no'
    app_id = result.get('steam_app_id')
    app_txt = f"; steam_app_id={app_id}" if app_id else ''
    if applied_ok:
        added_txt = ', '.join(perspectives_added) if perspectives_added else 'none'
        print(
            f"Steam enrichment for '{name}': Steam VR: {vr_label}; "
            f"perspectives_added=[{added_txt}]{app_txt}"
        )
    else:
        print(
            f"Steam enrichment for '{name}': skipped ({reason}); Steam VR: {vr_label}"
        )
    return result


def create_game_instance(game_data, full_disk_path, folder_size_bytes, library_uuid):
    global settings
    settings = db.session.execute(select(GlobalSettings)).scalar_one_or_none()
    new_game = None  # Initialize new_game to None
    
    try:
        if not isinstance(game_data, dict):
            raise ValueError("create_game_instance game_data is not a dictionary")

        # Fetch library details using library_uuid
        library = db.session.execute(select(Library).filter_by(uuid=library_uuid)).scalar_one_or_none()
        if not library:
            print(f"Library with UUID {library_uuid} not found.")
            return None

        category_id = game_data.get('category')
        category_enum = category_mapping.get(category_id, None)
        status_id = game_data.get('status')
        status_enum = status_mapping.get(status_id, None)
        if 'videos' in game_data:
            video_urls = [f"https://www.youtube.com/watch?v={video['video_id']}" for video in game_data['videos']]
            videos_comma_separated = ','.join(video_urls)
        else:
            videos_comma_separated = ""
            
        print(f"create_game_instance Creating game instance for '{game_data.get('name')}' with UUID: {game_data.get('id')} in library '{library.name}' on platform '{library.platform.name}'.")
        new_game = Game(
            library_uuid=library_uuid,
            igdb_id=game_data['id'],
            name=game_data['name'],
            summary=game_data.get('summary'),
            storyline=game_data.get('storyline'),
            url=game_data.get('url'),
            first_release_date=datetime.fromtimestamp(game_data.get('first_release_date', 0), UTC) if game_data.get('first_release_date') else None,
            aggregated_rating=game_data.get('aggregated_rating'),
            aggregated_rating_count=game_data.get('aggregated_rating_count'),
            rating=game_data.get('rating'),
            rating_count=game_data.get('rating_count'),
            slug=game_data.get('slug'),
            status=status_enum,
            category=category_enum,
            total_rating=game_data.get('total_rating'),
            total_rating_count=game_data.get('total_rating_count'),
            video_urls=videos_comma_separated,
            full_disk_path=full_disk_path,
            size=folder_size_bytes,
            date_created=datetime.now(UTC),
            date_identified=datetime.now(UTC),
            steam_url='',
            times_downloaded=0
        )

        db.session.add(new_game)
        db.session.flush()
        try:
            from gametheca.utils.rom_hash import apply_file_hashes_to_game

            apply_file_hashes_to_game(new_game, full_disk_path)
        except Exception as hash_err:  # noqa: BLE001 — hashing must not fail the scan
            print(f"create_game_instance ROM hash skipped for '{new_game.name}': {hash_err}")
        try:
            from gametheca.utils.rom_language import apply_rom_language_fields

            apply_rom_language_fields(new_game, full_disk_path or new_game.name)
        except Exception as lang_err:  # noqa: BLE001
            print(f"create_game_instance ROM language parse skipped: {lang_err}")
        fetch_and_store_game_urls(new_game.uuid, game_data['id'])
        print(f"create_game_instance Finished processing game '{new_game.name}'. URLs (if any) have been fetched and stored.")
        
    except Exception as e:
        game_name = game_data.get('name') if isinstance(game_data, dict) else str(game_data)
        print(f"create_game_instance Error during the game instance creation or URL fetching for game '{game_name}'. Error: {e}")
    
    return new_game



def store_image_url_for_download(game_uuid, image_data, image_type='cover'):
    """Store image URL in database for later async download."""
    try:
        # Get the image URL from IGDB API
        if image_type == 'cover':
            cover_query = f'fields url; where id={image_data};'
            cover_response = make_igdb_api_request('https://api.igdb.com/v4/covers', cover_query)
            if cover_response and 'error' not in cover_response:
                download_url = cover_response[0].get('url')
                if download_url and not download_url.startswith(('http://', 'https://')):
                    download_url = 'https:' + download_url
                download_url = download_url.replace('/t_thumb/', '/t_original/')
            else:
                print(f"Failed to retrieve URL for cover ID {image_data}.")
                return
        
        elif image_type == 'screenshot':
            screenshot_query = f'fields url; where id={image_data};'
            response = make_igdb_api_request('https://api.igdb.com/v4/screenshots', screenshot_query)
            if response and 'error' not in response:
                download_url = response[0].get('url')
                if download_url and not download_url.startswith(('http://', 'https://')):
                    download_url = 'https:' + download_url
                download_url = download_url.replace('/t_thumb/', '/t_original/')
            else:
                print(f"Failed to retrieve URL for screenshot ID {image_data}.")
                return
        
        # Generate filename for when it gets downloaded
        file_name = secure_filename(f"{game_uuid}_{image_type}_{image_data}.jpg")
        
        # Store image metadata with URL for later download
        image = Image(
            game_uuid=game_uuid,
            image_type=image_type,
            url=file_name,  # Local filename when downloaded
            igdb_image_id=str(image_data),
            download_url=download_url,
            is_downloaded=False
        )
        db.session.add(image)
        
    except Exception as e:
        print(f"Error storing image URL for {image_type} {image_data}: {e}")


def smart_process_images_for_game(
    game_uuid,
    cover_data=None,
    screenshots_data=None,
    app=None,
    download_immediately=True,
):
    """Smart image processing that uses settings to determine single-thread vs turbo mode.

    When download_immediately is False, only IGDB image URLs are stored (is_downloaded=False)
    so a background worker can fetch files later without blocking identify.
    """
    if app is None:
        app = current_app._get_current_object()
    
    try:
        with app.app_context():
            # Get settings to determine processing mode
            from gametheca.models import GlobalSettings
            settings = db.session.execute(select(GlobalSettings)).scalar_one_or_none()
            
            # Store image URLs first (always)
            if cover_data:
                store_image_url_for_download(game_uuid, cover_data, 'cover')
            if screenshots_data:
                for screenshot_id in screenshots_data:
                    store_image_url_for_download(game_uuid, screenshot_id, 'screenshot')
            db.session.commit()

            if not download_immediately:
                return 0
            
            # Decide processing mode based on settings
            if settings and settings.use_turbo_image_downloads:
                # TURBO MODE - Download immediately with parallel processing
                threads = settings.turbo_download_threads or 8
                return download_images_for_game_turbo(game_uuid, app, max_workers=threads)
            else:
                # SINGLE THREAD MODE - Download one by one
                print(f"🐌 SINGLE THREAD: Processing images for game {game_uuid}")
                return download_images_for_game(game_uuid, app)
                
    except Exception as e:
        print(f"Error in smart image processing for game {game_uuid}: {e}")
        return 0


def queue_post_identify_enrichment(
    game_uuid,
    *,
    fetch_hltb=False,
    cover_data=None,
    screenshots_data=None,
    app=None,
    run_inline=False,
    compute_folder_size=True,
):
    """Run Steam / image / HLTB / folder-size work after the Game row is committed.

    Scan workers call this with run_inline=False so identify returns quickly.
    Tests can pass run_inline=True.
    """
    if app is None:
        app = current_app._get_current_object()

    def _worker():
        with app.app_context():
            try:
                game = db.session.execute(
                    select(Game).filter_by(uuid=game_uuid)
                ).scalar_one_or_none()
                if not game:
                    return

                if compute_folder_size and game.full_disk_path:
                    try:
                        size_bytes = get_folder_size_in_bytes_updates(game.full_disk_path)
                        game.size = size_bytes
                        db.session.commit()
                        print(
                            f"Deferred folder size for {game.name}: {format_size(size_bytes)}"
                        )
                    except Exception as size_err:  # noqa: BLE001
                        print(f"Deferred folder size failed for {game_uuid}: {size_err}")
                        try:
                            db.session.rollback()
                        except Exception:
                            pass
                        game = db.session.execute(
                            select(Game).filter_by(uuid=game_uuid)
                        ).scalar_one_or_none()
                        if not game:
                            return

                try:
                    enrich_game_with_steam(game, lookup_name=game.name)
                    db.session.commit()
                except Exception as steam_err:  # noqa: BLE001
                    print(f"Deferred Steam enrichment failed for {game_uuid}: {steam_err}")
                    try:
                        db.session.rollback()
                    except Exception:
                        pass

                try:
                    smart_process_images_for_game(
                        game_uuid,
                        cover_data=cover_data,
                        screenshots_data=screenshots_data,
                        app=app,
                        download_immediately=True,
                    )
                except Exception as img_err:  # noqa: BLE001
                    print(f"Deferred image processing failed for {game_uuid}: {img_err}")

                if fetch_hltb:
                    settings = db.session.execute(select(GlobalSettings)).scalar_one_or_none()
                    if settings and settings.enable_hltb_integration:
                        try:
                            from gametheca.utils.hltb import update_game_hltb_sync

                            update_game_hltb_sync(game_uuid, game.name)
                        except Exception as hltb_err:  # noqa: BLE001
                            print(f"Deferred HLTB failed for {game_uuid}: {hltb_err}")
            except Exception as enrich_err:  # noqa: BLE001
                print(f"Post-identify enrichment failed for {game_uuid}: {enrich_err}")
                try:
                    db.session.rollback()
                except Exception:
                    pass

    if run_inline:
        _worker()
        return None

    thread = threading.Thread(
        target=_worker,
        daemon=True,
        name=f'enrich-{str(game_uuid)[:8]}',
    )
    thread.start()
    return thread


def download_images_for_game_turbo(game_uuid, app=None, max_workers=5):
    """Download all pending images for a specific game using turbo mode."""
    if app is None:
        app = current_app._get_current_object()
        
    try:
        with app.app_context():
            pending_images = db.session.execute(select(Image).filter_by(game_uuid=game_uuid, is_downloaded=False)).scalars().all()
            
            if not pending_images:
                print(f"No pending images for game {game_uuid}.")
                return 0
            
            downloaded_count = 0
            successful_images = []
            failed_images = {}
            now = datetime.now(UTC)
            
            # Use ThreadPoolExecutor for parallel downloads
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                future_to_image = {
                    executor.submit(download_single_image_worker, image, app): image 
                    for image in pending_images
                }
                
                for future in as_completed(future_to_image):
                    image = future_to_image[future]
                    try:
                        result = future.result()
                        if result['success']:
                            successful_images.append(image.id)
                            downloaded_count += 1
                        else:
                            failed_images[image.id] = result.get('error') or 'Download failed for an unknown reason.'
                    except Exception as e:
                        print(f"❌ Failed downloading image {image.id}: {e}")
                        failed_images[image.id] = str(e)
            
            # Update database
            if successful_images:
                db.session.execute(
                    update(Image).filter(Image.id.in_(successful_images)).values(
                        is_downloaded=True, last_error=None, last_attempt_at=now
                    )
                )
            for image_id, error in failed_images.items():
                db.session.execute(
                    update(Image).filter(Image.id == image_id).values(last_error=error, last_attempt_at=now)
                )
            if successful_images or failed_images:
                db.session.commit()
            
            print(f"🚀 Downloaded {downloaded_count} images for game {game_uuid[:8]}... ({len(failed_images)} failed)")
            return downloaded_count
            
    except Exception as e:
        print(f"Error in turbo download for game {game_uuid}: {e}")
        try:
            db.session.rollback()
        except:
            pass
        return 0


def process_and_save_image(game_uuid, image_data, image_type='cover'):
    url = None
    save_path = None
    file_name = None

    if image_type == 'cover':
        cover_query = f'fields url; where id={image_data};'
        cover_response = make_igdb_api_request('https://api.igdb.com/v4/covers', cover_query)
        if cover_response and 'error' not in cover_response:
            url = cover_response[0].get('url')
            if url:
                file_name = secure_filename(f"{game_uuid}_cover_{image_data}.jpg")
            else:
                print(f"Cover URL not found for ID {image_data}.")
                return
        else:
            print(f"Failed to retrieve URL for cover ID {image_data}.")
            return

    elif image_type == 'screenshot':
        screenshot_query = f'fields url; where id={image_data};'
        response = make_igdb_api_request('https://api.igdb.com/v4/screenshots', screenshot_query)
        if response and 'error' not in response:
            url = response[0].get('url')
            if url:
                file_name = secure_filename(f"{game_uuid}_{image_data}.jpg")
            else:
                print(f"Screenshot URL not found for ID {image_data}.")
                return

    # Check if file_name is set before proceeding
    if not file_name:
        print("File name could not be set. Exiting.")
        return
    save_path = os.path.join(current_app.config['IMAGE_SAVE_PATH'], file_name)
    # Single download attempt (previously this ran twice for covers — once in
    # the branch above, once here — silently doubling IGDB requests). The
    # result is now recorded on the Image row instead of being discarded, so
    # the queue/UI can tell a real failure from a still-pending download.
    success, error = download_image(url, save_path)

    image = Image(
        game_uuid=game_uuid,
        image_type=image_type,
        url=file_name,
        download_url=url,
        is_downloaded=success,
        last_error=None if success else (error or 'Download failed for an unknown reason.'),
        last_attempt_at=datetime.now(UTC),
    )
    db.session.add(image)
    if not success:
        print(f"Failed to download {image_type} for game {game_uuid}: {image.last_error}")
    
    
def fetch_and_store_game_urls(game_uuid, igdb_id):
    try:
        website_query = f'fields url, category; where game={igdb_id};'        
        websites_response = make_igdb_api_request('https://api.igdb.com/v4/websites', website_query)
        
        if websites_response and 'error' not in websites_response:
            for website in websites_response:
                
                new_url = GameURL(
                    game_uuid=game_uuid,
                    url_type=website_category_to_string(website.get('category'), website.get('url')),
                    url=website.get('url')
                )
                db.session.add(new_url)
        else:
            print(f"No URLs found or failed to retrieve URLs for game IGDB ID {igdb_id}.")
    except Exception as e:
        print(f"Exception while fetching/storing URLs for game UUID {game_uuid}, IGDB ID {igdb_id}: {e}")
        

    
def search_igdb_for_game(search_name, platform_id, limit=10):
    """
    Search IGDB for games matching name (and optional platform).
    Returns a list of game dicts, or None if the API errors / returns empty.
    """
    query_fields = """fields id, name, cover, summary, url, release_dates.date, platforms.name, genres.name, themes.name, game_modes.name,
                      screenshots, videos.video_id, first_release_date, aggregated_rating, involved_companies, player_perspectives.name,
                      aggregated_rating_count, rating, rating_count, slug, status, category, total_rating,
                      total_rating_count;"""
    safe_limit = max(1, min(int(limit), 20))
    query_filter = f'search "{search_name}"; limit {safe_limit};'
    if platform_id is not None:
        query_filter += f' where platforms = ({platform_id});'

    response_json = make_igdb_api_request(current_app.config['IGDB_API_ENDPOINT'], query_fields + query_filter)

    if 'error' not in response_json and response_json:
        return response_json
    return None


def fetch_game_by_igdb_id(igdb_id):
    """
    Fetch game data from IGDB API by exact IGDB ID.

    Args:
        igdb_id: IGDB game ID

    Returns:
        list: IGDB API response (list with one game dict), or None on error
    """
    from gametheca.utils.igdb_api import make_igdb_api_request

    try:
        query = f"""
            fields name, summary, storyline, url, slug, first_release_date,
                   aggregated_rating, aggregated_rating_count, rating, rating_count,
                   total_rating, total_rating_count, status, category,
                   cover.url, screenshots.url, videos.video_id,
                   genres.name, themes.name, game_modes.name, platforms.name,
                   player_perspectives.name, involved_companies;
            where id = {igdb_id};
            limit 1;
        """

        response = make_igdb_api_request(current_app.config['IGDB_API_ENDPOINT'], query)

        if response and 'error' not in response and len(response) > 0:
            print(f"Fetched game by ID {igdb_id}: {response[0].get('name')}")
            return response
        else:
            print(f"Failed to fetch game by ID {igdb_id}: {response}")
            return None

    except Exception as e:
        print(f"Error fetching game by IGDB ID {igdb_id}: {e}")
        return None


def retrieve_and_save_game(
    game_name,
    full_disk_path,
    scan_job_id=None,
    library_uuid=None,
    fetch_hltb=False,
    settings=None,
    defer_enrichment=None,
):
    # print(f"retrieve_and_save_game Retrieving and saving game: {game_name} on {full_disk_path} to library with UUID {library_uuid}.")
    from gametheca.utils.local_metadata import read_local_metadata
    from gametheca.utils.event_logging import log_system_event
    from flask import flash

    # Scan workers pass scan_job_id — defer Steam/images/HLTB so identify commits fast.
    if defer_enrichment is None:
        defer_enrichment = scan_job_id is not None

    library = db.session.execute(select(Library).filter_by(uuid=library_uuid)).scalar_one_or_none()
    if not library:
        print(f"retrieve_and_save_game Library with UUID {library_uuid} not found.")
        return None


    existing_game_by_path = check_existing_game_by_path(full_disk_path)
    if existing_game_by_path:
        return existing_game_by_path

    # Load settings once if not provided
    # Settings can be either a dict (from threaded scan) or a SQLAlchemy object
    if settings is None:
        settings_obj = db.session.execute(select(GlobalSettings)).scalar_one_or_none()
        # Convert to dict for consistent handling
        settings = {
            'use_local_metadata': settings_obj.use_local_metadata if settings_obj else False,
            'write_local_metadata': settings_obj.write_local_metadata if settings_obj else False,
            'use_local_images': settings_obj.use_local_images if settings_obj else False,
            'local_metadata_filename': settings_obj.local_metadata_filename if settings_obj else 'gametheca.json',
            'propose_only_scan': settings_obj.propose_only_scan if settings_obj else False,
        }
    elif not isinstance(settings, dict):
        # If it's a SQLAlchemy object, convert to dict
        settings = {
            'use_local_metadata': settings.use_local_metadata,
            'write_local_metadata': settings.write_local_metadata,
            'use_local_images': settings.use_local_images,
            'local_metadata_filename': settings.local_metadata_filename or 'gametheca.json',
            'propose_only_scan': getattr(settings, 'propose_only_scan', False),
        }

    # PRIORITY 1: Check for local metadata file (NEW!)
    if settings and settings.get('use_local_metadata'):
        print(f"🔍 [LOCAL METADATA] Checking for existing metadata file in: {full_disk_path}")
        local_metadata = read_local_metadata(full_disk_path,
                                             settings.get('local_metadata_filename', 'gametheca.json'))
        if local_metadata and 'igdb_id' in local_metadata:
            igdb_id = local_metadata['igdb_id']
            print(f"✅ LOCAL METADATA: Found IGDB ID {igdb_id} in {full_disk_path}")

            # Fetch game data directly by IGDB ID
            response_json = fetch_game_by_igdb_id(igdb_id)

            if response_json and 'error' not in response_json and len(response_json) > 0:
                print(f"✅ Successfully fetched game from local metadata: {response_json[0].get('name')}")

                # Check for duplicate
                existing_game_with_same_igdb_id = db.session.execute(
                    select(Game).filter(Game.igdb_id == igdb_id, Game.full_disk_path != full_disk_path)
                ).scalar_one_or_none()

                if existing_game_with_same_igdb_id:
                    return handle_existing_igdb_collision(
                        existing_game=existing_game_with_same_igdb_id,
                        igdb_id=igdb_id,
                        full_disk_path=full_disk_path,
                        game_name=game_name,
                        scan_job_id=scan_job_id,
                        library_uuid=library_uuid,
                        candidates=response_json,
                    )

                # Create game from IGDB data (continue with existing logic at line 472)
                nfo_content = read_first_nfo_content(full_disk_path)
                # Scan path: defer full tree walk — large NAS/Unraid folders block identify for minutes.
                if defer_enrichment:
                    folder_size_bytes = 0
                    print(f"Deferring folder size walk for scan identify: {full_disk_path}")
                else:
                    folder_size_bytes = get_folder_size_in_bytes_updates(full_disk_path)
                    print(f"Folder size for {full_disk_path}: {format_size(folder_size_bytes)}")
                new_game = create_game_instance(
                    game_data=response_json[0],
                    full_disk_path=full_disk_path,
                    folder_size_bytes=folder_size_bytes,
                    library_uuid=library.uuid
                )

                if new_game is None:
                    print(f"Failed to create game instance from local metadata for {game_name}. Skipping further processing.")
                    return None

                # Process genres, themes, etc. (same as existing code from line 481 onward)
                if 'genres' in response_json[0]:
                    for genre_data in response_json[0]['genres']:
                        genre_name = genre_data['name']
                        genre = get_or_create_entity(Genre, name=genre_name)
                        new_game.genres.append(genre)

                if 'involved_companies' in response_json[0]:
                    involved_company_ids = response_json[0]['involved_companies']
                    if involved_company_ids:
                        enumerate_companies(new_game, new_game.igdb_id, involved_company_ids)
                    else:
                        print("No involved companies found for game from local metadata.")

                if 'themes' in response_json[0]:
                    for theme_data in response_json[0]['themes']:
                        theme_name = theme_data['name']
                        theme = get_or_create_entity(Theme, name=theme_name)
                        new_game.themes.append(theme)

                if 'game_modes' in response_json[0]:
                    for game_mode_data in response_json[0]['game_modes']:
                        game_mode_name = game_mode_data['name']
                        game_mode = get_or_create_entity(GameMode, name=game_mode_name)
                        new_game.game_modes.append(game_mode)

                if 'platforms' in response_json[0]:
                    for platform_data in response_json[0]['platforms']:
                        platform_name = platform_data['name']
                        platform = get_or_create_entity(Platform, name=platform_name)
                        new_game.platforms.append(platform)

                if 'player_perspectives' in response_json[0]:
                    for perspective_data in response_json[0]['player_perspectives']:
                        perspective_name = perspective_data['name']
                        perspective = get_or_create_entity(PlayerPerspective, name=perspective_name)
                        new_game.player_perspectives.append(perspective)

                if not defer_enrichment:
                    enrich_game_with_steam(new_game, lookup_name=new_game.name)

                if 'videos' in response_json[0]:
                    video_urls = [f"https://www.youtube.com/embed/{video['video_id']}" for video in response_json[0]['videos']]
                    videos_comma_separated = ','.join(video_urls)
                    new_game.video_urls = videos_comma_separated

                db.session.commit()
                print(f"Processing images for game: {new_game.name}")
                # Use smart image processing
                cover_data = response_json[0].get('cover', {}).get('id') if response_json[0].get('cover') else None
                screenshots_data = [s['id'] for s in response_json[0].get('screenshots', [])]
                if defer_enrichment:
                    queue_post_identify_enrichment(
                        new_game.uuid,
                        fetch_hltb=fetch_hltb,
                        cover_data=cover_data,
                        screenshots_data=screenshots_data,
                    )
                else:
                    smart_process_images_for_game(new_game.uuid, cover_data, screenshots_data)

                    if fetch_hltb:
                        # Fetch HLTB data if requested
                        from gametheca.utils.hltb import update_game_hltb_sync
                        update_game_hltb_sync(new_game.uuid, new_game.name)

                # Now write the metadata file if setting is enabled
                if settings and settings.get('write_local_metadata'):
                    print(f"💾 [LOCAL METADATA] Writing metadata file for '{new_game.name}' (from existing local metadata)")
                    from gametheca.utils.local_metadata import write_local_metadata
                    write_success = write_local_metadata(
                        full_disk_path=full_disk_path,
                        igdb_id=igdb_id,
                        game_title=new_game.name,
                        manually_verified=True,
                        filename=settings.get('local_metadata_filename', 'gametheca.json')
                    )
                    if not write_success:
                        print("⚠️ [LOCAL METADATA] Failed to write metadata file (already exists or permission issue)")

                return new_game
            else:
                # Failed to fetch from IGDB - check if it's a connectivity issue
                error_msg = f"⚠️ Local metadata has IGDB ID {igdb_id} but failed to fetch from API."
                print(error_msg)
                log_system_event(
                    f"Failed to fetch game data for IGDB ID {igdb_id} from local metadata at {full_disk_path}. Check internet connection or IGDB API status.",
                    event_type='metadata',
                    event_level='warning'
                )
                # Fall through to normal search below
        else:
            print("📝 [LOCAL METADATA] No existing metadata file found, will attempt IGDB search")

    platform_id = PLATFORM_IDS.get(library.platform.name)

    # PRIORITY 2: Search IGDB API by folder name (existing code)
    # Prefer Steam App ID title hint when folder name contains (digits)
    raw_folder_label = os.path.basename(full_disk_path.rstrip('\\/'))
    parsed_label = parse_game_label(raw_folder_label)
    steam_title = None
    if parsed_label.get('steam_app_id'):
        steam_title = fetch_steam_title_by_app_id(parsed_label['steam_app_id'])
        if steam_title:
            print(f"Steam App ID {parsed_label['steam_app_id']} resolved to '{steam_title}'")

    # Prefer parse_game_label cleaned folder basename for variants (keeps apostrophes,
    # drops Steam IDs / repack / version-bracket junk). Fall back to scan-cleaned name.
    variant_base = (parsed_label.get('cleaned_name') or '').strip() or game_name
    search_variants = generate_goty_variants(variant_base)
    if game_name and game_name.strip():
        for extra in generate_goty_variants(game_name):
            if extra not in search_variants:
                search_variants.append(extra)
    if steam_title and steam_title not in search_variants:
        search_variants = [steam_title] + [v for v in search_variants if v != steam_title]
    print(f"Generated search variants for '{variant_base}': {search_variants}")

    response_json = None
    successful_search_name = None
    selected_game = None
    high_confidence_candidates = None
    last_low_confidence_candidates = None
    last_low_confidence_search = None

    # Try each variant until we find a high-confidence match
    for search_name in search_variants:
        print(f"Trying IGDB search with: '{search_name}'")
        candidates = search_igdb_for_game(search_name, platform_id, limit=10)
        if not candidates:
            print(f"No match found for variant: '{search_name}'")
            continue

        best, confidence = select_best_match(search_name, candidates, steam_title=steam_title)
        ranked = rank_candidates(search_name, candidates, steam_title=steam_title)
        print(
            f"IGDB candidates for '{search_name}': "
            + ", ".join(f"{c.get('name')}={c.get('match_score'):.2f}" for c in ranked[:5])
            + f" → confidence={confidence}"
        )

        if confidence == 'high' and best is not None:
            selected_game = best
            successful_search_name = search_name
            response_json = [best]
            high_confidence_candidates = candidates
            print(f"High-confidence match with search variant: '{search_name}' → {best.get('name')}")
            break

        last_low_confidence_candidates = candidates
        last_low_confidence_search = search_name
        print(f"Low-confidence / ambiguous results for '{search_name}' — not auto-importing")

    # PROPOSE-ONLY MODE: never auto-import, even on a high-confidence match.
    # Write the proposal sidecar for admin review and stop short of creating a Game.
    if selected_game is not None and is_propose_only_scan(settings):
        print(
            f"🧪 [PROPOSE-ONLY] High-confidence match found for '{game_name}' "
            f"(→ {selected_game.get('name')}) but propose_only_scan is enabled — "
            "writing proposal instead of importing."
        )
        try:
            proposal = build_match_proposal(
                game_name,
                high_confidence_candidates or [selected_game],
                steam_title=steam_title,
                confidence='high',
            )
            if write_match_proposal(full_disk_path, proposal):
                print(
                    f"📝 [PROPOSE-ONLY] Wrote high-confidence match proposal for '{successful_search_name}' "
                    f"→ {os.path.join(full_disk_path, 'gametheca.proposal.json')}"
                )
        except Exception as proposal_err:
            print(f"⚠️ Failed to write high-confidence match proposal for {full_disk_path}: {proposal_err}")
        return None

    if response_json and 'error' not in response_json and selected_game is not None:
        igdb_id = selected_game.get('id')
        if successful_search_name != game_name:
            print(f"Found game '{game_name}' using search variant '{successful_search_name}' with IGDB ID {igdb_id}")
        else:
            print(f"Found game {game_name} with IGDB ID {igdb_id}")

        # Check for existing game with the same IGDB ID but different folder path
        existing_game_with_same_igdb_id = db.session.execute(select(Game).filter(Game.igdb_id == igdb_id, Game.full_disk_path != full_disk_path)).scalar_one_or_none()
        if existing_game_with_same_igdb_id:
            return handle_existing_igdb_collision(
                existing_game=existing_game_with_same_igdb_id,
                igdb_id=igdb_id,
                full_disk_path=full_disk_path,
                game_name=game_name,
                scan_job_id=scan_job_id,
                library_uuid=library_uuid,
                candidates=high_confidence_candidates or [selected_game],
                steam_title=steam_title,
            )
        else:
            nfo_content = read_first_nfo_content(full_disk_path)
            # Scan path: defer full tree walk — large NAS/Unraid folders block identify for minutes.
            if defer_enrichment:
                folder_size_bytes = 0
                print(f"Deferring folder size walk for scan identify: {full_disk_path}")
            else:
                folder_size_bytes = get_folder_size_in_bytes_updates(full_disk_path)
                print(f"Folder size for {full_disk_path}: {format_size(folder_size_bytes)}")
            new_game = create_game_instance(game_data=selected_game, full_disk_path=full_disk_path, folder_size_bytes=folder_size_bytes, library_uuid=library.uuid)
            
            if new_game is None:
                print(f"Failed to create game instance for {game_name}. Skipping further processing.")
                return None
                    
            if 'genres' in selected_game:
                for genre_data in selected_game['genres']:
                    genre_name = genre_data['name']
                    genre = get_or_create_entity(Genre, name=genre_name)
                    new_game.genres.append(genre)

            if 'involved_companies' in selected_game:
                involved_company_ids = selected_game['involved_companies']
                if involved_company_ids:
                    enumerate_companies(new_game, new_game.igdb_id, involved_company_ids)
                else:
                    print(f"No involved companies found for {game_name}.")

            if 'themes' in selected_game:
                for theme_data in selected_game['themes']:
                    theme_name = theme_data['name']
                    theme = get_or_create_entity(Theme, name=theme_name)
                    new_game.themes.append(theme)

            if 'game_modes' in selected_game:
                for game_mode_data in selected_game['game_modes']:
                    game_mode_name = game_mode_data['name']
                    game_mode = get_or_create_entity(GameMode, name=game_mode_name)
                    new_game.game_modes.append(game_mode)

            if 'platforms' in selected_game:
                for platform_data in selected_game['platforms']:
                    platform_name = platform_data['name']
                    platform = get_or_create_entity(Platform, name=platform_name)
                    new_game.platforms.append(platform)
                    
            if 'player_perspectives' in selected_game:
                for perspective_data in selected_game['player_perspectives']:
                    perspective_name = perspective_data['name']
                    perspective = get_or_create_entity(PlayerPerspective, name=perspective_name)
                    new_game.player_perspectives.append(perspective)

            if not defer_enrichment:
                enrich_game_with_steam(new_game, lookup_name=new_game.name)

            if 'videos' in selected_game:
                video_urls = [f"https://www.youtube.com/embed/{video['video_id']}" for video in selected_game['videos']]
                videos_comma_separated = ','.join(video_urls)
                new_game.video_urls = videos_comma_separated
            
            db.session.commit()
            print(f"Processing images for game: {new_game.name}")
            # Use smart image processing that respects turbo/single-thread settings
            cover_data = selected_game.get('cover') 
            screenshots_data = selected_game.get('screenshots', [])
            if defer_enrichment:
                queue_post_identify_enrichment(
                    new_game.uuid,
                    fetch_hltb=fetch_hltb,
                    cover_data=cover_data,
                    screenshots_data=screenshots_data,
                )
            else:
                smart_process_images_for_game(new_game.uuid, cover_data, screenshots_data)
            try:
                new_game.nfo_content = nfo_content
                for column in new_game.__table__.columns:
                    getattr(new_game, column.name)
                db.session.commit()
                print(f"Game and its images saved successfully : {new_game.name}.")

                # Write local metadata file if enabled (for newly identified games)
                # Use the settings dict we already have (no DB query needed)
                if settings and settings.get('write_local_metadata'):
                    print(f"💾 [LOCAL METADATA] Writing metadata file for newly identified game '{new_game.name}'")
                    from gametheca.utils.local_metadata import write_local_metadata
                    write_success = write_local_metadata(
                        full_disk_path=new_game.full_disk_path,
                        igdb_id=new_game.igdb_id,
                        game_title=new_game.name,
                        manually_verified=False,  # Auto-identified during scan
                        filename=settings.get('local_metadata_filename', 'gametheca.json')
                    )
                    if write_success:
                        print(f"✅ [LOCAL METADATA] Successfully wrote metadata file for '{new_game.name}'")
                    else:
                        print(f"⚠️ [LOCAL METADATA] Failed to write metadata file for '{new_game.name}'")

                notify_admins_new_game(new_game.uuid, new_game.name)

                # Fetch HowLongToBeat data if enabled (sync path only; deferred when scanning)
                if not defer_enrichment:
                    hltb_settings = db.session.execute(select(GlobalSettings)).scalar_one_or_none()
                    if fetch_hltb and hltb_settings and hltb_settings.enable_hltb_integration:
                        try:
                            from gametheca.utils.hltb import update_game_hltb_sync
                            print(f"Fetching HowLongToBeat data for '{new_game.name}'...")
                            update_game_hltb_sync(new_game.uuid, new_game.name)
                        except Exception as e:
                            print(f"Failed to fetch HLTB data for '{new_game.name}': {e}")
                            # Don't fail the scan if HLTB fetch fails

            except IntegrityError as e: 
                db.session.rollback()
                print(f"Failed to save game due to a database error: {e}")
                if has_request_context():
                    flash("Failed to save game due to a duplicate entry.")
                else:
                    print("Failed to save game due to a duplicate entry.")
            return new_game
    else:
        if response_json and 'error' in response_json:
            # Check specifically for authentication error
            if response_json.get('error') == 'Failed to retrieve access token':
                error_msg = 'IGDB API Authentication Failed'
                if scan_job_id:
                    # Column-only update — avoid loading a ScanJob ORM row that could
                    # clobber folders_success/failed from the scan coordinator.
                    db.session.execute(
                        update(ScanJob)
                        .where(ScanJob.id == scan_job_id)
                        .values(
                            error_message=error_msg,
                            status='Failed',
                            is_enabled=False,
                        )
                    )
                    db.session.commit()
                
                log_system_event(f"IGDB API Authentication Failed: {response_json.get('error')}", 
                                 event_type='scan', event_level='error')
                return None
            
        print(f"No match found: {game_name} in library {library.name} on platform {library.platform.name}.")
        if last_low_confidence_candidates:
            try:
                proposal = build_match_proposal(
                    game_name,
                    last_low_confidence_candidates,
                )
                if write_match_proposal(full_disk_path, proposal):
                    print(
                        f"📝 Wrote low-confidence match proposal for '{last_low_confidence_search}' "
                        f"→ {os.path.join(full_disk_path, 'gametheca.proposal.json')}"
                    )
            except Exception as proposal_err:
                print(f"⚠️ Failed to write match proposal for {full_disk_path}: {proposal_err}")
        if has_request_context():
            flash("No game data found for the given name.")
        else:
            print("No game data found for the given name.")
        return None
    
def check_existing_game_by_path(full_disk_path):
    """
    Checks if a game already exists in the library by its disk path.

    Parameters:
    - full_disk_path: The full disk path of the game to check.

    Returns:
    - The existing Game object if found, None otherwise.
    """
    existing_game_by_path = db.session.execute(select(Game).filter_by(full_disk_path=full_disk_path)).scalar_one_or_none()
    if existing_game_by_path:
        print(f"Skipping {existing_game_by_path.name} on {full_disk_path} (path already in library).")
        return existing_game_by_path 
    return None

def check_existing_game_by_igdb_id(igdb_id):
    return db.session.execute(select(Game).filter_by(igdb_id=igdb_id)).scalar_one_or_none()


def enumerate_companies(game_instance, igdb_game_id, involved_company_ids):
    if not involved_company_ids:
        print("No company IDs provided for enumeration.")
        return

    company_ids_str = ','.join(map(str, involved_company_ids))
    # print(f"Company IDs: {company_ids_str}")

    try:
        response_json = make_igdb_api_request(
            "https://api.igdb.com/v4/involved_companies",
            f"""fields company.name, developer, publisher, game;
                where game={igdb_game_id} & id=({company_ids_str});"""
        )

        if not isinstance(response_json, list):
            print(f"Unexpected response structure: {response_json}")
            return

        for company_data in response_json:
            company_info = company_data.get('company')
            if not isinstance(company_info, dict) or 'name' not in company_info:
                print(f"Unexpected company data structure or missing name: {company_data}")
                continue  # Skip to the next

            company_name = company_info['name'][:50] 
            is_developer = company_data.get('developer', False)
            is_publisher = company_data.get('publisher', False)

            if is_developer:
                # print(f"Company {company_name} is a developer.")
                developer = get_or_create_entity(Developer, name=company_name)

                game_instance.developer = developer

            if is_publisher:
                # print(f"Company {company_name} is a publisher.")
                publisher = get_or_create_entity(Publisher, name=company_name)
                game_instance.publisher = publisher
    except Exception as e:
        print(f"Failed to enumerate companies due to an error: {e}")
        return

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"Failed to enumerate companies due to a database error: {e}")
        
def get_game_by_uuid(game_uuid):
    log_system_event(
        f"Searching for game UUID: {game_uuid[:8]}...",
        event_type='game',
        event_level='debug'
    )
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalar_one_or_none()
    if game:
        log_system_event(
            f"Game '{game.name}' (ID: {game.id}, IGDB: {game.igdb_id}) found for UUID search",
            event_type='game',
            event_level='debug'
        )
        return game
    else:
        log_system_event(
            f"Game not found for UUID: {game_uuid[:8]}...",
            event_type='game',
            event_level='debug'
        )
        return None
    
def remove_from_lib(game_uuid):
    """
    Remove a game from the library and clean up associated files.
    
    Args:
        game_uuid (str): UUID of the game to remove
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Get the game
        game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalar_one_or_none()
        if not game:
            print(f"Game with UUID {game_uuid} not found")
            return False
            
        # Delete associated images from disk
        delete_game_images(game_uuid)
        
        # Delete the game (cascade will handle related records)
        db.session.delete(game)
        db.session.commit()
        
        log_system_event(f"Game deleted: {game.name} (UUID: {game_uuid})", event_type='game', event_level='information')
        print(f"Successfully removed game {game.name} (UUID: {game_uuid}) from library")
        return True
        
    except Exception as e:
        db.session.rollback()
        print(f"Error removing game from library: {str(e)}")
        return False
    

def delete_game(game_identifier):
    """Delete a game by UUID or Game object.""" 
    game_to_delete = None
    if isinstance(game_identifier, Game):
        game_to_delete = game_identifier
        game_uuid_str = game_to_delete.uuid
    else:
        try:
            # Parse without forcing version=4: uuid.UUID(x, version=4) rewrites the
            # version/variant bits, so a non-v4 UUID would be looked up under a
            # different string and never be found.
            game_uuid_str = str(uuid.UUID(game_identifier))
        except (ValueError, AttributeError, TypeError):
            print(f"Invalid UUID format: {game_identifier}")
            abort(404)
        game_to_delete = db.session.execute(select(Game).filter_by(uuid=game_uuid_str)).scalar_one_or_none()
        if game_to_delete is None:
            print(f"No game found with UUID {game_uuid_str}")
            abort(404)

    try:
        print(f"Found game to delete: {game_to_delete}")
        db.session.execute(delete(GameURL).filter_by(game_uuid=game_uuid_str))
        delete_associations_for_game(game_to_delete)
        # game_developer_association has a FK to games but no relationship on the
        # Game model, so the ORM never clears it. Rows left here (from older
        # schema versions) block the delete with a FK violation.
        db.session.execute(
            game_developer_association.delete().where(
                game_developer_association.c.game_id == game_to_delete.id
            )
        )
        delete_game_images(game_uuid_str)
        db.session.delete(game_to_delete)
        db.session.commit()
        print(f'Deleted game with UUID: {game_uuid_str}')
    except Exception as e:
        db.session.rollback()
        print(f'Error deleting game with UUID {game_uuid_str}: {e}')
        if has_request_context():
            flash(f'Error deleting game: {e}', 'error')
        # Re-raise so the caller reports the real failure. Swallowing this made
        # /delete_game return "success" while the game was still in the library.
        raise


def download_pending_images(batch_size=10, delay_between_downloads=1, app=None):
    """Download images that are queued but not yet downloaded."""
    if app is None:
        app = current_app._get_current_object()
        
    try:
        with app.app_context():
            # Get pending images
            pending_images = db.session.execute(select(Image).filter_by(is_downloaded=False).limit(batch_size)).scalars().all()
            
            if not pending_images:
                print("No pending images to download.")
                return 0
            
            downloaded_count = 0
            failed_count = 0
            for image in pending_images:
                try:
                    image.last_attempt_at = datetime.now(UTC)

                    if not image.download_url:
                        image.last_error = 'No download URL on record for this image.'
                        failed_count += 1
                        print(f"No download URL for image {image.id}, skipping.")
                        continue

                    # Download the image
                    save_path = os.path.join(app.config['IMAGE_SAVE_PATH'], image.url)

                    from gametheca.utils.functions import download_image
                    success, error = download_image(image.download_url, save_path)

                    if success:
                        image.is_downloaded = True
                        image.last_error = None
                        downloaded_count += 1
                        print(f"Downloaded {image.image_type} for game {image.game_uuid}: {image.url}")
                    else:
                        image.last_error = error or 'Download failed for an unknown reason.'
                        failed_count += 1
                        print(f"Failed to download image {image.id}: {image.last_error}")

                    # Small delay to avoid overwhelming the server
                    if delay_between_downloads > 0:
                        time.sleep(delay_between_downloads)
                        
                except Exception as e:
                    image.last_error = f"Unexpected error: {e}"
                    failed_count += 1
                    print(f"Error downloading image {image.id}: {e}")
                    continue
            
            # Commit all changes
            db.session.commit()
            print(f"Downloaded {downloaded_count} images ({failed_count} failed).")
            return downloaded_count
            
    except Exception as e:
        print(f"Error in batch image download: {e}")
        try:
            db.session.rollback()
        except:
            pass
        return 0


def start_background_image_downloader(interval_seconds=60):
    """Start a background thread that periodically downloads pending images."""
    # Capture the current app instance
    app = current_app._get_current_object()
    
    def background_worker():
        from gametheca.utils.shutdown import should_continue_processing, sleep_interruptible
        while should_continue_processing():
            try:
                download_pending_images(batch_size=20, delay_between_downloads=0.5, app=app)
                # Use interruptible sleep to allow quick shutdown
                if not sleep_interruptible(interval_seconds):
                    break  # Shutdown requested during sleep
            except Exception as e:
                print(f"Background image downloader error: {e}")
                if not sleep_interruptible(interval_seconds):
                    break  # Shutdown requested during error sleep
        print("🛑 Background image downloader stopped due to shutdown request")
    
    thread = threading.Thread(target=background_worker, daemon=True)
    thread.start()
    print(f"Background image downloader started (interval: {interval_seconds}s)")
    return thread


def download_images_for_game(game_uuid, app=None):
    """Download all pending images for a specific game immediately."""
    if app is None:
        app = current_app._get_current_object()
        
    try:
        with app.app_context():
            pending_images = db.session.execute(select(Image).filter_by(game_uuid=game_uuid, is_downloaded=False)).scalars().all()
            
            if not pending_images:
                print(f"No pending images for game {game_uuid}.")
                return 0
            
            downloaded_count = 0
            for image in pending_images:
                try:
                    image.last_attempt_at = datetime.now(UTC)

                    if not image.download_url:
                        image.last_error = 'No download URL on record for this image.'
                        continue

                    save_path = os.path.join(app.config['IMAGE_SAVE_PATH'], image.url)

                    from gametheca.utils.functions import download_image
                    success, error = download_image(image.download_url, save_path)

                    if success:
                        image.is_downloaded = True
                        image.last_error = None
                        downloaded_count += 1
                    else:
                        image.last_error = error or 'Download failed for an unknown reason.'
                        print(f"Failed to download image {image.id}: {image.last_error}")

                except Exception as e:
                    image.last_error = f"Unexpected error: {e}"
                    print(f"Error downloading image {image.id}: {e}")
                    continue
            
            db.session.commit()
            print(f"Downloaded {downloaded_count} images for game {game_uuid}.")
            return downloaded_count
            
    except Exception as e:
        print(f"Error downloading images for game {game_uuid}: {e}")
        try:
            db.session.rollback()
        except:
            pass
        return 0


def download_single_image_worker(image, app):
    """Worker function to download a single image - designed for parallel execution."""
    try:
        if not image.download_url:
            return {'success': False, 'image_id': image.id, 'error': 'No download URL on record for this image.'}

        save_path = os.path.join(app.config['IMAGE_SAVE_PATH'], image.url)

        from gametheca.utils.functions import download_image
        success, error = download_image(image.download_url, save_path)

        if not success:
            return {'success': False, 'image_id': image.id, 'error': error or 'Download failed for an unknown reason.'}

        return {
            'success': True, 
            'image_id': image.id, 
            'game_uuid': image.game_uuid,
            'image_type': image.image_type,
            'url': image.url
        }
        
    except Exception as e:
        return {'success': False, 'image_id': image.id, 'error': str(e)}


def turbo_download_images(batch_size=100, max_workers=5, app=None):
    """MAXIMUM SPEED parallel image downloading with multiple threads."""
    if app is None:
        app = current_app._get_current_object()
    
    try:
        with app.app_context():
            # Get pending images
            pending_images = db.session.execute(select(Image).filter_by(is_downloaded=False).limit(batch_size)).scalars().all()
            
            if not pending_images:
                return {'downloaded': 0, 'failed': 0, 'message': 'No pending images'}
            
            downloaded_count = 0
            failed_count = 0
            successful_images = []
            failed_images = {}
            now = datetime.now(UTC)
            
            # Create thread pool and submit all download tasks
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                # Submit all download jobs
                future_to_image = {
                    executor.submit(download_single_image_worker, image, app): image 
                    for image in pending_images
                }
                
                # Process completed downloads as they finish
                for future in as_completed(future_to_image):
                    image = future_to_image[future]
                    try:
                        result = future.result()
                        
                        if result['success']:
                            successful_images.append(image.id)
                            downloaded_count += 1
                        else:
                            failed_count += 1
                            failed_images[image.id] = result.get('error') or 'Download failed for an unknown reason.'
                            print(f"❌ Failed to download image {result['image_id']}: {result['error']}")
                            
                    except Exception as e:
                        failed_count += 1
                        failed_images[image.id] = str(e)
                        print(f"❌ Exception downloading image {image.id}: {e}")
            
            # Update database - mark successful downloads as completed
            if successful_images:
                db.session.execute(
                    update(Image).filter(Image.id.in_(successful_images)).values(
                        is_downloaded=True, last_error=None, last_attempt_at=now
                    )
                )
            for image_id, error in failed_images.items():
                db.session.execute(
                    update(Image).filter(Image.id == image_id).values(last_error=error, last_attempt_at=now)
                )
            if successful_images or failed_images:
                db.session.commit()
            
            result_message = f"🚀 Downloaded {downloaded_count} images ({failed_count} failed)" if failed_count > 0 else f"🚀 Downloaded {downloaded_count} images"
            if downloaded_count > 0:
                print(result_message)
            
            return {
                'downloaded': downloaded_count,
                'failed': failed_count,
                'message': result_message
            }
            
    except Exception as e:
        print(f"Error in turbo download: {e}")
        try:
            db.session.rollback()
        except:
            pass
        return {'downloaded': 0, 'failed': 0, 'message': f'Error: {str(e)}'}


def start_turbo_background_downloader(interval_seconds=30, max_workers=4, batch_size=50):
    """Start a HIGH SPEED background downloader with parallel processing."""
    app = current_app._get_current_object()
    
    def turbo_background_worker():
        from gametheca.utils.shutdown import should_continue_processing, sleep_interruptible
        print(f"🔥 TURBO BACKGROUND DOWNLOADER STARTED - {max_workers} workers, {batch_size} batch, {interval_seconds}s interval")
        while should_continue_processing():
            try:
                result = turbo_download_images(batch_size=batch_size, max_workers=max_workers, app=app)
                if result['downloaded'] > 0:
                    print(f"🚀 Background turbo download: {result['message']}")
                # Use interruptible sleep to allow quick shutdown
                if not sleep_interruptible(interval_seconds):
                    break  # Shutdown requested during sleep
            except Exception as e:
                print(f"Turbo background downloader error: {e}")
                if not sleep_interruptible(interval_seconds):
                    break  # Shutdown requested during error sleep
        print("🛑 Turbo background downloader stopped due to shutdown request")
    
    thread = threading.Thread(target=turbo_background_worker, daemon=True)
    thread.start()
    print("🔥 TURBO BACKGROUND DOWNLOADER LAUNCHED!")
    return thread


def find_missing_images_for_library(library_uuid=None, app=None):
    """
    Find all images that have URLs in the database but are missing from disk.
    
    Parameters:
    - library_uuid: UUID of library to check (optional, checks all games if None)
    - app: Flask app context (optional)
    
    Returns:
    - Dictionary with statistics and list of missing images
    """
    if app is None:
        app = current_app._get_current_object()
    
    try:
        with app.app_context():
            # Build query based on library filter
            if library_uuid:
                images_query = select(Image).join(Game).filter(Game.library_uuid == library_uuid)
                print(f"🔍 Checking for missing images in library {library_uuid}")
            else:
                images_query = select(Image)
                print("🔍 Checking for missing images across all libraries")
            
            # Get all images with download URLs
            all_images = db.session.execute(images_query.filter(Image.download_url.isnot(None))).scalars().all()
            
            if not all_images:
                print("No images with download URLs found in database.")
                return {
                    'total_checked': 0,
                    'missing_count': 0,
                    'missing_images': [],
                    'already_queued': 0
                }
            
            print(f"📊 Found {len(all_images)} images to check")
            
            missing_images = []
            already_queued_count = 0
            
            for image in all_images:
                try:
                    # Check if image is already marked as not downloaded (already in queue)
                    if not image.is_downloaded:
                        already_queued_count += 1
                        continue
                    
                    # Build expected file path
                    image_save_path = os.path.join(app.config['IMAGE_SAVE_PATH'], image.url)
                    
                    # Check if file exists on disk
                    if not os.path.exists(image_save_path):
                        missing_images.append({
                            'id': image.id,
                            'game_uuid': image.game_uuid,
                            'image_type': image.image_type,
                            'url': image.url,
                            'download_url': image.download_url,
                            'file_path': image_save_path
                        })
                        print(f"❌ Missing: {image.image_type} for game {image.game_uuid}: {image.url}")
                    
                except Exception as e:
                    print(f"Error checking image {image.id}: {e}")
                    continue
            
            result = {
                'total_checked': len(all_images),
                'missing_count': len(missing_images),
                'missing_images': missing_images,
                'already_queued': already_queued_count
            }
            
            print(f"📈 Missing images summary: {len(missing_images)} missing, {already_queued_count} already queued, {len(all_images)} total checked")
            return result
            
    except Exception as e:
        print(f"Error in find_missing_images_for_library: {e}")
        return {
            'total_checked': 0,
            'missing_count': 0,
            'missing_images': [],
            'already_queued': 0,
            'error': str(e)
        }


def queue_missing_images_for_download(missing_images_list, app=None):
    """
    Mark missing images as not downloaded so they get picked up by the download queue.
    
    Parameters:
    - missing_images_list: List of missing image dictionaries from find_missing_images_for_library
    - app: Flask app context (optional)
    
    Returns:
    - Number of images successfully queued
    """
    if app is None:
        app = current_app._get_current_object()
    
    if not missing_images_list:
        print("No missing images to queue.")
        return 0
    
    try:
        with app.app_context():
            queued_count = 0
            image_ids = [img['id'] for img in missing_images_list]
            
            # Update images to mark them as not downloaded (queued for download)
            db.session.execute(
                update(Image).filter(Image.id.in_(image_ids)).values(is_downloaded=False)
            )
            updated_count = len(image_ids)
            
            db.session.commit()
            queued_count = updated_count
            
            print(f"📥 Successfully queued {queued_count} missing images for download")
            
            # Trigger immediate download if turbo mode is enabled
            settings = db.session.execute(select(GlobalSettings)).scalar_one_or_none()
            if settings and settings.use_turbo_image_downloads:
                print("🚀 Turbo mode enabled - triggering immediate download")
                # Run a small batch download to start processing immediately
                download_result = turbo_download_images(
                    batch_size=min(20, queued_count), 
                    max_workers=settings.turbo_download_threads or 4, 
                    app=app
                )
                print(f"⚡ Quick download result: {download_result.get('message', 'Download initiated')}")
            
            return queued_count
            
    except Exception as e:
        print(f"Error queuing missing images: {e}")
        try:
            db.session.rollback()
        except:
            pass
        return 0


def process_missing_images_for_scan(library_uuid=None, app=None):
    """
    Complete workflow to find and queue missing images for download during scan.
    
    Parameters:
    - library_uuid: UUID of library to process (optional, processes all if None)
    - app: Flask app context (optional)
    
    Returns:
    - Dictionary with results summary
    """
    if app is None:
        app = current_app._get_current_object()
    
    print(f"🔍 Starting missing images processing for library: {library_uuid or 'ALL'}")
    
    # Step 1: Find missing images
    missing_result = find_missing_images_for_library(library_uuid, app)
    
    if missing_result.get('error'):
        return {
            'success': False,
            'error': missing_result['error'],
            'found': 0,
            'queued': 0
        }
    
    # Step 2: Queue missing images if any found
    queued_count = 0
    if missing_result['missing_count'] > 0:
        queued_count = queue_missing_images_for_download(missing_result['missing_images'], app)
    
    result = {
        'success': True,
        'total_checked': missing_result['total_checked'],
        'found': missing_result['missing_count'],
        'queued': queued_count,
        'already_queued': missing_result['already_queued'],
        'message': f"Found {missing_result['missing_count']} missing images, queued {queued_count} for download"
    }
    
    print(f"✅ Missing images processing complete: {result['message']}")
    return result
