# /gametheca/routes_apis/scan.py
from flask import jsonify, current_app, request
from flask_login import login_required
from gametheca import db
from gametheca.models import ScanJob, UnmatchedFolder, Library
from sqlalchemy import select
from gametheca.utils.auth import admin_required
from gametheca.utils.functions import PLATFORM_IDS
from . import apis_bp

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
    
    unmatched_data = [{
        'id': folder.id,
        'folder_path': folder.folder_path,
        'status': folder.status,
        'library_name': library_name,
        'platform_name': platform.name if platform else '',
        'platform_id': PLATFORM_IDS.get(platform.name) if platform else None
    } for folder, library_name, platform in unmatched]
    
    return jsonify(unmatched_data)


@apis_bp.route('/unmatched_folders/reclassify_duplicates', methods=['POST'])
@login_required
@admin_required
def reclassify_duplicate_unmatched():
    """Downgrade false 'Duplicate' rows to Unmatched when folder titles differ."""
    from gametheca.models import Game
    from gametheca.utils.duplicate_check import should_mark_as_duplicate

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


@apis_bp.route('/admin/libraries/refresh_all', methods=['POST'])
@login_required
@admin_required
def refresh_all_libraries():
    """Queue a re-scan for each library that has a remembered last_scan_folder."""
    from threading import Thread
    from gametheca.models import Library
    from gametheca.utilities import scan_and_add_games
    from gametheca.utils.scanning import is_scan_job_running

    if is_scan_job_running():
        return jsonify({'error': 'A scan is already running'}), 409

    libraries = db.session.execute(select(Library).order_by(Library.name.asc())).scalars().all()
    queue = [
        {'uuid': lib.uuid, 'name': lib.name, 'folder': lib.last_scan_folder}
        for lib in libraries
        if lib.last_scan_folder
    ]
    if not queue:
        return jsonify({
            'error': 'No libraries have a remembered scan folder yet. Run one Auto Scan per library first.',
            'queued': [],
        }), 400

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
                    )
                except Exception as exc:
                    print(f"[REFRESH ALL] Failed for {item['name']}: {exc}")

    Thread(target=_run_queue, daemon=True, name='gametheca-refresh-all').start()
    return jsonify({'queued': queue, 'count': len(queue)})
