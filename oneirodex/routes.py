# oneirodex/routes.py
import os
from pathlib import Path
from flask import (
    render_template, flash, redirect, url_for, request, Blueprint,
    jsonify, session, abort, current_app
)
from flask_login import current_user, login_required
from sqlalchemy.orm import joinedload
from sqlalchemy import func, select
from oneirodex import db, cache
from itsdangerous import URLSafeTimedSerializer
from jinja2 import pass_context

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
from oneirodex.utils.browse_query import run_browse_query
from oneirodex.utils.browse_payload import build_browse_payload
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
