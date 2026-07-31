# /gametheca/routes_apis/scan.py
import csv
import io
import os

from flask import jsonify, current_app, request, Response
from flask_login import login_required, current_user
from gametheca import db
from gametheca.models import ScanJob, UnmatchedFolder, Library, Game, DuplicateFixLog, Image
from sqlalchemy import select
from gametheca.utils.auth import admin_required
from gametheca.utils.cover_url import resolve_game_cover_url
from gametheca.utils.duplicate_check import explain_duplicate_match, folder_basename, should_mark_as_duplicate
from gametheca.utils.event_logging import log_system_event
from gametheca.utils.functions import PLATFORM_IDS
from . import apis_bp

VALID_UNMATCHED_EXPORT_STATUSES = {'all', 'Unmatched', 'Duplicate', 'Ignore', 'Pending'}
VALID_DUPLICATE_FIX_ACTIONS = {'merge', 'keep', 'ignore'}


def _suggested_kind_fields(folder: UnmatchedFolder) -> dict:
    """Cheap list/export hint fields denormalized on UnmatchedFolder (no sidecar I/O)."""
    from gametheca.utils.match_proposal import SUGGESTED_KIND_LABELS

    kind = getattr(folder, 'suggested_kind', None) or None
    if kind:
        kind = str(kind).strip().lower() or None
    label = SUGGESTED_KIND_LABELS.get(kind) if kind else None
    candidate = getattr(folder, 'suggested_candidate_name', None) or None
    if candidate:
        candidate = str(candidate).strip() or None
    return {
        'suggested_kind': kind,
        'suggested_kind_label': label,
        'suggested_candidate_name': candidate,
    }


def _why_unmatched_fields(
    folder: UnmatchedFolder,
    kind_fields: dict | None = None,
    *,
    match_reason=None,
    match_score=None,
    use_overrides: bool = False,
) -> dict:
    """Deterministic one-liner + folder basename for UI explainer (no disk I/O)."""
    from gametheca.utils.match_proposal import format_why_unmatched

    kind_fields = kind_fields if kind_fields is not None else _suggested_kind_fields(folder)
    name = folder_basename(folder.folder_path) or None
    summary = format_why_unmatched(
        status=getattr(folder, 'status', None),
        match_reason=match_reason if use_overrides else getattr(folder, 'match_reason', None),
        match_score=match_score if use_overrides else getattr(folder, 'match_score', None),
        suggested_kind=kind_fields.get('suggested_kind'),
        suggested_kind_label=kind_fields.get('suggested_kind_label'),
        suggested_candidate_name=kind_fields.get('suggested_candidate_name'),
        folder_name=name,
    )
    return {
        'folder_name': name,
        'why_unmatched': summary,
        'unmatched_reason': summary,  # alias for UI
    }


def _unmatched_list_row(folder: UnmatchedFolder, library_name, platform) -> dict:
    kind_fields = _suggested_kind_fields(folder)
    row = {
        'id': folder.id,
        'folder_path': folder.folder_path,
        'status': folder.status,
        'library_name': library_name,
        'platform_name': platform.name if platform else '',
        'platform_id': PLATFORM_IDS.get(platform.name) if platform else None,
        'matched_game_uuid': getattr(folder, 'matched_game_uuid', None),
        'match_reason': getattr(folder, 'match_reason', None),
        'match_score': getattr(folder, 'match_score', None),
    }
    row.update(kind_fields)
    row.update(_why_unmatched_fields(folder, kind_fields))
    return row


def _cover_for_game(game) -> str | None:
    if game is None:
        return None
    cover = db.session.execute(
        select(Image).filter_by(game_uuid=game.uuid, image_type='cover').limit(1)
    ).scalars().first()
    try:
        return resolve_game_cover_url(game, cover)
    except Exception:
        return None


