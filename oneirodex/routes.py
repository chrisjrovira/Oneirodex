# oneirodex/routes.py
from flask import (
    render_template, flash, redirect, url_for, request, Blueprint,
    jsonify, session, abort, current_app
)
from flask_login import current_user, login_required
from sqlalchemy.orm import joinedload
from sqlalchemy import func, select
from oneirodex import db, cache
from itsdangerous import URLSafeTimedSerializer

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
from oneirodex.utils.unmatched import handle_delete_unmatched
from oneirodex.utils.processors import get_global_settings
from oneirodex.utils.library_acl import apply_game_access_filters
bp = Blueprint('main', __name__)

def get_serializer():
    """Get URLSafeTimedSerializer with current app's secret key."""
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
has_initialized_whitelist = False
has_upgraded_admin = False
has_initialized_setup = False

@bp.context_processor
@cache.cached(timeout=500, key_prefix='global_settings')
def inject_settings():
    """Context processor to inject global settings into templates"""
    return get_global_settings()


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
