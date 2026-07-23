"""Admin UI for library recognition tools: rename, proposals, doctor."""

from flask import render_template
from flask_login import login_required

from sharewarez.utils.auth import admin_required
from . import admin2_bp


@admin2_bp.route('/admin/library_tools', methods=['GET'])
@login_required
@admin_required
def library_tools_page():
    return render_template('admin/admin_library_tools.html')
