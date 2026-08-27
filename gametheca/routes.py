# gametheca/routes.py
import uuid, json, os, shutil
from pathlib import Path
from flask import (
    render_template, flash, redirect, url_for, request, Blueprint,
    jsonify, session, abort, current_app, Response
)
from flask_login import current_user, login_required
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import joinedload
from sqlalchemy import func, select, delete, and_
from werkzeug.utils import secure_filename
from werkzeug.exceptions import NotFound
from gametheca import db, cache
from datetime import datetime, timezone
from PIL import Image as PILImage
from itsdangerous import URLSafeTimedSerializer
from jinja2 import pass_context

from gametheca.utils.api_response import api_error, api_ok
from gametheca.forms import (
    ScanFolderForm, CsrfProtectForm,
    AutoScanForm, UpdateUnmatchedFolderForm,
    ReleaseGroupForm
)
from gametheca.models import (
    Game, Image, ScanJob, UnmatchedFolder,
    Genre, Theme, GameMode, PlayerPerspective,
    Category, Library, Platform,
    ReleaseGroup, AllowedFileType, GlobalSettings, user_game_status,
    GameUpdate, user_favorites, GameExtra,
)
from gametheca.platform import LibraryPlatform
from gametheca.utils.game_editions import normalize_title
from gametheca.utils.title_grouping import (
    editions_by_title_key,
    platform_rank_case,
    title_key_expr,
)
from gametheca.utils.secondary_scrapers import game_card_flags
from gametheca.utils.store_ownership import get_matched_owned_game_uuids, ownership_flags
from gametheca.utils.functions import (
    load_scanning_filter_patterns,
    format_size,
    PLATFORM_IDS,
    normalize_case_sensitive,
)
from gametheca.utils.local_metadata import has_local_metadata, has_local_images
from gametheca.utilities import handle_auto_scan, handle_manual_scan, scan_and_add_games
from gametheca.utils.auth import admin_required
from gametheca.utils.background import run_in_background
from gametheca.utils.gamenames import get_game_names_from_folder, get_game_name_by_uuid
from gametheca.utils.image_kinds import (
    IMAGE_KIND_ORDER,
    SINGULAR_IMAGE_KINDS,
    image_kinds_error_message,
    parse_image_kind,
)
from gametheca.utils.scanning import refresh_images_in_background, is_scan_job_running
from gametheca.utils.game_core import delete_game
from gametheca.utils.library_roots import resolve_scan_path
from gametheca.utils.security import is_safe_path, get_allowed_base_directories
from gametheca.utils.cover_url import resolve_game_cover_url
from gametheca.utils.unmatched import handle_delete_unmatched
from gametheca.utils.processors import get_global_settings
from gametheca.utils.library_acl import apply_game_access_filters, user_can_access_library
from gametheca.utils.lifecycle import web_client_connected, web_lifecycle_fields
from gametheca.utils.client_lifecycle import installed_game_uuids, load_lifecycle_map
from gametheca.utils.play_url import browse_play_fields
from gametheca.utils.browse_filters import apply_badge_filters
from gametheca.utils.browse_pagination import normalize_page_size
from gametheca.utils.rom_language import rom_browse_flags
bp = Blueprint('main', __name__)

def get_serializer():
    """Get URLSafeTimedSerializer with current app's secret key."""
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
has_initialized_whitelist = False
has_upgraded_admin = False
has_initialized_setup = False

# Progress tracking for library deletion
deletion_progress = {}

@bp.context_processor
@cache.cached(timeout=500, key_prefix='global_settings')
def inject_settings():
    """Context processor to inject global settings into templates"""
    return get_global_settings()


