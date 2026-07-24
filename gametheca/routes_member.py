"""Member-facing pages: collections, news, wishlist, updates inbox."""

from pathlib import Path

from flask import Blueprint, current_app, redirect, render_template, send_from_directory, url_for
from flask_login import login_required, current_user

from gametheca.utils.rbac import is_librarian

member_bp = Blueprint('member', __name__)


@member_bp.route('/collections')
@login_required
def collections_page():
    return render_template(
        'site/collections.html',
        title='Collections',
        can_manage=True,
    )


@member_bp.route('/collections/<collection_uuid>')
@login_required
def collection_detail_page(collection_uuid: str):
    return render_template(
        'site/collection_detail.html',
        title='Collection',
        collection_uuid=collection_uuid,
    )


@member_bp.route('/news')
@login_required
def announcements_page():
    return render_template(
        'site/announcements.html',
        title='News',
        is_admin=current_user.role == 'admin',
    )


@member_bp.route('/wishlist')
@login_required
def wishlist_page():
    return render_template(
        'site/wishlist.html',
        title='Wishlist',
        is_admin=current_user.role == 'admin',
        is_librarian=is_librarian(current_user),
    )


@member_bp.route('/updates')
@login_required
def updates_page():
    """Freshness updates inbox — librarians/admins see library-wide inbox."""
    return render_template(
        'site/updates_inbox.html',
        title='Updates',
        can_manage_inbox=is_librarian(current_user),
    )


@member_bp.route('/playtime')
@login_required
def playtime_page():
    return render_template(
        'site/playtime.html',
        title='Playtime',
    )


@member_bp.route('/big-picture')
@login_required
def big_picture_page():
    return render_template(
        'site/big_picture.html',
        title='Big Picture',
    )


@member_bp.route('/ownership')
@login_required
def ownership_page():
    """Register-only store ownership sync — never downloads from stores."""
    return render_template(
        'site/ownership.html',
        title='Store Ownership',
    )


@member_bp.route('/calendar')
@login_required
def calendar_page():
    """IGDB release calendar (metadata only)."""
    return render_template(
        'site/calendar.html',
        title='Release calendar',
    )


@member_bp.route('/vr')
@login_required
def vr_browse_page():
    enabled = str(current_app.config.get('ENABLE_VR_BROWSE', '')).lower() in (
        '1', 'true', 'yes', 'on',
    )
    if not enabled:
        return redirect(url_for('library.library'))
    return render_template('site/vr_browse.html', title='VR Library')


@member_bp.route('/vr/sw.js')
def vr_service_worker():
    """Serve VR PWA service worker under /vr/ so scope is valid."""
    static_root = Path(current_app.static_folder or '')
    resp = send_from_directory(static_root, 'vr-sw.js', mimetype='application/javascript')
    resp.headers['Service-Worker-Allowed'] = '/vr'
    resp.headers['Cache-Control'] = 'no-cache'
    return resp

