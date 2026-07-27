"""Admin remote play settings page (React shell)."""

from flask import render_template
from flask_login import login_required

from gametheca.utils.auth import admin_required

from . import admin2_bp


@admin2_bp.route('/admin/remote_play', methods=['GET'])
@login_required
@admin_required
def remote_play_page():
    return render_template('admin/admin_remote_play.html')
