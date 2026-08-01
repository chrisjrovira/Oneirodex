# /gametheca/routes_apis/library.py
from flask import jsonify, request, url_for
from flask_login import login_required, current_user
from gametheca import db
from gametheca.models import Library
from gametheca.utils.auth import admin_required
from gametheca.utils.library_acl import filter_libraries, user_can_access_library
from gametheca.utils.library_watch import (
    is_library_watch_enabled,
    library_watch_effective,
)
from gametheca.utils.rbac import is_librarian
from sqlalchemy import select
from . import apis_bp


def _parse_watch_enabled(raw):
    """Parse API/form watch_enabled → True | False | None (follow global)."""
    if raw is None:
        return None
    if isinstance(raw, bool):
        return raw
    text = str(raw).strip().lower()
    if text in ('', 'null', 'none', 'default', 'follow', 'global'):
        return None
    if text in ('1', 'true', 'yes', 'on', 'enabled'):
        return True
    if text in ('0', 'false', 'no', 'off', 'disabled'):
        return False
    raise ValueError(f'Invalid watch_enabled: {raw!r}')


def _library_watch_payload(library: Library) -> dict:
    flag = getattr(library, 'watch_enabled', None)
    return {
        'watch_enabled': flag,
        'watch_effective': library_watch_effective(library),
        'watch_global_enabled': is_library_watch_enabled(),
    }


@apis_bp.route('/get_libraries')
@login_required
def get_libraries():
    # Direct query to the Library model, ordered alphabetically by name
    libraries_query = filter_libraries(
        db.session.execute(select(Library).order_by(Library.name.asc())).scalars().all(),
        current_user,
    )
    libraries = [
        {
            'uuid': lib.uuid,
            'name': lib.name,
            'image_url': lib.image_url if lib.image_url else url_for('static', filename='newstyle/default_library.jpg'),
            **_library_watch_payload(lib),
        } for lib in libraries_query
    ]
    print(f"Returning {len(libraries)} libraries.")
    return jsonify(libraries)

@apis_bp.route('/reorder_libraries', methods=['POST'])
@login_required
@admin_required
def reorder_libraries():
    try:
        new_order = request.json.get('order', [])
        for index, library_uuid in enumerate(new_order):
            library = db.session.get(Library, library_uuid)
            if library:
                library.display_order = index
        db.session.commit()
        return jsonify({'status': 'success'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500

@apis_bp.route('/library/<string:library_uuid>', methods=['GET'])
@login_required
def get_library(library_uuid):
    """Return information about a specific library"""
    if not user_can_access_library(current_user, library_uuid):
        return jsonify({'error': 'Forbidden'}), 403
    library = db.session.execute(select(Library).filter_by(uuid=library_uuid)).scalars().first()
    if not library:
        return jsonify({'error': 'Library not found'}), 404
        
    return jsonify({
        'uuid': library.uuid,
        'name': library.name,
        'platform': library.platform.name,
        'scan_depth': int(getattr(library, 'scan_depth', 1) or 1),
        'last_scan_folder': getattr(library, 'last_scan_folder', None),
        **_library_watch_payload(library),
    })


@apis_bp.route('/library/<string:library_uuid>/watch', methods=['GET', 'PUT'])
@login_required
def library_watch(library_uuid):
    """Get or set per-library incremental watch intent under ``GT_LIBRARY_WATCH``.

    PUT body: ``{"watch_enabled": true|false|null}``
      - null / omit on GET-only → follow global when env on
      - false → opt-out even when ``GT_LIBRARY_WATCH=1``
      - true → prefer watch (still requires env master switch)

    Librarian or admin required for PUT.
    """
    if not user_can_access_library(current_user, library_uuid):
        return jsonify({'error': 'Forbidden'}), 403
    library = db.session.execute(select(Library).filter_by(uuid=library_uuid)).scalars().first()
    if not library:
        return jsonify({'error': 'Library not found'}), 404

    if request.method == 'GET':
        return jsonify({
            'uuid': library.uuid,
            'name': library.name,
            **_library_watch_payload(library),
        })

    if not is_librarian(current_user):
        return jsonify({'error': 'Librarian or admin required'}), 403

    data = request.get_json(silent=True) or {}
    if 'watch_enabled' not in data:
        return jsonify({'error': 'watch_enabled required (true|false|null)'}), 400
    try:
        library.watch_enabled = _parse_watch_enabled(data.get('watch_enabled'))
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    db.session.commit()
    return jsonify({
        'uuid': library.uuid,
        'name': library.name,
        **_library_watch_payload(library),
    })