@bp.route('/browse_games')
@login_required
def browse_games():
    print(f"Route: /browse_games - {current_user.name}")
    page = request.args.get('page', 1, type=int)
    per_page = normalize_page_size(request.args.get('per_page', 20, type=int))
    library_uuid = request.args.get('library_uuid')
    library_platform = request.args.get('library_platform')
    igdb_platform = request.args.get('igdb_platform')
    category = request.args.get('category')
    genre = request.args.get('genre')
    rating = request.args.get('rating', type=int)
    game_mode = request.args.get('game_mode')
    player_perspective = request.args.get('player_perspective')
    theme = request.args.get('theme')
    sort_by = request.args.get('sort_by', 'name')
    sort_order = request.args.get('sort_order', 'asc')
    installed_only = request.args.get('installed_only', '').lower() in ('1', 'true', 'yes')
    query = select(Game).options(
        joinedload(Game.genres),
        joinedload(Game.player_perspectives),
        joinedload(Game.library),
    )
    query = apply_game_access_filters(query, current_user)
    # Get current user ID for favorite status
    current_user_id = current_user.id if current_user.is_authenticated else None
    if installed_only:
        installed = installed_game_uuids(current_user_id)
        if not installed:
            return jsonify({'games': [], 'total': 0, 'pages': 0, 'current_page': page}), 200
        query = query.filter(Game.uuid.in_(installed))
    if library_uuid:
        if not user_can_access_library(current_user, library_uuid):
            return jsonify({'games': [], 'total': 0, 'pages': 0, 'current_page': page}), 200
        query = query.filter(Game.library_uuid == library_uuid)
    if library_platform:
        try:
            platform_enum = LibraryPlatform[library_platform]
        except KeyError:
            return jsonify({'games': [], 'total': 0, 'pages': 0, 'current_page': page}), 200
        query = query.filter(Game.library.has(Library.platform == platform_enum))
    if igdb_platform:
        query = query.filter(Game.platforms.any(Platform.name == igdb_platform))
    if category:
        query = query.filter(Game.category.has(Category.name == category))
    if genre:
        query = query.filter(Game.genres.any(Genre.name == genre))
    if rating is not None:
        query = query.filter(Game.rating >= rating)
    if game_mode:
        query = query.filter(Game.game_modes.any(GameMode.name == game_mode))
    if player_perspective:
        query = query.filter(Game.player_perspectives.any(PlayerPerspective.name == player_perspective))
    if theme:
        query = query.filter(Game.themes.any(Theme.name == theme))
    query = apply_badge_filters(query, request.args, user=current_user)

    # One tile per title, not per row in one library.
    #
    # A household keeping Chrono Trigger on SNES, PC and Switch had three
    # unrelated tiles; the copies are reachable from the preview's "Available
    # on" list, which is where they belong. Titles pair on the normalised name
    # because `igdb_id` and `slug` are both unique per row and so cannot be
    # shared across systems — see utils/title_grouping.
    #
    # `DISTINCT ON` picks the representative inside the query, so `db.paginate`
    # still counts titles rather than rows and every page stays full. Ordering
    # is (key, recency desc, id): the copy on the latest system the title was
    # released on wins, and `id` makes the choice deterministic when two copies
    # sit on equally recent hardware.
    #
    # The whereclause is reused rather than the filters re-applied, so the
    # representative is always chosen from rows the member can actually see and
    # that match what they filtered — every filter above is a WHERE on Game
    # (the `.has()` / `.any()` ones are correlated EXISTS, not joins), so this
    # cannot drift from the query it mirrors. With a system filter active that
    # is exactly what makes the surviving copy the one on *that* system.
    platform_of_library = (
        select(Library.platform)
        .where(Library.uuid == Game.library_uuid)
        .scalar_subquery()
    )
    grouping_key = title_key_expr(Game.name)
    hardware_recency = platform_rank_case(platform_of_library)

    representatives = select(Game.id.label('id'))
    if query.whereclause is not None:
        representatives = representatives.where(query.whereclause)
    representatives = (
        representatives
        .distinct(grouping_key)
        .order_by(grouping_key, hardware_recency.desc(), Game.id)
        .subquery()
    )
    query = query.filter(Game.id.in_(select(representatives.c.id)))

    if sort_by == 'name':
        query = query.order_by(Game.name.asc() if sort_order == 'asc' else Game.name.desc())
    elif sort_by == 'rating':
        query = query.order_by(Game.rating.asc() if sort_order == 'asc' else Game.rating.desc())
    elif sort_by == 'first_release_date':
        query = query.order_by(Game.first_release_date.asc() if sort_order == 'asc' else Game.first_release_date.desc())
    elif sort_by == 'size':
        query = query.order_by(Game.size.asc() if sort_order == 'asc' else Game.size.desc())
    elif sort_by == 'date_identified':
        query = query.order_by(Game.date_identified.asc() if sort_order == 'asc' else Game.date_identified.desc())

    # Pagination
    pagination = db.paginate(query, page=page, per_page=per_page, error_out=False)

    # Which systems each surviving title exists on — one query for the page.
    #
    # Deliberately ACL-scoped but *not* filtered by the member's current view.
    # With a system filter active the browse query can only see that system's
    # copies, and the badge has to say "NES" plus how many other systems hold
    # the title — which are exactly the rows that filter excluded. One bulk
    # lookup keyed on the same grouping expression, so a page of a thousand
    # tiles costs one round trip rather than a thousand.
    games = pagination.items
    edition_platforms_by_key: dict[str, list[str]] = {}
    page_title_keys = sorted({normalize_title(game.name) for game in games if game.name})
    if page_title_keys:
        edition_query = (
            select(grouping_key.label('title_key'), Library.platform)
            .select_from(Game)
            .join(Library, Library.uuid == Game.library_uuid)
            .where(grouping_key.in_(page_title_keys))
        )
        edition_query = apply_game_access_filters(edition_query, current_user)
        edition_platforms_by_key = editions_by_title_key(
            (row[0], getattr(row[1], 'name', None))
            for row in db.session.execute(edition_query).all()
        )

    # Get all user statuses for games in this page (batch query for performance)
    game_uuids = [game.uuid for game in games]
    user_statuses = {}
    if current_user_id and game_uuids:
        status_results = db.session.execute(
            select(user_game_status.c.game_uuid, user_game_status.c.status).where(
                and_(
                    user_game_status.c.user_id == current_user_id,
                    user_game_status.c.game_uuid.in_(game_uuids)
                )
            )
        ).all()
        user_statuses = {row[0]: row[1] for row in status_results}

    update_counts = {}
    patch_game_uuids: set[str] = set()
    if game_uuids:
        update_results = db.session.execute(
            select(GameUpdate.game_uuid, func.count())
            .where(GameUpdate.game_uuid.in_(game_uuids))
            .group_by(GameUpdate.game_uuid)
        ).all()
        update_counts = {row[0]: row[1] for row in update_results}
        patch_game_uuids = {
            row[0]
            for row in db.session.execute(
                select(GameExtra.game_uuid).where(
                    GameExtra.game_uuid.in_(game_uuids),
                    GameExtra.extra_kind == 'translation_patch',
                ).distinct()
            ).all()
        }

    preferred_locale = 'en-US'
    prefs = getattr(current_user, 'preferences', None) if current_user_id else None
    if prefs is not None:
        preferred_locale = getattr(prefs, 'preferred_game_locale', None) or 'en-US'

    settings = db.session.execute(
        select(GlobalSettings).order_by(GlobalSettings.id).limit(1)
    ).scalars().first()
    owned_game_uuids = get_matched_owned_game_uuids(current_user_id) if current_user_id else set()
    lifecycle_map = load_lifecycle_map(current_user_id)
    client_connected = web_client_connected(user_id=current_user_id) if current_user_id else False

    favorite_uuids: set[str] = set()
    covers_by_uuid: dict[str, Image] = {}
    if game_uuids:
        cover_rows = db.session.execute(
            select(Image).where(
                Image.game_uuid.in_(game_uuids),
                Image.image_type == 'cover',
            )
        ).scalars().all()
        covers_by_uuid = {row.game_uuid: row for row in cover_rows}
        if current_user_id:
            favorite_uuids = {
                row[0]
                for row in db.session.execute(
                    select(user_favorites.c.game_uuid).where(
                        and_(
                            user_favorites.c.user_id == current_user_id,
                            user_favorites.c.game_uuid.in_(game_uuids),
                        )
                    )
                ).all()
            }

    # Get game data
    game_data = []
    for game in games:
        cover_image = covers_by_uuid.get(game.uuid)
        cover_url = resolve_game_cover_url(game, cover_image)
        genres = [genre.name for genre in game.genres]
        game_size_formatted = format_size(game.size)

        has_local_override = False
        if settings:
            if (settings.use_local_metadata and has_local_metadata(game.full_disk_path, settings.local_metadata_filename or 'gametheca.json')) or \
               (settings.use_local_images and has_local_images(game.full_disk_path)):
                has_local_override = True

        # Get user status for this game
        user_status = user_statuses.get(game.uuid)

        library_platform_key = None
        library_platform_label = None
        if game.library is not None and game.library.platform is not None:
            platform = game.library.platform
            library_platform_key = getattr(platform, 'name', None) or str(platform)
            library_platform_label = getattr(platform, 'value', None) or library_platform_key

        edition_platforms = edition_platforms_by_key.get(normalize_title(game.name)) or (
            [library_platform_key] if library_platform_key else []
        )

        steam_app_id = getattr(game, 'steam_app_id', None)
        steam_url = getattr(game, 'steam_url', None) or None
        if steam_app_id and not steam_url:
            steam_url = f'https://store.steampowered.com/app/{int(steam_app_id)}'

        game_data.append({
            'id': game.id,
            'uuid': game.uuid,
            'name': game.name,
            'cover_url': cover_url,
            'summary': game.summary,
            'url': game.url,
            'size': game_size_formatted,
            'genres': genres,
            'library_uuid': game.library_uuid,
            'library_platform': library_platform_key,
            'library_platform_label': library_platform_label,
            'is_favorite': game.uuid in favorite_uuids,
            'date_identified': game.date_identified.isoformat() if game.date_identified else None,
            'date_created': game.date_created.isoformat() if game.date_created else None,
            'first_release_date': game.first_release_date.isoformat() if game.first_release_date else None,
            'has_local_override': has_local_override,
            'user_status': user_status,
            'freshness_status': game.freshness_status,
            'freshness_confidence': game.freshness_confidence,
            'local_version': game.local_version,
            'steam_app_id': steam_app_id,
            'steam_url': steam_url,
            'badge_title_collision': bool(library_platform_key),
            # Newest hardware first, so the client reads element 0 as "the
            # latest system this was released on" and never has to rank
            # anything itself. Always includes this row's own system, so the
            # count is systems-for-the-title, not systems-besides-this-one.
            'edition_platforms': edition_platforms,
            'edition_count': len(edition_platforms),
            **browse_play_fields(game),
            **game_card_flags(game),
            **rom_browse_flags(
                game,
                preferred_locale,
                has_translation_patch=game.uuid in patch_game_uuids,
            ),
            **web_lifecycle_fields(
                game,
                updates_count=update_counts.get(game.uuid, 0),
                user_id=current_user_id,
                client_connected=client_connected,
                client_state=lifecycle_map.get(game.uuid),
            ),
            **ownership_flags(game.uuid, owned_game_uuids),
        })

    return jsonify({
        'games': game_data,
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': page
    })


