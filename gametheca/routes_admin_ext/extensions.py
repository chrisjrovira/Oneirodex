from flask import render_template
from flask_login import login_required
from gametheca.utils.auth import admin_required
from gametheca.models import AllowedFileType
from gametheca import db
from sqlalchemy import select
from . import admin2_bp

@admin2_bp.route('/admin/extensions')
@login_required
@admin_required
def extensions():
    allowed_types = db.session.execute(select(AllowedFileType).order_by(AllowedFileType.value.asc())).scalars().all()
    return render_template('admin/admin_manage_extensions.html', 
                         allowed_types=allowed_types)
