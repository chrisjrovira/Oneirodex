# oneirodex/routes.py
import uuid, json, os
from pathlib import Path
from flask import (
    render_template, flash, redirect, url_for, request, Blueprint,
    jsonify, session, abort, current_app, Response
)
from flask_login import current_user, login_required
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import joinedload
from sqlalchemy import func, select, delete, and_
from oneirodex import db, cache
from itsdangerous import URLSafeTimedSerializer
from jinja2 import pass_context

from oneirodex.utils.api_response import api_error, api_ok
from oneirodex.forms import (
    ScanFolderForm, CsrfProtectForm,
    AutoScanForm, UpdateUnmatchedFolderForm,
    ReleaseGroupForm
)
from oneirodex.models import (
    Game, ScanJob, UnmatchedFolder,
    Genre, Theme, GameMode, PlayerPerspective,
    Category, Library, Platform,
    ReleaseGroup, AllowedFileType, GlobalSettings, user_game_status,
    GameUpdate, user_favorites, GameExtra,
)
from oneirodex.utils.game_editions import normalize_title
from oneirodex.utils.functions import (
    igdb_platform_id_for,
    normalize_case_sensitive,
)
from oneirodex.utilities import handle_auto_scan, handle_manual_scan
from oneirodex.utils.auth import admin_required
from oneirodex.utils.background import run_in_background
from oneirodex.utils.game_core import delete_game
from oneirodex.utils.unmatched import handle_delete_unmatched
from oneirodex.utils.processors import get_global_settings
from oneirodex.utils.library_acl import apply_game_access_filters
from oneirodex.utils.browse_query import run_browse_query
from oneirodex.utils.browse_payload import build_browse_payload
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
    """Library grid for the member SPA.

    Arg parsing, filters and the per-page batch lookups are
    :func:`oneirodex.utils.browse_query.run_browse_query`; the response body
    (populated or guaranteed-empty, same shape either way) is
    :func:`oneirodex.utils.browse_payload.build_browse_payload`.
    """
    result = run_browse_query(request.args, current_user)
    return jsonify(build_browse_payload(result))


@bp.route('/admin/scan_management', methods=['GET'])
@login_required
@admin_required
def scan_management_admin_alias():
    """`/admin/scan_management` -> `/scan_management`, query string intact.

    Every other admin destination lives under `/admin/*`, but the rail links
    the image queue at `/scan_management?active_tab=image_queue`, so an
    operator who reasons from the pattern (or edits a URL) lands on a 404. The
    view itself is unchanged and already carries `@admin_required`, so this is
    a naming inconsistency rather than an access one — the alias just makes the
    namespace hold. `request.args` is forwarded so `?active_tab=` survives.
    """
    return redirect(url_for('main.scan_management', **request.args.to_dict(flat=True)))


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
        platform_id = igdb_platform_id_for(lib_platform)
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
        name=f'oneirodex-delete-library-{str(library_uuid)[:8]}',
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
        from oneirodex.utils.library_batch import (
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
    from oneirodex.utils.avatar import avatar_url

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