def _duplicate_compare_payload(folder: UnmatchedFolder, matched_game: Game | None) -> dict:
    """Build UI glance fields for a Duplicate unmatched row."""
    candidates = []
    match_reason = getattr(folder, 'match_reason', None)
    match_score = getattr(folder, 'match_score', None)

    if matched_game is not None:
        explanation = explain_duplicate_match(
            matched_game,
            folder.folder_path or '',
            folder_basename(folder.folder_path),
        )
        if match_reason is None:
            match_reason = explanation.get('match_reason')
        if match_score is None:
            match_score = explanation.get('match_score')
        candidates.append({
            'uuid': matched_game.uuid,
            'id': matched_game.id,
            'name': matched_game.name,
            'cover_url': _cover_for_game(matched_game),
            'path': matched_game.full_disk_path,
            'igdb_id': matched_game.igdb_id,
            'match_reason': match_reason,
            'match_score': match_score,
        })

    folder_title = folder_basename(folder.folder_path) or folder.folder_path
    kind_fields = _suggested_kind_fields(folder)
    why_fields = _why_unmatched_fields(
        folder,
        kind_fields,
        match_reason=match_reason,
        match_score=match_score,
        use_overrides=True,
    )
    return {
        'id': folder.id,
        'folder_path': folder.folder_path,
        'status': folder.status,
        'library_uuid': folder.library_uuid,
        'matched_game_uuid': getattr(folder, 'matched_game_uuid', None),
        'match_reason': match_reason,
        'match_score': match_score,
        **kind_fields,
        **why_fields,
        'titles': [
            {
                'role': 'unmatched_folder',
                'uuid': None,
                'id': None,
                'name': folder_title,
                'cover_url': None,
                'path': folder.folder_path,
                'igdb_id': None,
            },
            *[
                {
                    'role': 'library_game',
                    **c,
                }
                for c in candidates
            ],
        ],
        'candidates': candidates,
    }


@apis_bp.route('/scan_jobs_status', methods=['GET'])
@login_required
@admin_required
def scan_jobs_status():
    jobs = db.session.execute(select(ScanJob).order_by(ScanJob.last_run.desc())).scalars().all()
    jobs_data = []
    for job in jobs:
        folders_success = job.folders_success or 0
        folders_failed = job.folders_failed or 0
        total_folders = job.total_folders or 0
        processed = folders_success + folders_failed
        jobs_data.append({
            'id': job.id,
            'library_name': job.library.name if job.library else 'No Library Assigned',
            'library_uuid': job.library_uuid,
            'folders': job.folders,
            'status': job.status,
            'total_folders': total_folders,
            'folders_success': folders_success,
            'folders_failed': folders_failed,
            'removed_count': job.removed_count or 0,
            'scan_folder': job.scan_folder,
            'setting_remove': bool(job.setting_remove),
            'setting_filefolder': bool(job.setting_filefolder),
            'setting_download_missing_images': bool(job.setting_download_missing_images),
            'current_processing': job.current_processing,
            'error_message': job.error_message or '',
            'last_run': job.last_run.strftime('%Y-%m-%d %H:%M:%S') if job.last_run else 'Not Available',
            'last_update': job.last_progress_update.isoformat() if job.last_progress_update else None,
            'next_run': job.next_run.strftime('%Y-%m-%d %H:%M:%S') if job.next_run else 'Not Scheduled',
            'progress_percentage': round(processed / total_folders * 100, 1) if total_folders > 0 else 0,
        })
    return jsonify(jobs_data)


@apis_bp.route('/unmatched_folders', methods=['GET'])
@login_required
@admin_required
def unmatched_folders():
    unmatched = db.session.execute(
        select(UnmatchedFolder, Library.name.label('library_name'), Library.platform)
        .join(Library)
        .order_by(UnmatchedFolder.status.desc())
    ).all()

    unmatched_data = [
        _unmatched_list_row(folder, library_name, platform)
        for folder, library_name, platform in unmatched
    ]

    return jsonify(unmatched_data)


