# /gametheca/routes_apis/library.py
from flask import current_app, jsonify, request, url_for
from flask_login import login_required, current_user
from gametheca import db
from gametheca.models import Library
from gametheca.platform import LibraryPlatform
from gametheca.utils.auth import admin_required
from gametheca.utils.event_logging import log_system_event
from gametheca.utils.library_acl import filter_libraries, user_can_access_library
from gametheca.utils.library_batch import (
    LIBRARY_BATCH_DELETE_CAP,
    LIBRARY_BATCH_UUID_CAP,
    parse_bool_flag,
    parse_confirm_names,
    parse_library_uuids,
    require_confirm_or_force,
)
from gametheca.utils.library_watch import (
    is_library_watch_enabled,
    library_watch_effective,
)
from gametheca.utils.rbac import is_librarian
from sqlalchemy import select
from uuid import uuid4
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


def _library_public_fields(library: Library) -> dict:
    return {
        'uuid': library.uuid,
        'name': library.name,
        'platform': library.platform.name if library.platform else None,
        'scan_depth': int(getattr(library, 'scan_depth', 1) or 1),
        'last_scan_folder': getattr(library, 'last_scan_folder', None),
        **_library_watch_payload(library),
    }


def _cap_error(cap: int):
    return jsonify({
        'ok': False,
        'error': f'library_uuids cap is {cap}',
        'cap': cap,
        'status': 'rejected',
    }), 400


def _start_library_delete_job(library: Library) -> str:
    """Enqueue background library deletion; returns job_id."""
    from gametheca.routes import delete_library_background, deletion_progress

    job_id = str(uuid4())
    deletion_progress[job_id] = {
        'status': 'initializing',
        'message': f'Preparing to delete library "{library.name}"...',
        'current': 0,
        'total': 0,
        'library_name': library.name,
        'library_uuid': library.uuid,
    }
    delete_library_background(library.uuid, job_id)
    return job_id


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
        
    return jsonify(_library_public_fields(library))


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


@apis_bp.route('/admin/libraries/batch/scan', methods=['POST'])
@login_required
@admin_required
def batch_scan_libraries():
    """Multi-select scan start/queue for libraries (W22-1 / UID-003).

    Body:
      library_uuids: string[] (required; alias ``uuids``; or singular ``library_uuid``)
      folder / folders: optional shared folder or ``{uuid: path}`` map
      scan_mode, remove_missing, download_missing_images, force_updates_extras
      force_parallel / queue_policy — same as single ``/api/admin/libraries/scan``

    Partial success. Cap ``LIBRARY_BATCH_UUID_CAP``.
    """
    from gametheca.utils.scan_queue import (
        FORCE_PARALLEL_RISK,
        parse_force_parallel,
        parse_queue_policy,
        start_or_queue_scan,
    )

    data = request.get_json(silent=True) or {}
    uuids, err = parse_library_uuids(data)
    if err:
        payload, status = err
        return jsonify(payload), status
    if len(uuids) > LIBRARY_BATCH_UUID_CAP:
        return _cap_error(LIBRARY_BATCH_UUID_CAP)

    folders_map = data.get('folders') if isinstance(data.get('folders'), dict) else {}
    shared_folder = data.get('folder')
    scan_mode = data.get('scan_mode') or 'folders'
    force_raw = data.get('force_parallel')
    policy_raw = data.get('queue_policy')
    queue_policy = parse_queue_policy(policy_raw, force_parallel=force_raw)

    def _bool(key, default=False):
        return parse_bool_flag(data.get(key), default=default)

    results = []
    started = 0
    queued = 0
    skipped = 0
    failed = 0
    for library_uuid in uuids:
        library = db.session.execute(
            select(Library).filter_by(uuid=library_uuid)
        ).scalars().first()
        if not library:
            results.append({
                'uuid': library_uuid,
                'ok': False,
                'error': 'not_found',
                'status': 'rejected',
            })
            failed += 1
            continue
        folder = (
            folders_map.get(library_uuid)
            or shared_folder
            or library.last_scan_folder
        )
        if not folder:
            results.append({
                'uuid': library_uuid,
                'name': library.name,
                'ok': False,
                'error': 'no_scan_folder',
                'status': 'skipped',
                'message': (
                    'No folder provided and library has no last_scan_folder. '
                    'Run one Auto Scan first or pass folder/folders.'
                ),
            })
            skipped += 1
            continue
        try:
            result = start_or_queue_scan(
                folder_path=folder,
                library_uuid=library_uuid,
                scan_mode=scan_mode,
                remove_missing=_bool('remove_missing'),
                download_missing_images=_bool('download_missing_images'),
                force_updates_extras_scan=_bool('force_updates_extras'),
                queue_policy=queue_policy,
                allow_force=True,
                app=current_app._get_current_object(),
            )
            row = {
                'uuid': library_uuid,
                'name': library.name,
                'ok': result.get('status') in ('started', 'queued'),
                'status': result.get('status'),
                'job_id': result.get('job_id'),
                'position': result.get('position'),
                'message': result.get('message'),
                'coalesced': result.get('coalesced'),
            }
            if result.get('status') == 'started' and parse_force_parallel(force_raw):
                row['risk'] = FORCE_PARALLEL_RISK
            if result.get('status') == 'started':
                started += 1
            elif result.get('status') == 'queued':
                queued += 1
            else:
                failed += 1
                row['ok'] = False
                row['error'] = result.get('message') or result.get('status') or 'rejected'
            results.append(row)
        except Exception as exc:
            results.append({
                'uuid': library_uuid,
                'name': library.name,
                'ok': False,
                'error': str(exc),
                'status': 'error',
            })
            failed += 1

    log_system_event(
        (
            f"Batch library scan by {getattr(current_user, 'name', 'admin')}: "
            f"started={started} queued={queued} skipped={skipped} failed={failed}"
        ),
        event_type='library',
        event_level='information',
        audit_user=getattr(current_user, 'id', None),
    )
    return jsonify({
        'ok': True,
        'started': started,
        'queued': queued,
        'skipped': skipped,
        'failed': failed,
        'count': len(uuids),
        'results': results,
    })