@bp.route('/scan_manual_folder', methods=['GET', 'POST'])
@login_required
@admin_required
def scan_folder():
    ## to be fixed broken again after update
    form = ScanFolderForm()
    release_group_form = ReleaseGroupForm()

    libraries = db.session.execute(select(Library)).scalars().all()
    form.library_uuid.choices = [(str(lib.uuid), lib.name) for lib in libraries]

    csrf_form = CsrfProtectForm()
    game_names_with_ids = None

    # Data for template consistency with scan_management
    scanning_filters = db.session.execute(select(ReleaseGroup).order_by(ReleaseGroup.filter_pattern.asc())).scalars().all()
    allowed_file_types = db.session.execute(select(AllowedFileType).order_by(AllowedFileType.value.asc())).scalars().all()
    
    if form.validate_on_submit():
        if form.cancel.data:
            return redirect(url_for('main.scan_folder'))
        
        # Relative to the scan location the folder browser was pointed at, so
        # this legacy entry point resolves paths the same way scan_management
        # does rather than only accepting absolutes.
        folder_path, root_error = resolve_scan_path(
            form.folder_path.data, form.library_root.data, current_app,
        )
        print(f"Scanning folder: {folder_path}")
        if root_error:
            flash(f'Service configuration error: {root_error}', 'error')
            return redirect(url_for('main.scan_folder'))

        # Validate folder path security
        allowed_bases = get_allowed_base_directories(current_app)
        if not allowed_bases:
            flash('Service configuration error: No allowed base directories configured.', 'error')
            return render_template('admin/admin_manage_scanjobs.html',
                                  form=form, manual_form=form, csrf_form=csrf_form,
                                  game_names_with_ids=game_names_with_ids,
                                  release_group_form=release_group_form,
                                  scanning_filters=scanning_filters,
                                  allowed_file_types=allowed_file_types)
        
        # Security validation: ensure the folder path is within allowed directories
        is_safe, error_message = is_safe_path(folder_path, allowed_bases)
        if not is_safe:
            print(f"Security error: Scan folder path validation failed for {folder_path}: {error_message}")
            flash(f"Access denied: {error_message}", 'error')
            return render_template('admin/admin_manage_scanjobs.html',
                                  form=form, manual_form=form, csrf_form=csrf_form,
                                  game_names_with_ids=game_names_with_ids,
                                  release_group_form=release_group_form,
                                  scanning_filters=scanning_filters,
                                  allowed_file_types=allowed_file_types)

        if os.path.exists(folder_path) and os.access(folder_path, os.R_OK):
            print("Folder exists and is accessible.")
            insensitive_patterns, sensitive_patterns = load_scanning_filter_patterns()
            games_with_paths = get_game_names_from_folder(folder_path, insensitive_patterns, sensitive_patterns)
            session['active_tab'] = 'manualScan'
            session['game_paths'] = {game['name']: game['full_path'] for game in games_with_paths}            
            game_names_with_ids = [{'name': game['name'], 'id': i} for i, game in enumerate(games_with_paths)]
        else:
            flash("Folder does not exist or cannot be accessed.", "error")
            print("Folder does not exist or cannot be accessed.")
            
    return render_template('admin/admin_manage_scanjobs.html',
                          form=form,
                          manual_form=form,
                          csrf_form=csrf_form,
                          game_names_with_ids=game_names_with_ids,
                          release_group_form=release_group_form,
                          scanning_filters=scanning_filters,
                          allowed_file_types=allowed_file_types)



@bp.route('/scan_management', methods=['GET', 'POST'])
@login_required
@admin_required
def scan_management():
    auto_form = AutoScanForm()
    manual_form = ScanFolderForm()
    release_group_form = ReleaseGroupForm()

    libraries = db.session.execute(select(Library)).scalars().all()
    auto_form.library_uuid.choices = [(str(lib.uuid), lib.name) for lib in libraries]
    manual_form.library_uuid.choices = [(str(lib.uuid), lib.name) for lib in libraries]

    # Only pre-select from query param on GET, not POST
    # This prevents overwriting form data during POST submission
    selected_library_uuid = None
    if request.method == 'GET':
        selected_library_uuid = request.args.get('library_uuid')
        if selected_library_uuid:
            auto_form.library_uuid.data = selected_library_uuid
            manual_form.library_uuid.data = selected_library_uuid

    jobs = db.session.execute(select(ScanJob).order_by(ScanJob.last_run.desc())).scalars().all()
    csrf_form = CsrfProtectForm()
    unmatched_folders = UnmatchedFolder.query\
                        .join(Library)\
                        .with_entities(UnmatchedFolder, Library.name, Library.platform)\
                        .order_by(UnmatchedFolder.status.desc()).all()
    unmatched_form = UpdateUnmatchedFolderForm()
    # Packaging data with platform details
    unmatched_folders_with_platform = []
    for unmatched, lib_name, lib_platform in unmatched_folders:
        platform_id = PLATFORM_IDS.get(lib_platform.name) if lib_platform else None
        unmatched_folders_with_platform.append({
            "folder": unmatched,
            "library_name": lib_name,
            "platform_name": lib_platform.name if lib_platform else '',
            "platform_id": platform_id
        })

    game_count = db.session.scalar(select(func.count(Game.id)))  # Fetch the game count here

    # Data for new tabs
    scanning_filters = db.session.execute(select(ReleaseGroup).order_by(ReleaseGroup.filter_pattern.asc())).scalars().all()
    allowed_file_types = db.session.execute(select(AllowedFileType).order_by(AllowedFileType.value.asc())).scalars().all()

    if request.method == 'POST':
        submit_action = request.form.get('submit')
        if submit_action == 'AutoScan':
            return handle_auto_scan(auto_form)
        elif submit_action == 'ManualScan':
            return handle_manual_scan(manual_form)
        elif submit_action == 'DeleteAllUnmatched':
            return handle_delete_unmatched(all=True)
        elif submit_action == 'DeleteOnlyUnmatched':
            return handle_delete_unmatched(all=False)
        elif submit_action == 'AddReleaseGroup' and release_group_form.validate_on_submit():
            # Canonical String column form ('yes'|'no') — matches edit_filters.
            new_group = ReleaseGroup(
                filter_pattern=release_group_form.filter_pattern.data,
                case_sensitive=normalize_case_sensitive(release_group_form.case_sensitive.data),
            )
            db.session.add(new_group)
            db.session.commit()
            flash('New scanning filter added.', 'success')
            return redirect(url_for('main.scan_management', active_tab='scan_filters'))
        elif submit_action == 'DeleteReleaseGroup':
            # Handle deleting scanning filter
            filter_id = request.form.get('filter_id')
            if filter_id:
                group_to_delete = db.session.get(ReleaseGroup, filter_id)
                if group_to_delete:
                    db.session.delete(group_to_delete)
                    db.session.commit()
                    flash('Scanning filter removed.', 'success')
                else:
                    flash('Filter not found.', 'error')
            return redirect(url_for('main.scan_management', active_tab='scan_filters'))
        else:
            flash("Unrecognized action.", "error")
            return redirect(url_for('main.scan_management'))

    game_paths_dict = session.get('game_paths', {})
    game_names_with_ids = [{'name': name, 'full_path': path} for name, path in game_paths_dict.items()]
    # Handle active_tab from URL parameter, default to 'auto'
    active_tab = request.args.get('active_tab', 'auto')

    return render_template('admin/admin_manage_scanjobs.html',
                           auto_form=auto_form,
                           manual_form=manual_form,
                           jobs=jobs,
                           csrf_form=csrf_form,
                           active_tab=active_tab,
                           unmatched_folders=unmatched_folders_with_platform,
                           unmatched_form=unmatched_form,
                           game_count=game_count,
                           libraries=libraries,
                           game_names_with_ids=game_names_with_ids,
                           release_group_form=release_group_form,
                           scanning_filters=scanning_filters,
                           allowed_file_types=allowed_file_types,
                           selected_library_uuid=selected_library_uuid)


