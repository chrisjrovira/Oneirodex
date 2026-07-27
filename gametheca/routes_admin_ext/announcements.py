"""Admin announcements composer shell (React SPA page)."""

from flask import render_template
from flask_login import login_required

from gametheca.utils.auth import admin_required

from . import admin2_bp


@admin2_bp.route('/admin/announcements', methods=['GET'])
@login_required
@admin_required
def announcements_page():
    """Shell for the React announcements composer."""
    return render_template('admin/admin_announcements.html')