@apis_bp.route('/unmatched_folders/duplicates', methods=['GET'])
@login_required
@admin_required
def list_duplicate_candidates():
    """List Duplicate unmatched rows with compare fields for admin UI glance."""
    rows = db.session.execute(
        select(UnmatchedFolder).filter_by(status='Duplicate').order_by(UnmatchedFolder.failed_time.desc())
    ).scalars().all()

    games_by_uuid = {}
    uuids = [r.matched_game_uuid for r in rows if getattr(r, 'matched_game_uuid', None)]
    if uuids:
        for game in db.session.execute(select(Game).filter(Game.uuid.in_(uuids))).scalars().all():
            games_by_uuid[game.uuid] = game

    all_games = None
    payload = []
    for folder in rows:
        matched = games_by_uuid.get(getattr(folder, 'matched_game_uuid', None))
        if matched is None:
            if all_games is None:
                all_games = db.session.execute(select(Game)).scalars().all()
            best = None
            best_score = -1.0
            for game in all_games:
                expl = explain_duplicate_match(game, folder.folder_path or '')
                if expl['is_duplicate'] and expl['match_score'] > best_score:
                    best = game
                    best_score = expl['match_score']
                    folder.matched_game_uuid = game.uuid
                    folder.match_reason = expl['match_reason']
                    folder.match_score = expl['match_score']
            matched = best
        payload.append(_duplicate_compare_payload(folder, matched))
    return jsonify({'duplicates': payload, 'count': len(payload)})


@apis_bp.route('/unmatched_folders/<folder_id>/fix', methods=['POST'])
@login_required
@admin_required
def fix_duplicate_unmatched(folder_id):
    """
    Apply a duplicate triage action and persist a queryable fix log.

    Actions:
      merge  — keep library game; dismiss Duplicate row (clear unmatched entry)
      keep   — reclassify Duplicate → Unmatched for further review
      ignore — set status Ignore
    """
    data = request.get_json(silent=True) or {}
    action = (data.get('action') or '').strip().lower()
    if action not in VALID_DUPLICATE_FIX_ACTIONS:
        return jsonify({
            'error': f"Invalid action. Choose one of: {sorted(VALID_DUPLICATE_FIX_ACTIONS)}",
        }), 400

    folder = db.session.get(UnmatchedFolder, folder_id)
    if not folder:
        return jsonify({'error': 'Unmatched folder not found'}), 404

    notes = (data.get('notes') or '')[:512] or None
    matched_uuid = getattr(folder, 'matched_game_uuid', None) or data.get('matched_game_uuid')
    match_reason = getattr(folder, 'match_reason', None)
    match_score = getattr(folder, 'match_score', None)
    folder_path = folder.folder_path

    if action == 'merge':
        db.session.delete(folder)
        result_status = 'cleared'
    elif action == 'keep':
        folder.status = 'Unmatched'
        result_status = 'Unmatched'
    else:  # ignore
        folder.status = 'Ignore'
        result_status = 'Ignore'

    fix_log = DuplicateFixLog(
        unmatched_folder_id=folder_id,
        folder_path=folder_path or '',
        matched_game_uuid=matched_uuid,
        match_reason=match_reason,
        match_score=match_score,
        action=action,
        actor_user_id=getattr(current_user, 'id', None),
        notes=notes,
    )
    db.session.add(fix_log)
    db.session.commit()

    log_system_event(
        f"Duplicate fix {action} by {getattr(current_user, 'name', 'admin')}: {folder_path}",
        event_type='duplicate_fix',
        event_level='information',
        audit_user=getattr(current_user, 'id', None),
    )

    return jsonify({
        'ok': True,
        'action': action,
        'folder_id': folder_id,
        'folder_path': folder_path,
        'result_status': result_status,
        'matched_game_uuid': matched_uuid,
        'match_reason': match_reason,
        'match_score': match_score,
        'fix_log_id': fix_log.id,
    })