@bp.route('/cancel_scan_job/<job_id>', methods=['POST'])
@login_required
@admin_required
def cancel_scan_job(job_id):
    job = db.session.get(ScanJob, job_id)
    if job and job.status == 'Running':
        job.is_enabled = False
        job.status = 'Stopping'
        job.error_message = 'Scan is stopping, waiting for threads to complete'
        db.session.commit()
        flash(f"Scan job {job_id} is stopping. Waiting for threads to complete...")
        print(f"Scan job {job_id} is stopping. Waiting for threads to complete...")
    elif job and job.status == 'Queued':
        job.is_enabled = False
        job.status = 'Cancelled'
        job.error_message = 'Queued scan cancelled before start'
        db.session.commit()
        flash(f"Queued scan job {job_id} cancelled.")
        print(f"Queued scan job {job_id} cancelled.")
    else:
        flash('Scan job not found or not in a cancellable state.', 'error')
    return redirect(url_for('main.scan_management'))

@bp.route('/restart_scan_job/<job_id>', methods=['POST'])
@login_required
@admin_required
def restart_scan_job(job_id):
    print(f"Request to restart scan job: {job_id}")
    job = db.session.get(ScanJob, job_id) or abort(404)    
    if job.status == 'Running':
        flash('Cannot restart a running scan.', 'error')
        return redirect(url_for('main.scan_management'))

    # Reset the existing job's counters instead of creating a new job
    job.status = 'Running'
    job.total_folders = 0
    job.folders_success = 0
    job.folders_failed = 0
    job.removed_count = 0
    job.last_run = datetime.now(timezone.utc)
    job.error_message = None
    job.is_enabled = True
    db.session.commit()
    try:
        from gametheca.utils.event_bus import publish_scan_event
        publish_scan_event(job.id, 'Running')
    except Exception:
        pass

    # Start scan using the existing job.
    #
    # Nothing but the job id crosses into the thread. `job` belongs to this
    # request's session, and the worker gets its own — see utils/background.py.
    # Every field is read from the row the worker re-fetches, so it also cannot
    # act on values that changed between the click and the thread starting.
    scan_job_id = job.id

    def _run_restarted_scan():
        existing = db.session.get(ScanJob, scan_job_id)
        if not existing:
            return

        base_dir = current_app.config.get('BASE_FOLDER_WINDOWS') if os.name == 'nt' else current_app.config.get('BASE_FOLDER_POSIX')
        full_path = os.path.join(base_dir, existing.scan_folder)

        if not os.path.exists(full_path) or not os.access(full_path, os.R_OK):
            existing.status = 'Failed'
            existing.error_message = f"Cannot access folder: {full_path}"
            db.session.commit()
            return

        scan_mode = 'files' if existing.setting_filefolder else 'folders'
        download_missing_images = getattr(existing, 'setting_download_missing_images', False)
        scan_and_add_games(
            full_path,
            scan_mode=scan_mode,
            library_uuid=existing.library_uuid,
            remove_missing=existing.setting_remove,
            existing_job=existing,
            download_missing_images=download_missing_images,
            force_updates_extras_scan=getattr(existing, 'setting_force_updates_extras', False)
        )

    run_in_background(
        current_app._get_current_object(),
        _run_restarted_scan,
        name=f'gametheca-restart-scan-{str(scan_job_id)[:8]}',
    )
    return redirect(url_for('main.scan_management'))


@bp.route('/edit_game_images/<game_uuid>', methods=['GET'])
@login_required
@admin_required
def edit_game_images(game_uuid):
    if is_scan_job_running():
        flash('Image editing is restricted while a scan job is running. Please try again later.', 'warning')
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalar_one_or_none() or abort(404)
    cover_image = db.session.execute(select(Image).filter_by(game_uuid=game_uuid, image_type='cover')).scalars().first()
    screenshots = db.session.execute(select(Image).filter_by(game_uuid=game_uuid, image_type='screenshot')).scalars().all()
    other_images = db.session.execute(
        select(Image).filter(
            Image.game_uuid == game_uuid,
            Image.image_type.in_(['box', 'cart', 'disc', 'logo', 'hero', 'fanart']),
        )
    ).scalars().all()
    return render_template(
        'games/game_edit_images.html',
        game=game,
        cover_image=cover_image,
        images=screenshots,
        other_images=other_images,
        allowed_kinds=list(IMAGE_KIND_ORDER),
    )


# Per-upload ceiling for game artwork. The global MAX_CONTENT_LENGTH in config
# is the outer bound that stops an unbounded body being buffered at all; this is
# the one a user actually hits, and it is the number the error message quotes.
MAX_IMAGE_UPLOAD_BYTES = 3 * 1024 * 1024

# Decompression-bomb ceiling — roughly a 60-megapixel image, comfortably above
# any real cover or screenshot. verify() does not decode pixel data, so without
# this the resize below is where a 40000x40000 PNG would land.
MAX_IMAGE_PIXELS = 60_000_000


