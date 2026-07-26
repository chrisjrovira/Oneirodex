"""Member-facing pages: collections, news, wishlist, updates inbox."""

from pathlib import Path

from flask import Blueprint, current_app, redirect, send_from_directory, url_for
from flask_login import login_required

from gametheca.utils.member_spa import render_member_spa

member_bp = Blueprint('member', __name__)


@member_bp.route('/systems')
@login_required
def systems_page():
    return render_member_spa(title='Systems')


@member_bp.route('/collections')
@login_required
def collections_page():
    return render_member_spa(title='Collections')


@member_bp.route('/collections/<collection_uuid>')
@login_required
def collection_detail_page(collection_uuid: str):
    return render_member_spa(title='Collection', collection_uuid=collection_uuid)


@member_bp.route('/news')
@login_required
def announcements_page():
    return render_member_spa(title='News')


@member_bp.route('/wishlist')
@login_required
def wishlist_page():
    return render_member_spa(title='Wishlist')


@member_bp.route('/updates')
@login_required
def updates_page():
    """Freshness updates inbox — librarians/admins see library-wide inbox."""
    return render_member_spa(title='Updates')


@member_bp.route('/acquire')
@login_required
def acquire_page():
    """BYO indexer/debrid acquire panel (feature-flagged on the API)."""
    return render_member_spa(title='Acquire')


@member_bp.route('/playtime')
@login_required
def playtime_page():
    return render_member_spa(title='Playtime')


@member_bp.route('/activity')
@login_required
def activity_page():
    return render_member_spa(title='Activity')


@member_bp.route('/big-picture')
@login_required
def big_picture_page():
    return render_member_spa(title='Big Picture')


@member_bp.route('/ownership')
@login_required
def ownership_page():
    """Register-only store ownership sync — never downloads from stores."""
    return render_member_spa(title='Store Ownership')


@member_bp.route('/calendar')
@login_required
def calendar_page():
    """IGDB release calendar (metadata only)."""
    return render_member_spa(title='Release calendar')


@member_bp.route('/vr')
@login_required
def vr_browse_page():
    enabled = str(current_app.config.get('ENABLE_VR_BROWSE', '')).lower() in (
        '1', 'true', 'yes', 'on',
    )
    if not enabled:
        return redirect(url_for('library.library'))
    return render_member_spa(title='VR Library')


@member_bp.route('/vr/sw.js')
def vr_service_worker():
    """Serve VR PWA service worker under /vr/ so scope is valid."""
    static_root = Path(current_app.static_folder or '')
    resp = send_from_directory(static_root, 'vr-sw.js', mimetype='application/javascript')
    resp.headers['Service-Worker-Allowed'] = '/vr'
    resp.headers['Cache-Control'] = 'no-cache'
    return resp