@apis_bp.route('/unmatched_folders/<folder_id>/mark_kind', methods=['POST'])
@login_required
@admin_required
def mark_unmatched_folder_kind(folder_id):
    """Catalog an Unmatched folder as Experience / Emulator / Tool (or Game).

    Body JSON:
      item_kind (required): game|experience|emulator|tool
      name (optional): display title override
      steam_app_id (optional): Steam AppID for register-only metadata link
      summary (optional)

    Creates a custom-range Game (igdb_id >= 2000000420) with item_kind set,
    clears the Unmatched row. Never queues DRM store downloads.
    """
    from gametheca.utils.item_kind import ITEM_KINDS, normalize_item_kind
    from gametheca.utils.software_identify import mark_unmatched_as_kind

    data = request.get_json(silent=True) or {}
    kind_raw = data.get('item_kind') or data.get('content_kind') or data.get('kind')
    if not kind_raw or not str(kind_raw).strip():
        return jsonify({
            'error': f'item_kind required. Choose one of: {sorted(ITEM_KINDS)}',
            'item_kinds': sorted(ITEM_KINDS),
        }), 400
    folded = str(kind_raw).strip().lower()
    _aliases = {'app', 'utility', 'utilities', 'software', 'emu', 'experiences'}
    if folded not in ITEM_KINDS and folded not in _aliases:
        return jsonify({
            'error': f'Invalid item_kind. Choose one of: {sorted(ITEM_KINDS)}',
            'item_kinds': sorted(ITEM_KINDS),
        }), 400
    kind = normalize_item_kind(kind_raw)

    folder = db.session.get(UnmatchedFolder, folder_id)
    if not folder:
        return jsonify({'error': 'Unmatched folder not found'}), 404

    steam_app_id = data.get('steam_app_id')
    try:
        steam_app_id = int(steam_app_id) if steam_app_id is not None else None
    except (TypeError, ValueError):
        return jsonify({'error': 'steam_app_id must be an integer'}), 400

    try:
        game = mark_unmatched_as_kind(
            folder,
            item_kind=kind,
            name=(data.get('name') or None),
            steam_app_id=steam_app_id,
            summary=(data.get('summary') or None),
        )
        db.session.commit()
    except ValueError as exc:
        db.session.rollback()
        return jsonify({'error': str(exc)}), 400
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': str(exc)}), 500

    log_system_event(
        f"Marked unmatched as {kind}: {game.name} ({game.uuid})",
        event_type='identify',
        event_level='information',
        audit_user=getattr(current_user, 'id', None),
    )
    return jsonify({
        'ok': True,
        'game_uuid': game.uuid,
        'name': game.name,
        'item_kind': game.item_kind,
        'content_kind': game.item_kind,
        'igdb_id': game.igdb_id,
        'steam_app_id': game.steam_app_id,
        'full_disk_path': game.full_disk_path,
    })


@apis_bp.route('/unmatched_folders/fix_logs', methods=['GET'])
@login_required
@admin_required
def list_duplicate_fix_logs():
    """Queryable how-matched / how-fixed history for admin/dev feedback."""
    limit = request.args.get('limit', 100, type=int) or 100
    limit = max(1, min(limit, 500))
    rows = db.session.execute(
        select(DuplicateFixLog).order_by(DuplicateFixLog.created_at.desc()).limit(limit)
    ).scalars().all()
    return jsonify({
        'logs': [
            {
                'id': row.id,
                'unmatched_folder_id': row.unmatched_folder_id,
                'folder_path': row.folder_path,
                'matched_game_uuid': row.matched_game_uuid,
                'match_reason': row.match_reason,
                'match_score': row.match_score,
                'action': row.action,
                'actor_user_id': row.actor_user_id,
                'notes': row.notes,
                'created_at': row.created_at.isoformat() if row.created_at else None,
            }
            for row in rows
        ],
        'count': len(rows),
    })