@bp.route('/upload_image/<game_uuid>', methods=['POST'])
@login_required
@admin_required
def upload_image(game_uuid):
    print(f"Uploading image for game {game_uuid}")
    if is_scan_job_running():
        print(f"Attempt to upload image for game UUID: {game_uuid} while scan job is running")
        flash('Cannot upload images while a scan job is running. Please try again later.', 'error')
        return api_error('Cannot upload images while a scan job is running. Please try again later.', code='forbidden')

    if 'file' not in request.files:
        return api_error('No file part', code='bad_request')

    file = request.files['file']
    try:
        image_type = parse_image_kind(
            request.form.get('image_type') or request.form.get('kind'),
            default='screenshot',
        )
    except ValueError:
        return api_error(image_kinds_error_message(), code='bad_request')

    if file.filename == '':
        return api_error('No selected file', code='bad_request')

    # Validate file extension and content type
    allowed_extensions = {'jpg', 'jpeg', 'png', 'gif'}
    filename = secure_filename(file.filename)
    file_extension = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''

    if file_extension not in allowed_extensions:
        return api_error('Only JPG, PNG and GIF files are allowed', code='bad_request')

    # Size first, before anything decodes the file. The previous version read
    # `file.content_length`, which is 0 for an ordinary multipart upload, so the
    # limit never applied — and it checked *after* Pillow had already opened the
    # image twice, which is the expensive half.
    file.seek(0, os.SEEK_END)
    upload_bytes = file.tell()
    file.seek(0)
    if upload_bytes > MAX_IMAGE_UPLOAD_BYTES:
        limit_mb = MAX_IMAGE_UPLOAD_BYTES // (1024 * 1024)
        return api_error(f'File size exceeds the {limit_mb}MB limit', code='bad_request')

    # Further validate the file's data to ensure it's a valid image
    try:
        img = PILImage.open(file)
        img.verify()  # Verify that it is, in fact, an image
        file.seek(0)
        img = PILImage.open(file)
    except (IOError, SyntaxError, PILImage.DecompressionBombError):
        return api_error('Invalid image data', code='bad_request')

    # A few hundred KB of PNG can declare a 40000x40000 canvas; verify() does not
    # decode it, but the resize below would.
    if (img.width * img.height) > MAX_IMAGE_PIXELS:
        return api_error('Image dimensions are too large', code='bad_request')

    # Resized output has to be *saved*, which is what was missing: thumbnail()
    # mutates `img` in place and the code then wrote the original bytes back
    # out, so oversized covers were stored at full size and the resize was dead.
    resized = None
    source_format = img.format
    max_width, max_height = 1200, 1600
    if image_type == 'cover' and (img.width > max_width or img.height > max_height):
        # LANCZOS, not ANTIALIAS: the latter was deprecated in Pillow 9.1
        # and removed in 10, so this line raised AttributeError on every
        # oversized cover upload. Same filter every other resize here uses.
        img.thumbnail((max_width, max_height), PILImage.LANCZOS)
        resized = img
    file.seek(0)

    # Singular kinds: replace existing primary of that kind
    if image_type in SINGULAR_IMAGE_KINDS:
        existing_rows = db.session.execute(
            select(Image).filter_by(game_uuid=game_uuid, image_type=image_type)
        ).scalars().all()
        for existing in existing_rows:
            old_path = os.path.join(current_app.config['IMAGE_SAVE_PATH'], existing.url)
            if os.path.exists(old_path):
                os.remove(old_path)
            db.session.delete(existing)
        db.session.commit()
    short_uuid = str(uuid.uuid4())[:8]
    if image_type in SINGULAR_IMAGE_KINDS:
        unique_identifier = str(uuid.uuid4())[:8]
        filename = f"{game_uuid}_{image_type}_{unique_identifier}.{file_extension}"
    else:
        unique_identifier = datetime.now().strftime('%Y%m%d%H%M%S')
        short_uuid = str(uuid.uuid4())[:8]
        filename = f"{game_uuid}_{unique_identifier}_{short_uuid}.{file_extension}"
    save_path = os.path.join(current_app.config['IMAGE_SAVE_PATH'], filename)
    if resized is not None:
        # Keep the uploaded format so a .png stays a PNG — inferring it from the
        # path would break RGBA on a .jpg and flatten nothing correctly.
        resized.save(save_path, format=source_format or None)
    else:
        file.save(save_path)
    print(f"File saved to: {save_path}")
    new_image = Image(game_uuid=game_uuid, image_type=image_type, url=filename)
    db.session.add(new_image)
    db.session.commit()
    print(f"File saved to DB with ID: {new_image.id}")

    return api_ok({
        'message': 'File uploaded successfully',
        'url': url_for('static', filename=f'library/images/{filename}'),
        'flash': 'Image uploaded successfully!',
        'image_id': new_image.id,
        'image_type': image_type,
        'kind': image_type,
    })

@bp.route('/delete_image', methods=['POST'])
@login_required
@admin_required
def delete_image():
    if is_scan_job_running():
        print("Attempt to delete image while scan job is running")
        return api_error('Cannot delete images while a scan job is running. Please try again later.', code='forbidden')

    try:
        data = request.get_json()
        if not data or 'image_id' not in data:
            return api_error('Invalid request. Missing image_id parameter', code='bad_request')
        
        image_id = data['image_id']
        is_cover = data.get('is_cover', False)
        image = db.session.get(Image, image_id)
        if not image:
            return api_error('Image not found', code='not_found')

        # Delete image file from disk
        image_path = os.path.join(current_app.config['IMAGE_SAVE_PATH'], image.url)
        if os.path.exists(image_path):
            print(f"Deleting image file: {image_path}")
            os.remove(image_path)

        # Delete image record from database
        db.session.delete(image)
        db.session.commit()

        response_data = {'message': 'Image deleted successfully'}
        if is_cover:
            response_data['default_cover'] = url_for('static', filename='newstyle/default_cover.jpg')

        return api_ok(response_data)
    except Exception as e:
        # Log the error for debugging purposes
        print(f"Error deleting image: {str(e)}")
        return api_error(
            'An unexpected error occurred while deleting the image',
            code='internal',
        )


@bp.route('/delete_scan_job/<job_id>', methods=['POST'])
@login_required
@admin_required
def delete_scan_job(job_id):
    job = db.session.get(ScanJob, job_id) or abort(404)
    db.session.delete(job)
    db.session.commit()
    flash('Scan job deleted successfully.', 'success')
    return redirect(url_for('main.scan_management'))

@bp.route('/clear_all_scan_jobs', methods=['POST'])
@login_required
@admin_required
def clear_all_scan_jobs():
    db.session.execute(delete(ScanJob))
    db.session.commit()
    flash('All scan jobs cleared successfully.', 'success')
    return redirect(url_for('main.scan_management'))




@bp.route('/delete_all_unmatched_folders', methods=['POST'])
@login_required
@admin_required
def delete_all_unmatched_folders():
    try:
        db.session.execute(delete(UnmatchedFolder))
        db.session.commit()
        flash('All unmatched folders deleted successfully.', 'success')
    except SQLAlchemyError as e:
        db.session.rollback()
        error_message = f"Database error while deleting all unmatched folders: {str(e)}"
        print(error_message)
        flash(error_message, 'error')
    except Exception as e:
        db.session.rollback()
        error_message = f"An unexpected error occurred while deleting all unmatched folders: {str(e)}"
        print(error_message)
        flash(error_message, 'error')
    return redirect(url_for('main.scan_management'))


@bp.route('/update_unmatched_folder_status', methods=['POST'])
@login_required
@admin_required
def update_unmatched_folder_status():
    print("Route: /update_unmatched_folder_status")
    folder_id = request.form.get('folder_id')
    session['active_tab'] = 'unmatched'
    folder = db.session.execute(select(UnmatchedFolder).filter_by(id=folder_id)).scalar_one_or_none()
    if folder:
        # Toggle between 'Ignore' and 'Unmatched'
        folder.status = 'Unmatched' if folder.status == 'Ignore' else 'Ignore'
        try:
            db.session.commit()
            # `status` stays in the payload: the envelope migration is additive,
            # and an existing caller (plus test_routes.py) reads it.
            response_data = {
                'status': 'success',
                'new_status': folder.status,
                'message': f'Folder status updated to {folder.status}'
            }
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return api_ok(response_data)
            flash(response_data['message'], 'success')
        except SQLAlchemyError as e:
            # The raw SQLAlchemy text stays in the log. Handing it to the browser
            # leaks schema and connection detail for no operator benefit.
            current_app.logger.warning('Folder status update failed: %s', e)
            db.session.rollback()
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return api_error('Could not update the folder status', code='internal')
            flash('Error updating folder status.', 'error')
    else:
        flash('Folder not found.', 'error')

    return redirect(url_for('main.scan_management'))

@bp.route('/clear_unmatched_entry/<folder_id>', methods=['POST'])
@login_required
@admin_required
def clear_unmatched_entry(folder_id):
    """Clear a single unmatched folder entry from the database."""
    try:
        folder = db.session.get(UnmatchedFolder, folder_id) or abort(404)
        db.session.delete(folder)
        db.session.commit()
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return api_ok({'status': 'success', 'message': 'Entry cleared successfully'})
        flash('Unmatched folder entry cleared successfully.', 'success')
    except Exception as e:
        db.session.rollback()
        current_app.logger.warning('clear unmatched entry failed: %s', e)
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return api_error(
                'Could not clear the entry',
                code='internal',
                body_status='error',
            )
        flash('Error clearing unmatched folder entry.', 'error')
    return redirect(url_for('main.scan_management'))