@apis_bp.route('/admin/libraries/batch/edit', methods=['POST'])
@login_required
@admin_required
def batch_edit_libraries():
    """Apply shared field updates to selected libraries (W22-1 / UID-003).

    Body:
      library_uuids: string[] (required)
      scan_depth?: 1|2
      watch_enabled?: true|false|null
      platform?: LibraryPlatform enum name (e.g. PCWIN, N64)
      Optional ``items``: [{uuid|library_uuid, scan_depth?, watch_enabled?, platform?}]
        for per-row overrides (merged over shared fields).

    Does **not** rename (use single edit for name/image). Cap 100. Partial OK.
    """
    data = request.get_json(silent=True) or {}
    uuids, err = parse_library_uuids(data)
    if err:
        payload, status = err
        return jsonify(payload), status
    if len(uuids) > LIBRARY_BATCH_UUID_CAP:
        return _cap_error(LIBRARY_BATCH_UUID_CAP)

    items_by_uuid: dict[str, dict] = {}
    raw_items = data.get('items')
    if isinstance(raw_items, list):
        for item in raw_items:
            if not isinstance(item, dict):
                continue
            key = str(item.get('uuid') or item.get('library_uuid') or '').strip()
            if key:
                items_by_uuid[key] = item

    shared_keys = ('scan_depth', 'watch_enabled', 'platform')
    has_shared = any(k in data for k in shared_keys)
    if not has_shared and not items_by_uuid:
        return jsonify({
            'ok': False,
            'error': 'Provide scan_depth and/or watch_enabled and/or platform (or items[])',
            'status': 'rejected',
        }), 400

    results = []
    updated = 0
    skipped = 0
    failed = 0

    for library_uuid in uuids:
        library = db.session.execute(
            select(Library).filter_by(uuid=library_uuid)
        ).scalars().first()
        if not library:
            results.append({
                'uuid': library_uuid,
                'ok': False,
                'error': 'not_found',
            })
            failed += 1
            continue

        patch = {k: data[k] for k in shared_keys if k in data}
        if library_uuid in items_by_uuid:
            for key in shared_keys:
                if key in items_by_uuid[library_uuid]:
                    patch[key] = items_by_uuid[library_uuid][key]

        if not patch:
            results.append({
                'uuid': library_uuid,
                'name': library.name,
                'ok': False,
                'error': 'no_fields',
                'status': 'skipped',
            })
            skipped += 1
            continue

        changed = []
        try:
            if 'scan_depth' in patch:
                depth = int(patch['scan_depth'])
                if depth not in (1, 2):
                    raise ValueError('scan_depth must be 1 or 2')
                if int(getattr(library, 'scan_depth', 1) or 1) != depth:
                    library.scan_depth = depth
                    changed.append('scan_depth')
            if 'watch_enabled' in patch:
                new_watch = _parse_watch_enabled(patch['watch_enabled'])
                if getattr(library, 'watch_enabled', None) != new_watch:
                    library.watch_enabled = new_watch
                    changed.append('watch_enabled')
            if 'platform' in patch:
                plat_raw = str(patch['platform'] or '').strip()
                try:
                    new_plat = LibraryPlatform[plat_raw]
                except KeyError:
                    try:
                        new_plat = LibraryPlatform(plat_raw)
                    except ValueError as exc:
                        raise ValueError(f'Invalid platform: {plat_raw}') from exc
                if library.platform != new_plat:
                    library.platform = new_plat
                    changed.append('platform')

            if not changed:
                results.append({
                    'uuid': library_uuid,
                    'name': library.name,
                    'ok': True,
                    'status': 'unchanged',
                    'changed': [],
                    **_library_public_fields(library),
                })
                skipped += 1
                continue

            db.session.commit()
            updated += 1
            results.append({
                'uuid': library_uuid,
                'ok': True,
                'status': 'updated',
                'changed': changed,
                **_library_public_fields(library),
            })
        except ValueError as exc:
            db.session.rollback()
            results.append({
                'uuid': library_uuid,
                'name': library.name,
                'ok': False,
                'error': str(exc),
            })
            failed += 1
        except Exception as exc:
            db.session.rollback()
            results.append({
                'uuid': library_uuid,
                'name': library.name,
                'ok': False,
                'error': str(exc),
            })
            failed += 1

    if updated:
        log_system_event(
            (
                f"Batch library edit by {getattr(current_user, 'name', 'admin')}: "
                f"updated={updated} skipped={skipped} failed={failed}"
            ),
            event_type='library',
            event_level='information',
            audit_user=getattr(current_user, 'id', None),
        )

    return jsonify({
        'ok': True,
        'updated': updated,
        'skipped': skipped,
        'failed': failed,
        'count': len(uuids),
        'results': results,
    })