@apis_bp.route('/path/open', methods=['GET'])
@login_required
@admin_required
def open_path_info():
    """
    Safe path-string endpoint for Desktop/OS explorer handoff.

    Returns the path only — does not open Auto Scan or mutate filesystem.
    Desktop owns revealing the folder in the host explorer.
    """
    raw = (request.args.get('path') or request.args.get('full_disk_path') or '').strip()
    if not raw:
        return jsonify({'error': 'path required'}), 400
    if len(raw) > 2048:
        return jsonify({'error': 'path too long'}), 400

    exists = False
    try:
        exists = os.path.exists(raw)
    except OSError:
        exists = False

    return jsonify({
        'path': raw,
        'exists': exists,
        'is_dir': os.path.isdir(raw) if exists else False,
        'basename': os.path.basename(raw.rstrip('\\/')) if raw else None,
        'open_via': 'desktop',
        'note': 'Server returns path string only; Desktop companion opens host explorer.',
    })


@apis_bp.route('/unmatched_folders/export', methods=['GET'])
@login_required
@admin_required
def export_unmatched_folders():
    """Export unmatched/duplicate/ignored folders as CSV or JSON for offline triage."""
    status = request.args.get('status', 'all')
    if status not in VALID_UNMATCHED_EXPORT_STATUSES:
        return jsonify({'error': f"Invalid status. Choose one of: {sorted(VALID_UNMATCHED_EXPORT_STATUSES)}"}), 400

    fmt = (request.args.get('format', 'csv') or 'csv').lower()
    if fmt not in ('csv', 'json'):
        return jsonify({'error': "Invalid format. Choose 'csv' or 'json'."}), 400

    query = (
        select(UnmatchedFolder, Library.name.label('library_name'), Library.platform)
        .join(Library)
        .order_by(UnmatchedFolder.status.desc(), UnmatchedFolder.folder_path.asc())
    )
    if status != 'all':
        query = query.filter(UnmatchedFolder.status == status)

    rows = db.session.execute(query).all()
    export_rows = []
    for folder, library_name, platform in rows:
        # Export shares the list row shape (why_unmatched + suggested_kind + folder_name).
        export_rows.append(_unmatched_list_row(folder, library_name, platform))

    filename_status = status if status != 'all' else 'all'

    if fmt == 'json':
        response = jsonify(export_rows)
        response.headers['Content-Disposition'] = (
            f'attachment; filename="unmatched_folders_{filename_status}.json"'
        )
        return response

    buffer = io.StringIO()
    fieldnames = [
        'id', 'folder_path', 'folder_name', 'status', 'library_name', 'platform_name',
        'matched_game_uuid', 'match_reason', 'match_score',
        'suggested_kind', 'suggested_kind_label', 'suggested_candidate_name',
        'why_unmatched', 'unmatched_reason',
    ]
    writer = csv.DictWriter(buffer, fieldnames=fieldnames, extrasaction='ignore')
    writer.writeheader()
    writer.writerows(export_rows)

    return Response(
        buffer.getvalue(),
        mimetype='text/csv',
        headers={
            'Content-Disposition': f'attachment; filename="unmatched_folders_{filename_status}.csv"'
        },
    )


@apis_bp.route('/unmatched_folders/reclassify_duplicates', methods=['POST'])
@login_required
@admin_required
def reclassify_duplicate_unmatched():
    """Downgrade false 'Duplicate' rows to Unmatched when folder titles differ."""
    rows = db.session.execute(
        select(UnmatchedFolder).filter_by(status='Duplicate')
    ).scalars().all()
    changed = []
    kept = []
    games = db.session.execute(select(Game)).scalars().all()
    for folder in rows:
        is_true = False
        for game in games:
            if should_mark_as_duplicate(game, folder.folder_path):
                is_true = True
                break
        if is_true:
            kept.append(folder.folder_path)
            continue
        folder.status = 'Unmatched'
        changed.append(folder.folder_path)
    db.session.commit()
    return jsonify({
        'reclassified_to_unmatched': changed,
        'kept_as_duplicate': kept,
        'changed_count': len(changed),
        'kept_count': len(kept),
    })