@bp.route('/toggle_ignore_status/<folder_id>', methods=['POST'])
@login_required
@admin_required
def toggle_ignore_status(folder_id):
    """Toggle the ignore status of an unmatched folder."""
    try:
        folder = db.session.get(UnmatchedFolder, folder_id) or abort(404)
        # Toggle between 'Ignore' and the original status (likely 'Unmatched' or 'Duplicate')
        if folder.status == 'Ignore':
            # Restore to Unmatched or keep as Duplicate if that was the original status
            folder.status = 'Unmatched'  # Default to Unmatched when un-ignoring
        else:
            folder.status = 'Ignore'

        db.session.commit()

        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return api_ok({
                'status': 'success',
                'new_status': folder.status,
                'message': f'Status changed to {folder.status}',
            })
        flash(f'Folder status changed to {folder.status}.', 'success')
    except Exception as e:
        db.session.rollback()
        current_app.logger.warning('toggle ignore status failed: %s', e)
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return api_error(
                'Could not change the folder status',
                code='internal',
                body_status='error',
            )
        flash('Error toggling ignore status.', 'error')

    return redirect(url_for('main.scan_management'))


@bp.route('/refresh_game_images/<game_uuid>', methods=['POST'])
@login_required
@admin_required
def refresh_game_images(game_uuid):
    game_name = get_game_name_by_uuid(game_uuid)
    print(f"Route: /refresh_game_images - {current_user.name} - {current_user.role} method: {request.method} UUID: {game_uuid} Name: {game_name}")

    # Own app context, own session (utils/background.py). The uuid is a plain
    # string and `refresh_images_in_background` already guards its flash calls
    # with has_request_context(), so nothing here wanted the request anyway.
    run_in_background(
        current_app._get_current_object(),
        refresh_images_in_background,
        game_uuid,
        name=f'gametheca-refresh-images-{str(game_uuid)[:8]}',
    )
    print(f"Refresh images thread started for game UUID: {game_uuid} and Name: {game_name}.")

    # Check if the request is an AJAX request
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        # Return a JSON response for AJAX requests
        return api_ok({"message": f"Game images refresh process started for {game_name}.", "status": "info"})
    else:
        # For non-AJAX requests, perform the usual redirec
        flash(f"Game images refresh process started for {game_name}.", "info")
        return redirect(url_for('library.library'))


@bp.route('/check_image_refresh_progress/<game_uuid>', methods=['GET'])
@login_required
@admin_required
def check_image_refresh_progress(game_uuid):
    """Check the progress of an image refresh operation."""
    # `status` on the cached dict is job progress (`complete` / `error` /
    # `in_progress`), not an envelope marker. Wrapping with api_ok would stamp
    # ok=True onto a failed refresh. image_refresh_progress.js branches on it.
    progress_data = cache.get(f'image_refresh_progress_{game_uuid}')

    if progress_data is None:
        return api_ok({'status': 'not_found', 'progress': 0})

    return jsonify(progress_data)


@bp.route('/delete_game/<string:game_uuid>', methods=['POST'])
@login_required
@admin_required
def delete_game_route(game_uuid):
    print(f"Route: /delete_game - {current_user.name} - {current_user.role} method: {request.method} UUID: {game_uuid}")
    
    if is_scan_job_running():
        print(f"Error: Attempt to delete game UUID: {game_uuid} while scan job is running")
        return api_error('Cannot delete the game while a scan job is running. Please try again later.', code='forbidden')
    
    try:
        delete_game(game_uuid)
        return api_ok({'message': 'Game removed from library successfully.'})
    except NotFound:
        print(f"Error: game UUID {game_uuid} not found")
        return api_error('Game not found.', code='not_found')
    except Exception as e:
        print(f"Error deleting game {game_uuid}: {e}")
        return api_error('Could not remove the game', code='internal')


@bp.route('/delete_folder', methods=['POST'])
@login_required
@admin_required
def delete_folder():
    data = request.get_json()
    folder_path = data.get('folder_path') if data else None

    if not folder_path:
        return api_error('Path is required.', code='bad_request', body_status='error')

    allowed_bases = get_allowed_base_directories(current_app)
    is_safe, error_message = is_safe_path(folder_path, allowed_bases)
    if not is_safe:
        print(f"Security error: delete_folder path validation failed for {folder_path}: {error_message}")
        return api_error('Access denied.', code='forbidden', body_status='error')

    full_path = os.path.abspath(folder_path)

    folder_entry = db.session.execute(select(UnmatchedFolder).filter_by(folder_path=folder_path)).scalar_one_or_none()

    if not os.path.exists(full_path):
        if folder_entry:
            db.session.delete(folder_entry)
            db.session.commit()
        return api_error(
            'The specified path does not exist. Entry removed if it was in the database.',
            code='not_found',
            body_status='error',
        )

    try:
        if os.path.isfile(full_path):
            os.remove(full_path)
        else:
            shutil.rmtree(full_path)
        
        if not os.path.exists(full_path):
            if folder_entry:
                db.session.delete(folder_entry)
                db.session.commit()
            return api_ok({'status': 'success', 'message': 'Item deleted successfully. Database entry removed.'})
    except PermissionError:
        return api_error(
            'Failed to delete the item due to insufficient permissions. Database entry retained.',
            code='forbidden',
            body_status='error',
        )
    except Exception as e:
        current_app.logger.warning('delete unmatched item failed: %s', e)
        return api_error(
            'Could not delete the item. Database entry retained.',
            code='internal',
            body_status='error',
        )


@bp.route('/delete_full_game', methods=['POST'])
@login_required
@admin_required
def delete_full_game():
    print(f"Route: /delete_full_game - {current_user.name} - {current_user.role} method: {request.method}")
    data = request.get_json()
    game_uuid = data.get('game_uuid') if data else None
    print(f"Route: /delete_full_game - Game UUID: {game_uuid}")
    if not game_uuid:
        print("Route: /delete_full_game - Game UUID is required.")
        return api_error('Game UUID is required.', code='bad_request')

    if is_scan_job_running():
        print(f"Error: Attempt to delete full game UUID: {game_uuid} while scan job is running")
        return api_error('Cannot delete the game while a scan job is running. Please try again later.', code='forbidden')

    game_to_delete = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalar_one_or_none()
    print(f"Route: /delete_full_game - Game to delete: {game_to_delete}")

    if not game_to_delete:
        print("Route: /delete_full_game - Game not found.")
        return api_error('Game not found.', code='not_found')

    full_path = game_to_delete.full_disk_path
    print(f"Route: /delete_full_game - Full path: {full_path}")

    # A game whose files are already gone must still be removable from the
    # library, otherwise the entry is stranded with no way to delete it.
    on_disk = bool(full_path) and os.path.exists(full_path)
    if not on_disk:
        print("Route: /delete_full_game - Nothing on disk, cleaning up database entry only.")

    try:
        is_directory = on_disk and os.path.isdir(full_path)

        if on_disk:
            allowed_bases = get_allowed_base_directories(current_app)
            is_safe, error_message = is_safe_path(full_path, allowed_bases)
            if not is_safe:
                print(f"Security error: delete_full_game path validation failed for {full_path}: {error_message}")
                return api_error('Access denied.', code='forbidden')

            if is_directory:
                print(f"Deleting game folder: {full_path}")
                shutil.rmtree(full_path)
            else:
                print(f"Deleting game file: {full_path}")
                os.remove(full_path)

            if os.path.exists(full_path):
                raise Exception("Deletion failed - file/folder still exists")

            print(f"Game deleted from disk: {full_path} - initiating database cleanup.")

        delete_game(game_uuid)
        print("Database and image cleanup complete.")

        if not on_disk:
            success_message = 'Game was not present on disk; removed from the library.'
        elif is_directory:
            success_message = 'Game and its folder have been deleted successfully.'
        else:
            success_message = 'Game file has been deleted successfully.'
        return api_ok({'message': success_message})
    except Exception as e:
        error_message = f"Error deleting game from disk: {e}"
        print(error_message)
        return api_error(error_message, code='internal')


