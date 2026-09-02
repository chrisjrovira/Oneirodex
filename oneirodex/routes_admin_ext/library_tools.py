"""Admin UI for library recognition tools: rename, proposals, doctor.

The tools themselves live as a tab of Libraries & scans
(`/scan_management?active_tab=tools`). This route keeps old bookmarks working.
"""

from flask import redirect, url_for
from flask_login import login_required

from oneirodex.utils.auth import admin_required
from . import admin2_bp


@admin2_bp.route('/admin/library_tools', methods=['GET'])
@login_required
@admin_required
def library_tools_page():
    return redirect(url_for('main.scan_management', active_tab='tools'))