@apis_bp.route('/unmatched_folders/backfill_suggested_kind', methods=['POST'])
@login_required
@admin_required
def backfill_unmatched_suggested_kind_route():
    """One-shot: denormalize suggested_kind from on-disk proposal sidecars.

    Body (optional JSON):
      dry_run (bool) — count would-update without writing
      limit (int) — max null-hint rows to consider

    Idempotent; only reads sidecars for rows with null suggested_kind.
    """
    from gametheca.utils.match_proposal import backfill_unmatched_suggested_kind

    data = request.get_json(silent=True) or {}
    dry_run = bool(data.get('dry_run', False))
    limit = data.get('limit')
    result = backfill_unmatched_suggested_kind(limit=limit, dry_run=dry_run)
    status_code = 200 if result.get('ok', True) else 500
    return jsonify({'status': 'ok' if result.get('ok') else 'error', **result}), status_code


@apis_bp.route('/admin/libraries/scan', methods=['POST'])
@login_required
@admin_required
def start_library_scan():
    """Start or queue a library scan with an honest JSON response.

    Body/query:
      - library_uuid (required)
      - folder (optional; defaults to library.last_scan_folder)
      - scan_mode: folders|files (default folders)
      - remove_missing, download_missing_images, force_updates_extras (bools)
      - force_parallel / queue_policy=force — admin-only overlap (risk in message)
    """
    from gametheca.utils.scan_queue import (
        FORCE_PARALLEL_RISK,
        parse_force_parallel,
        parse_queue_policy,
        start_or_queue_scan,
    )

    data = request.get_json(silent=True) or {}
    library_uuid = (
        data.get('library_uuid')
        or request.form.get('library_uuid')
        or request.args.get('library_uuid')
    )
    if not library_uuid:
        return jsonify({
            'status': 'rejected',
            'job_id': None,
            'position': None,
            'message': 'library_uuid is required',
        }), 400

    library = db.session.execute(
        select(Library).filter_by(uuid=library_uuid)
    ).scalars().first()
    if not library:
        return jsonify({
            'status': 'rejected',
            'job_id': None,
            'position': None,
            'message': 'Library not found',
        }), 404

    folder = (
        data.get('folder')
        or request.form.get('folder')
        or request.args.get('folder')
        or library.last_scan_folder
    )
    if not folder:
        return jsonify({
            'status': 'rejected',
            'job_id': None,
            'position': None,
            'message': (
                'No folder provided and library has no last_scan_folder. '
                'Run one Auto Scan first or pass folder.'
            ),
        }), 400

    scan_mode = (
        data.get('scan_mode')
        or request.form.get('scan_mode')
        or request.args.get('scan_mode')
        or 'folders'
    )
    force_raw = (
        data.get('force_parallel')
        if 'force_parallel' in data
        else (request.form.get('force_parallel') or request.args.get('force_parallel'))
    )
    policy_raw = (
        data.get('queue_policy')
        if 'queue_policy' in data
        else (request.form.get('queue_policy') or request.args.get('queue_policy'))
    )
    queue_policy = parse_queue_policy(policy_raw, force_parallel=force_raw)

    def _bool(key, default=False):
        if key in data:
            return bool(data.get(key))
        raw = request.form.get(key) or request.args.get(key)
        if raw is None:
            return default
        return str(raw).strip().lower() in ('1', 'true', 'yes', 'on')

    result = start_or_queue_scan(
        folder_path=folder,
        library_uuid=library_uuid,
        scan_mode=scan_mode,
        remove_missing=_bool('remove_missing'),
        download_missing_images=_bool('download_missing_images'),
        force_updates_extras_scan=_bool('force_updates_extras'),
        queue_policy=queue_policy,
        allow_force=True,  # route is @admin_required
        app=current_app._get_current_object(),
    )
    http = 200 if result['status'] in ('started', 'queued') else 409
    if result['status'] == 'started' and parse_force_parallel(force_raw):
        result = dict(result)
        result.setdefault('risk', FORCE_PARALLEL_RISK)
    return jsonify(result), http