@bp.route('/delete_library_progress/<job_id>')
@login_required 
@admin_required
def delete_library_progress(job_id):
    """SSE endpoint for library deletion progress"""
    print(f"SSE endpoint accessed for job_id: {job_id} by user: {current_user.name if current_user.is_authenticated else 'Anonymous'}")
    def event_stream():
        import time
        
        # Initial delay to ensure EventSource connection is established
        time.sleep(0.2)
        
        # Send initial connection confirmation
        yield f"data: {json.dumps({'status': 'connected', 'message': 'Progress tracking connected'})}\n\n"
        
        # Wait for progress data to appear (up to 10 seconds)
        wait_count = 0
        while job_id not in deletion_progress and wait_count < 20:
            time.sleep(0.5)
            wait_count += 1
        
        if job_id not in deletion_progress:
            yield f"data: {json.dumps({'status': 'error', 'message': 'Progress data not found'})}\n\n"
            return
        
        # Stream progress updates
        while job_id in deletion_progress:
            progress_data = deletion_progress[job_id]
            yield f"data: {json.dumps(progress_data)}\n\n"
            
            if progress_data.get('status') == 'completed' or progress_data.get('status') == 'error':
                # Keep data for a moment to ensure client receives it
                time.sleep(1)
                # Clean up after completion
                if job_id in deletion_progress:
                    del deletion_progress[job_id]
                break
            
            # Wait before checking again
            time.sleep(0.3)
    
    # Create response with proper SSE headers
    response = Response(event_stream(), mimetype='text/event-stream')
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['Connection'] = 'keep-alive'
    response.headers['X-Accel-Buffering'] = 'no'  # Disable nginx buffering
    return response

def delete_library_background(library_uuid, job_id):
    """Background task for deleting a library with progress updates.

    Runs in its own application context, and therefore its own session. It used
    to run in a copy of the caller's request context, sharing the request's
    session while deleting every game in the library — the longest-running and
    most destructive of the workers that did that. Only the two ids cross into
    the thread; the library is re-fetched below.
    """
    def delete_task():
        import time
        try:
            library = db.session.execute(select(Library).filter_by(uuid=library_uuid)).scalar_one_or_none()
            if not library:
                deletion_progress[job_id] = {
                    'status': 'error',
                    'message': 'Library not found',
                    'current': 0,
                    'total': 0
                }
                return
            
            print(f"Background deletion of library: {library.name}")
            
            # Update progress - starting (give UI time to connect)
            deletion_progress[job_id].update({
                'status': 'starting',
                'message': f'Preparing to delete library "{library.name}"...',
                'current': 0,
                'total': 0
            })
            
            # Small delay to allow EventSource to connect
            time.sleep(0.5)
            
            # Safety check: Cancel any running scan jobs for this library first
            running_scan_jobs = db.session.execute(
                select(ScanJob).filter_by(library_uuid=library.uuid, status='Running')
            ).scalars().all()
            
            for running_job in running_scan_jobs:
                running_job.status = 'Failed'
                running_job.error_message = 'Scan cancelled due to library deletion'
                running_job.is_enabled = False
                print(f"Cancelled running scan job: {running_job.id}")
            
            if running_scan_jobs:
                db.session.commit()  # Commit the cancellation first
                print(f"Cancelled {len(running_scan_jobs)} running scan jobs before library deletion")
            
            # Get all games to delete
            games_to_delete = db.session.execute(select(Game).filter_by(library_uuid=library.uuid)).scalars().all()
            total_games = len(games_to_delete)
            games_deleted = 0
            games_failed = 0
            
            deletion_progress[job_id].update({
                'status': 'deleting_games',
                'total': total_games,
                'current': 0
            })
            
            # Delete games with progress updates
            for i, game in enumerate(games_to_delete, 1):
                try:
                    # Update progress
                    deletion_progress[job_id].update({
                        'current': i,
                        'message': f'Deleting game {i}/{total_games}',
                        'current_game': game.name
                    })
                    
                    # Use the existing delete_game function which handles all related data
                    delete_game(game.uuid)
                    games_deleted += 1
                    print(f'Successfully deleted game: {game.name}')
                    
                except FileNotFoundError as fnfe:
                    print(f'File not found for game {game.name} (UUID: {game.uuid}): {fnfe}')
                    games_deleted += 1  # Still count as deleted since it's not blocking
                except Exception as e:
                    print(f'Error deleting game {game.name} (UUID: {game.uuid}): {e}')
                    games_failed += 1
                    # Continue with other games instead of stopping
            
            # Update progress - cleaning up
            deletion_progress[job_id].update({
                'status': 'cleanup',
                'message': 'Cleaning up scan jobs and library data...',
                'current': total_games,
                'total': total_games
            })
            
            # Delete scan jobs related to this library
            scan_jobs = db.session.execute(select(ScanJob).filter_by(library_uuid=library.uuid)).scalars().all()
            for scan_job in scan_jobs:
                try:
                    db.session.delete(scan_job)
                    print(f'Deleted scan job: {scan_job.id}')
                except Exception as e:
                    print(f'Error deleting scan job {scan_job.id}: {e}')
            
            # Finally delete the library itself
            library_name = library.name
            db.session.delete(library)
            
            # Commit all changes
            db.session.commit()
            
            # Update progress - completed
            if games_failed == 0:
                message = f'Library "{library_name}" and all {games_deleted} games have been deleted successfully.'
            else:
                message = f'Library "{library_name}" deleted. {games_deleted} games deleted successfully, {games_failed} failed.'
            
            deletion_progress[job_id] = {
                'status': 'completed',
                'message': message,
                'current': total_games,
                'total': total_games,
                'games_deleted': games_deleted,
                'games_failed': games_failed,
                'library_name': library_name
            }
            
        except Exception as e:
            db.session.rollback()
            error_msg = f"Error during library deletion: {str(e)}"
            print(error_msg)
            deletion_progress[job_id] = {
                'status': 'error',
                'message': error_msg,
                'current': 0,
                'total': 0
            }
    
    # Start the background task
    return run_in_background(
        current_app._get_current_object(),
        delete_task,
        name=f'gametheca-delete-library-{str(library_uuid)[:8]}',
    )

