"""Admin UI for library recognition tools: rename, proposals, doctor."""

from flask import render_template
from flask_login import login_required
from sqlalchemy import select

from gametheca import db
from gametheca.models import Library
from gametheca.utils.auth import admin_required
from . import admin2_bp


@admin2_bp.route('/admin/library_tools', methods=['GET'])
@login_required
@admin_required
def library_tools_page():
    libraries = db.session.execute(select(Library).order_by(Library.name)).scalars().all()
    return render_template('admin/admin_library_tools.html', libraries=libraries)