@apis_bp.route('/admin/libraries/refresh_all', methods=['POST'])
@login_required
@admin_required
def refresh_all_libraries():
    """Queue a re-scan for each library that has a remembered last_scan_folder.

    Default: enqueue FIFO ``Queued`` jobs (and promote the first when idle).
    Pass ``force_parallel=true`` / ``queue_policy=force`` (admin) to start a
    sequential refresh thread alongside any Running job (NAS CPU risk).
    """
    from threading import Thread
    from gametheca.utilities import scan_and_add_games
    from gametheca.utils.scan_queue import (
        FORCE_PARALLEL_RISK,
        enqueue_library_refresh_jobs,
        is_scan_busy,
        parse_queue_policy,
        promote_next_queued_scan,
    )

    data = request.get_json(silent=True) or {}
    force_raw = (
        data.get('force_parallel')
        if 'force_parallel' in data
        else (request.form.get('force_parallel') or request.args.get('force_parallel'))
    )
    policy_raw = (
        data.get('queue_policy')
        if 'queue_policy' in data
        else (request.form.get('queue_policy') or request.args.get('queue_policy'))
    )
    force = parse_queue_policy(policy_raw, force_parallel=force_raw) == 'force'

    libraries = db.session.execute(select(Library).order_by(Library.name.asc())).scalars().all()
    queue = [
        {'uuid': lib.uuid, 'name': lib.name, 'folder': lib.last_scan_folder}
        for lib in libraries
        if lib.last_scan_folder
    ]
    if not queue:
        return jsonify({
            'status': 'rejected',
            'error': 'No libraries have a remembered scan folder yet. Run one Auto Scan per library first.',
            'queued': [],
            'message': 'No libraries have a remembered scan folder yet.',
        }), 400

    busy = is_scan_busy()

    # Force-parallel: start sequential worker even while another scan is Running.
    if force:
        app = current_app._get_current_object()

        def _run_queue():
            with app.app_context():
                for item in queue:
                    try:
                        scan_and_add_games(
                            item['folder'],
                            scan_mode='folders',
                            library_uuid=item['uuid'],
                            remove_missing=False,
                            force_parallel=True,
                        )
                    except Exception as exc:
                        print(f"[REFRESH ALL] Failed for {item['name']}: {exc}")

        Thread(target=_run_queue, daemon=True, name='gametheca-refresh-all').start()
        message = (
            f'Refresh-all started for {len(queue)} libraries '
            f'(sequential worker, force_parallel). {FORCE_PARALLEL_RISK}'
        )
        return jsonify({
            'status': 'started',
            'queued': queue,
            'count': len(queue),
            'message': message,
            'risk': FORCE_PARALLEL_RISK,
        }), 200

    # Default: persist FIFO Queued jobs; promote first when idle.
    payload = enqueue_library_refresh_jobs(queue)
    if not busy:
        promoted = promote_next_queued_scan(current_app._get_current_object())
        if promoted:
            payload['status'] = 'started'
            payload['job_id'] = promoted.id
            payload['message'] = (
                f'Refresh-all: started first of {len(queue)} queued library scan(s); '
                'remaining stay Queued (FIFO).'
            )
            # position 1 was promoted; remaining positions shift
            for item in payload.get('jobs') or []:
                if item.get('job_id') == promoted.id:
                    item['position'] = None
                    item['status'] = 'started'
                elif item.get('position'):
                    item['position'] = max(1, int(item['position']) - 1)
    return jsonify(payload), 200