@bp.route('/delete_full_library/<library_uuid>', methods=['POST'])
@login_required
@admin_required
def delete_full_library(library_uuid=None):
    print(f"Route: /delete_full_library - {current_user.name} - {current_user.role} method: {request.method} UUID: {library_uuid}")
    
    if not library_uuid:
        return api_error('No library specified', code='bad_request', body_status='error')
    
    # Get library info immediately for progress tracking
    library = db.session.execute(select(Library).filter_by(uuid=library_uuid)).scalar_one_or_none()
    if not library:
        return api_error('Library not found', code='not_found', body_status='error')

    # Optional server-side typed confirm (W22-1). Legacy Jinja clients omit these
    # and keep client-only typing. When confirm_name/force are present, enforce.
    data = request.get_json(silent=True) or {}
    force_raw = (
        data.get('force') if 'force' in data
        else (data.get('force_delete') if 'force_delete' in data
              else (request.form.get('force') or request.form.get('force_delete')
                    or request.args.get('force') or request.args.get('force_delete')))
    )
    confirm_raw = (
        data.get('confirm_name') if 'confirm_name' in data
        else (request.form.get('confirm_name') or request.args.get('confirm_name'))
    )
    if force_raw is not None or confirm_raw is not None:
        from gametheca.utils.library_batch import (
            parse_bool_flag,
            parse_confirm_names,
            require_confirm_or_force,
        )
        force = parse_bool_flag(force_raw, default=False)
        confirm_names = parse_confirm_names(data)
        confirm_err = require_confirm_or_force(
            library_uuid=library.uuid,
            library_name=library.name,
            force=force,
            confirm_names=confirm_names,
            single_confirm_name=str(confirm_raw) if confirm_raw is not None else None,
        )
        if confirm_err:
            confirm_message = (
                'Type the exact library name to confirm, or pass force=true '
                '(admin + CSRF still required).'
                if confirm_err == 'confirm_name_required'
                else 'confirm_name does not match library name.'
            )
            return api_error(
                confirm_message,
                code='bad_request',
                body_status='error',
                body_error=confirm_err,
                expected_name=library.name if confirm_err == 'confirm_name_mismatch' else None,
            )

    # Generate a unique job ID
    job_id = str(uuid.uuid4())

    # Create initial progress data immediately in main thread to prevent race condition
    deletion_progress[job_id] = {
        'status': 'initializing',
        'message': f'Preparing to delete library "{library.name}"...',
        'current': 0,
        'total': 0,
        'library_name': library.name
    }
    
    # Start background deletion
    delete_library_background(library_uuid, job_id)
    
    # Return job ID for progress tracking. admin_manage_libs.js reads
    # `data.status === 'started'` (job state, kept as data on api_ok).
    return api_ok({'status': 'started', 'job_id': job_id})

@bp.route('/check_deletion_progress/<job_id>')
@login_required
@admin_required
def check_deletion_progress(job_id):
    """Simple progress check endpoint as fallback for SSE"""
    # `status` on the live dict is job progress (`initializing` / `connected` /
    # `completed` / `error`), not an envelope marker. Wrapping with api_ok
    # would stamp ok=True onto a failed delete. admin_manage_libs.js branches
    # on it. Recorded in the envelope baseline on purpose.
    if job_id in deletion_progress:
        return jsonify(deletion_progress[job_id])
    return api_error('Job not found', code='not_found', body_status='not_found')

    
@bp.add_app_template_global
def verify_file(full_path):
    if os.path.exists(full_path) or os.access(full_path, os.R_OK):
        return True
    else:
        return False

# Version tokens for theme asset URLs, keyed by resolved filesystem path.
#
# Theme files are *mutable at the same URL*: Reset Themes rewrites
# static/library/themes/<theme>/… in place while every template still points at
# the identical path. Static responses carry `max-age=3600`, so a browser served
# the old stylesheet keeps it for an hour — which is why a reset appeared to do
# nothing and why "hard-refresh" was the standing workaround. Appending a token
# that changes with the file makes the URL new, so the cache is bypassed
# correctly rather than being asked not to cache.
#
# Memoised because a page links a few dozen of these and this can sit on a
# network path where stat() is not free. `clear_theme_asset_versions()` empties
# it, and Reset Themes calls it — that is what makes the reset visible.
_THEME_ASSET_VERSIONS: dict[str, str] = {}


def clear_theme_asset_versions():
    """Drop memoised asset versions. Call after anything that rewrites themes."""
    _THEME_ASSET_VERSIONS.clear()


def _theme_asset_version(fs_path: Path) -> str:
    key = str(fs_path)
    cached = _THEME_ASSET_VERSIONS.get(key)
    if cached is not None:
        return cached
    try:
        stat = fs_path.stat()
        token = f'{int(stat.st_mtime)}-{stat.st_size}'
    except OSError:
        # Missing file still gets a URL — the 404 is the honest answer, and a
        # made-up version would only hide which asset is absent.
        token = '0'
    _THEME_ASSET_VERSIONS[key] = token
    return token


@bp.app_template_filter('dist_asset')
@pass_context
def dist_asset_filter(_ctx, path):
    """Version a built SPA bundle URL so a rebuild is visible immediately.

    The theme tree got this treatment in W28 and the SPA dists did not, which
    left a gap nobody could see from either side. `asgi.py` serves anything
    outside `static/library/themes/` with `public, max-age=3600`, and these were
    linked at a bare, unchanging path — so after a deploy every browser kept the
    previous `member-app.css` and `member-app.js` for an hour.

    That produced symptoms that look like a CSS bug rather than a cache: a rule
    living in the theme (served `no-cache`) took effect at once while a rule in
    the bundle did not, so one half of a change would work and the other half
    appeared broken. A hovered tile clearing its neighbours *within* a row while
    still being covered by the row below is exactly that split — the card rule
    is in components.css, the row rule is in the bundle.

    Same token as `theme_asset`: mtime and size, memoised per resolved path.

    `@pass_context` for the same reason `theme_asset` needs it — every call site
    passes a literal, and Jinja folds a filter applied to a constant at compile
    time, which would bake one token in for the life of the process and undo the
    point of versioning after a rebuild-without-restart.
    """
    root = Path(current_app.root_path) / 'static'
    target = root / 'dist' / path
    return url_for(
        'static',
        filename=f'dist/{path}',
        v=_theme_asset_version(target),
    )


@bp.app_template_filter('avatar_url')
@pass_context
def avatar_url_filter(_ctx, path):
    """`{{ current_user.avatarpath|avatar_url }}` — themed for shipped avatars.

    `@pass_context` for exactly the reason `theme_asset` needs it, and it is
    load-bearing here too: `partials/rail.html` passes `current_user.avatarpath`
    (a variable, so safe), but a template passing a literal default would be
    constant-folded at compile time and freeze every install on whichever theme
    rendered it first. Marking the filter context-dependent makes the fold
    illegal everywhere rather than relying on every call site staying dynamic.
    """
    from gametheca.utils.avatar import avatar_url

    return avatar_url(path)


@bp.app_template_filter('theme_asset')
@pass_context
def theme_asset_filter(_ctx, path):
    """Convert a relative theme path to the correct themed URL with fallback to default.

    `@pass_context` is load-bearing and has nothing to do with the context.

    Every call site passes a string literal — `{{ 'css/base.css'|theme_asset }}` —
    and Jinja's optimiser constant-folds a filter applied to a constant at
    *compile* time, baking the returned URL into the compiled template. Flask
    caches compiled templates for the life of the process, so the whole install
    kept serving whichever theme happened to be current when each template was
    first rendered. Changing the theme updated `data-theme` on <html> (a real
    variable lookup, so never folded) while every stylesheet link stayed on the
    previous theme — which is exactly "changing the theme does nothing on
    reload", and why it looked like the preference had not saved.

    `nodes._FilterTestCommon.as_const` raises `Impossible` for a filter marked
    `_PassArg.context`, so this marker is what makes the fold illegal and the
    call happen per render. The context itself is unused; `current_user` still
    comes from the request. Do not "tidy" this decorator away — see
    tests/test_theme_asset.py::test_theme_asset_is_not_constant_folded.
    """
    from flask_login import current_user

    # Get current theme from user preferences or default
    if current_user.is_authenticated and hasattr(current_user, 'preferences') and current_user.preferences:
        current_theme = current_user.preferences.theme or 'default'
    else:
        current_theme = 'default'

    # Resolve against the app package root — not process CWD (Docker/uvicorn).
    root = Path(current_app.root_path) / 'static' / 'library' / 'themes'
    themed = root / current_theme / path
    if themed.is_file():
        return url_for(
            'static',
            filename=f'library/themes/{current_theme}/{path}',
            v=_theme_asset_version(themed),
        )

    # Fallback to default theme
    fallback = root / 'default' / path
    return url_for(
        'static',
        filename=f'library/themes/default/{path}',
        v=_theme_asset_version(fallback),
    )