@apis_bp.route('/admin/libraries/batch/delete', methods=['POST'])
@login_required
@admin_required
def batch_delete_libraries():
    """Multi-select library delete with typed-name confirm or force (W22-1).

    Body:
      library_uuids: string[] (required; cap 50)
      force: bool — when true, skip per-name typing (still admin + CSRF)
      confirm_names: {uuid: exactName} — required when force is false
      confirm_name: string — optional single phrase applied to every uuid
        when confirm_names omits that uuid

    Starts background delete jobs (same as ``/delete_full_library/<uuid>``).
    Progress: ``GET /delete_library_progress/<job_id>`` or
    ``GET /check_deletion_progress/<job_id>``.
    """
    data = request.get_json(silent=True) or {}
    uuids, err = parse_library_uuids(data)
    if err:
        payload, status = err
        return jsonify(payload), status
    if len(uuids) > LIBRARY_BATCH_DELETE_CAP:
        return _cap_error(LIBRARY_BATCH_DELETE_CAP)

    force = parse_bool_flag(
        data.get('force') if 'force' in data else data.get('force_delete'),
        default=False,
    )
    confirm_names = parse_confirm_names(data)
    single_confirm = data.get('confirm_name')
    if single_confirm is not None:
        single_confirm = str(single_confirm)

    if not force and not confirm_names and (
        single_confirm is None or not str(single_confirm).strip()
    ):
        return jsonify({
            'ok': False,
            'status': 'rejected',
            'error': 'confirm_name_required',
            'message': (
                'Provide confirm_names {uuid: exact library name} for each '
                'selection, or force=true to skip typed confirmation '
                '(admin + CSRF still required).'
            ),
        }), 400

    results = []
    started = 0
    failed = 0
    for library_uuid in uuids:
        library = db.session.execute(
            select(Library).filter_by(uuid=library_uuid)
        ).scalars().first()
        if not library:
            results.append({
                'uuid': library_uuid,
                'ok': False,
                'error': 'not_found',
                'status': 'rejected',
            })
            failed += 1
            continue

        confirm_err = require_confirm_or_force(
            library_uuid=library_uuid,
            library_name=library.name,
            force=force,
            confirm_names=confirm_names,
            single_confirm_name=single_confirm,
        )
        if confirm_err:
            results.append({
                'uuid': library_uuid,
                'name': library.name,
                'ok': False,
                'error': confirm_err,
                'status': 'rejected',
                'expected_name': library.name if confirm_err == 'confirm_name_mismatch' else None,
            })
            failed += 1
            continue

        try:
            job_id = _start_library_delete_job(library)
            started += 1
            results.append({
                'uuid': library_uuid,
                'name': library.name,
                'ok': True,
                'status': 'started',
                'job_id': job_id,
                'force': force,
            })
        except Exception as exc:
            results.append({
                'uuid': library_uuid,
                'name': library.name,
                'ok': False,
                'error': str(exc),
                'status': 'error',
            })
            failed += 1

    log_system_event(
        (
            f"Batch library delete by {getattr(current_user, 'name', 'admin')}: "
            f"started={started} failed={failed} force={force}"
        ),
        event_type='library',
        event_level='warning' if force else 'information',
        audit_user=getattr(current_user, 'id', None),
    )

    http = 200 if started else 400
    return jsonify({
        'ok': started > 0,
        'started': started,
        'failed': failed,
        'count': len(uuids),
        'force': force,
        'results': results,
        'progress_hint': {
            'sse': '/delete_library_progress/<job_id>',
            'poll': '/check_deletion_progress/<job_id>',
        },
    }), http
