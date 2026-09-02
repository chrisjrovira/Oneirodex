# /oneirodex/routes_apis/scan.py
import csv
import io
import os

from oneirodex.utils.api_response import api_error, api_ok
from flask import jsonify, current_app, request, Response
from flask_login import login_required, current_user
from oneirodex import db
from oneirodex.models import ScanJob, UnmatchedFolder, Library, Game, DuplicateFixLog, Image
from sqlalchemy import or_, select
from oneirodex.utils.auth import admin_required, librarian_required
from oneirodex.utils.cover_url import resolve_game_cover_url
from oneirodex.utils.duplicate_check import explain_duplicate_match, folder_basename, should_mark_as_duplicate
from oneirodex.utils.event_logging import log_system_event
from oneirodex.utils.functions import igdb_platform_id_for
from oneirodex.utils.scan_job_timing import (
    compute_scan_job_timing,
    parse_scan_job_status_filter,
)
from oneirodex.utils.scan_match_settings import resolve_scan_match_policy
from oneirodex.utils.scan_queue import maybe_drain_scan_queue, queue_position
from . import apis_bp

VALID_UNMATCHED_EXPORT_STATUSES = {'all', 'Unmatched', 'Duplicate', 'Ignore', 'Pending'}
VALID_DUPLICATE_FIX_ACTIONS = {'merge', 'keep', 'ignore'}
UNMATCHED_BATCH_ID_CAP = 100
_MATCH_REASON_CODES = {
    'same_path',
    'title_vs_folder',
    'title_vs_library_name',
    'title_below_threshold',
}


def _soft_name(value) -> str | None:
    text = (value or '').strip() if value is not None else ''
    return text or None


def _iso_dt(value) -> str | None:
    """Null-safe ISO-8601 for DateTime columns (UID-016 compare soft-reads)."""
    if value is None:
        return None
    try:
        return value.isoformat()
    except Exception:
        return None


def _unmatched_disk_meta_fields(folder: UnmatchedFolder) -> dict:
    """Size/mtime for unmatched folder rows — null when unknown (no disk I/O).

    UnmatchedFolder has no size column; failed_time is the only cheap mtime signal.
    Aliases match admin UI pickDiskSizeBytes / pickDiskDate soft-reads.
    """
    failed_iso = _iso_dt(getattr(folder, 'failed_time', None))
    # No denormalized folder size on UnmatchedFolder — key present, value null.
    size_bytes = None
    return {
        'size_bytes': size_bytes,
        'folder_size_bytes': size_bytes,
        'folder_mtime': failed_iso,
        'mtime': failed_iso,
        'modified_at': failed_iso,
        'failed_time': failed_iso,
    }


def _game_disk_meta_fields(game: Game) -> dict:
    """Size/date from existing Game columns for matched_game / duplicate candidates."""
    raw_size = getattr(game, 'size', None)
    size_bytes = int(raw_size) if raw_size is not None else None
    date_identified = _iso_dt(getattr(game, 'date_identified', None))
    date_created = _iso_dt(getattr(game, 'date_created', None))
    # Prefer identify time for compare mtime; fall back to create.
    mtime_iso = date_identified or date_created
    return {
        'size_bytes': size_bytes,
        'date_identified': date_identified,
        'date_created': date_created,
        'folder_mtime': mtime_iso,
        'mtime': mtime_iso,
    }


def _effective_search_name(folder: UnmatchedFolder) -> str | None:
    """Librarian soft search_name, else disk basename (never renames disk)."""
    return _soft_name(getattr(folder, 'search_name', None)) or (
        folder_basename(folder.folder_path) or None
    )


def _rom_language_fields_from_path(path_or_name: str | None) -> dict:
    """Parse dump region/lang from a folder/file path for Unmatched trail honesty."""
    from oneirodex.utils.rom_language import parse_rom_language_tags

    label = folder_basename(path_or_name) if path_or_name else ''
    if not label:
        return {'rom_region': None, 'rom_languages': None}
    parsed = parse_rom_language_tags(label)
    return {
        'rom_region': parsed.get('rom_region'),
        'rom_languages': parsed.get('rom_languages'),
    }


def _suggested_kind_fields(folder: UnmatchedFolder) -> dict:
    """Cheap list/export hint fields denormalized on UnmatchedFolder (no sidecar I/O)."""
    from oneirodex.utils.match_proposal import SUGGESTED_KIND_LABELS

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


def _stage_e_fields(folder: UnmatchedFolder) -> dict:
    """Stage E propose-only fields denormalized on UnmatchedFolder (soft-omit when absent)."""
    out = {}
    candidates = getattr(folder, 'stage_e_candidates', None)
    if isinstance(candidates, list) and candidates:
        out['stage_e_candidates'] = candidates
    meta = getattr(folder, 'stage_e', None)
    if isinstance(meta, dict) and meta:
        out['stage_e'] = meta
    return out


def _label_transforms(folder: UnmatchedFolder) -> list:
    """Ordered Stage A0–A14 peels for the disk folder basename (no disk rename)."""
    from oneirodex.utils.game_name_parse import parse_game_label

    label = folder_basename(getattr(folder, 'folder_path', None) or '')
    if not label:
        return []
    return list(parse_game_label(label).get('transforms') or [])


def _why_unmatched_fields(
    folder: UnmatchedFolder,
    kind_fields: dict | None = None,
    *,
    match_reason=None,
    match_score=None,
    use_overrides: bool = False,
) -> dict:
    """Deterministic one-liner + folder basename for UI explainer (no disk I/O)."""
    from oneirodex.utils.match_proposal import format_why_unmatched

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
        # Peel trail for UI expanders; short match_reason codes stay for filters.
        'transforms': _label_transforms(folder),
        **_rom_language_fields_from_path(getattr(folder, 'folder_path', None)),
    }


def _matched_game_payload(game: Game | None, cover_by_uuid: dict | None = None) -> dict | None:
    if game is None:
        return None
    cover_url = None
    if cover_by_uuid is not None:
        cover_img = cover_by_uuid.get(game.uuid)
        try:
            cover_url = resolve_game_cover_url(game, cover_img)
        except Exception:
            cover_url = None
    else:
        cover_url = _cover_for_game(game)
    return {
        'uuid': game.uuid,
        'name': game.name,
        'path': game.full_disk_path,
        'cover_url': cover_url,
        'igdb_id': game.igdb_id,
        'rom_region': getattr(game, 'rom_region', None),
        'rom_languages': getattr(game, 'rom_languages', None),
        'disc_index': getattr(game, 'disc_index', None),
        'disc_count': getattr(game, 'disc_count', None),
        **_game_disk_meta_fields(game),
    }


def _prefetch_matched_game_maps(folders: list) -> tuple[dict, dict]:
    """Batch-load games + cover images for list/export (no N+1)."""
    uuids = list({
        getattr(f, 'matched_game_uuid', None)
        for f in folders
        if getattr(f, 'matched_game_uuid', None)
    })
    games_by_uuid: dict = {}
    cover_by_uuid: dict = {}
    if not uuids:
        return games_by_uuid, cover_by_uuid
    for game in db.session.execute(select(Game).filter(Game.uuid.in_(uuids))).scalars().all():
        games_by_uuid[game.uuid] = game
    for image in db.session.execute(
        select(Image).filter(Image.game_uuid.in_(uuids), Image.image_type == 'cover')
    ).scalars().all():
        cover_by_uuid.setdefault(image.game_uuid, image)
    return games_by_uuid, cover_by_uuid


def _unmatched_list_row(
    folder: UnmatchedFolder,
    library_name,
    platform,
    *,
    games_by_uuid: dict | None = None,
    cover_by_uuid: dict | None = None,
) -> dict:
    kind_fields = _suggested_kind_fields(folder)
    matched_uuid = getattr(folder, 'matched_game_uuid', None)
    include_matched = bool(getattr(folder, 'status', None) == 'Duplicate' or matched_uuid)
    matched_game = None
    if include_matched and matched_uuid:
        if games_by_uuid is not None:
            matched_game = _matched_game_payload(games_by_uuid.get(matched_uuid), cover_by_uuid)
        else:
            game = db.session.execute(select(Game).filter_by(uuid=matched_uuid)).scalars().first()
            matched_game = _matched_game_payload(game)

    row = {
        'id': folder.id,
        'folder_path': folder.folder_path,
        'status': folder.status,
        'library_uuid': getattr(folder, 'library_uuid', None),
        'library_name': library_name,
        'platform_name': platform.name if platform else '',
        'platform_id': igdb_platform_id_for(platform),
        'matched_game_uuid': matched_uuid,
        'match_reason': getattr(folder, 'match_reason', None),
        'match_score': getattr(folder, 'match_score', None),
        'search_name': _soft_name(getattr(folder, 'search_name', None)),
        'display_name': _soft_name(getattr(folder, 'display_name', None)),
        'matched_game': matched_game if include_matched else None,
        # UX-C5 feedback state. Without these the triage UI cannot show that a
        # row is already flagged, so an operator has no way to see their own
        # earlier judgement — or to clear one set by mistake.
        'bad_match_reason': getattr(folder, 'bad_match_reason', None),
        'bad_match_note': getattr(folder, 'bad_match_note', None),
    }
    row.update(_unmatched_disk_meta_fields(folder))
    row.update(kind_fields)
    row.update(_why_unmatched_fields(folder, kind_fields))
    row.update(_stage_e_fields(folder))
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
        dupe_thr = resolve_scan_match_policy().get('dupe_title_threshold')
        explanation = explain_duplicate_match(
            matched_game,
            folder.folder_path or '',
            folder_basename(folder.folder_path),
            title_threshold=dupe_thr,
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
            **_game_disk_meta_fields(matched_game),
        })

    folder_title = (
        _soft_name(getattr(folder, 'display_name', None))
        or _soft_name(getattr(folder, 'search_name', None))
        or folder_basename(folder.folder_path)
        or folder.folder_path
    )
    kind_fields = _suggested_kind_fields(folder)
    why_fields = _why_unmatched_fields(
        folder,
        kind_fields,
        match_reason=match_reason,
        match_score=match_score,
        use_overrides=True,
    )
    folder_disk = _unmatched_disk_meta_fields(folder)
    return {
        'id': folder.id,
        'folder_path': folder.folder_path,
        'status': folder.status,
        'library_uuid': folder.library_uuid,
        'matched_game_uuid': getattr(folder, 'matched_game_uuid', None),
        'match_reason': match_reason,
        'match_score': match_score,
        'search_name': _soft_name(getattr(folder, 'search_name', None)),
        'display_name': _soft_name(getattr(folder, 'display_name', None)),
        'matched_game': _matched_game_payload(matched_game),
        **folder_disk,
        **kind_fields,
        **why_fields,
        **_stage_e_fields(folder),
        'titles': [
            {
                'role': 'unmatched_folder',
                'uuid': None,
                'id': None,
                'name': folder_title,
                'cover_url': None,
                'path': folder.folder_path,
                'igdb_id': None,
                **folder_disk,
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


def _parse_unmatched_list_filters():
    """Query params shared by list + export. Returns (filters_dict, error_response)."""
    status = (request.args.get('status') or 'all').strip()
    if status not in VALID_UNMATCHED_EXPORT_STATUSES:
        return None, api_error(
            f"Invalid status. Choose one of: {sorted(VALID_UNMATCHED_EXPORT_STATUSES)}",
            code='bad_request',
        )
    return {
        'status': status,
        'q': (request.args.get('q') or request.args.get('name') or '').strip(),
        'why': (request.args.get('why') or request.args.get('reason') or '').strip(),
        'suggested_kind': (request.args.get('suggested_kind') or '').strip().lower(),
        'library_uuid': (request.args.get('library_uuid') or '').strip(),
    }, None


def _apply_unmatched_filters(query, filters: dict):
    status = filters.get('status') or 'all'
    if status != 'all':
        query = query.filter(UnmatchedFolder.status == status)

    library_uuid = filters.get('library_uuid') or ''
    if library_uuid:
        query = query.filter(UnmatchedFolder.library_uuid == library_uuid)

    suggested_kind = filters.get('suggested_kind') or ''
    if suggested_kind:
        query = query.filter(UnmatchedFolder.suggested_kind == suggested_kind)

    q = filters.get('q') or ''
    if q:
        pattern = f'%{q}%'
        query = query.filter(or_(
            UnmatchedFolder.folder_path.ilike(pattern),
            UnmatchedFolder.search_name.ilike(pattern),
            UnmatchedFolder.display_name.ilike(pattern),
        ))

    why = filters.get('why') or ''
    if why:
        why_folded = why.strip()
        why_lower = why_folded.lower()
        status_aliases = {s.lower(): s for s in ('Unmatched', 'Duplicate', 'Ignore', 'Pending')}
        if why_lower in status_aliases:
            query = query.filter(UnmatchedFolder.status == status_aliases[why_lower])
        elif why_lower in _MATCH_REASON_CODES:
            query = query.filter(UnmatchedFolder.match_reason == why_lower)
        elif why_lower in ('title', 'titles'):
            query = query.filter(UnmatchedFolder.match_reason.ilike('title%'))
        else:
            query = query.filter(UnmatchedFolder.match_reason.ilike(f'%{why_folded}%'))

    return query


def _query_unmatched_rows(filters: dict):
    query = (
        select(UnmatchedFolder, Library.name.label('library_name'), Library.platform)
        .join(Library)
        .order_by(UnmatchedFolder.status.desc(), UnmatchedFolder.folder_path.asc())
    )
    query = _apply_unmatched_filters(query, filters)
    return db.session.execute(query).all()


def _parse_batch_ids(data: dict):
    raw_ids = data.get('ids')
    if raw_ids is None and isinstance(data.get('items'), list):
        raw_ids = [item.get('id') for item in data['items'] if isinstance(item, dict)]
    if not isinstance(raw_ids, list) or not raw_ids:
        return None, api_error('ids required (non-empty array)', code='bad_request')
    ids = []
    for value in raw_ids:
        text = str(value or '').strip()
        if text:
            ids.append(text)
    if not ids:
        return None, api_error('ids required (non-empty array)', code='bad_request')
    if len(ids) > UNMATCHED_BATCH_ID_CAP:
        return None, api_error(
            f'ids cap is {UNMATCHED_BATCH_ID_CAP}',
            code='bad_request',
            cap=UNMATCHED_BATCH_ID_CAP,
            requested=len(ids),
        )
    seen = set()
    unique = []
    for i in ids:
        if i not in seen:
            seen.add(i)
            unique.append(i)
    return unique, None


def _apply_soft_amend(folder: UnmatchedFolder, data: dict) -> dict:
    """Set soft search_name / display_name. Never touches folder_path / disk."""
    changed = {}
    if 'search_name' in data or 'name' in data:
        raw = data['search_name'] if 'search_name' in data else data.get('name')
        if raw is None or (isinstance(raw, str) and not raw.strip()):
            folder.search_name = None
            changed['search_name'] = None
        else:
            folder.search_name = str(raw).strip()[:255]
            changed['search_name'] = folder.search_name
    if 'display_name' in data:
        raw = data.get('display_name')
        if raw is None or (isinstance(raw, str) and not raw.strip()):
            folder.display_name = None
            changed['display_name'] = None
        else:
            folder.display_name = str(raw).strip()[:255]
            changed['display_name'] = folder.display_name
    return changed


def _fix_one_duplicate(folder: UnmatchedFolder, action: str, notes: str | None = None) -> dict:
    """Apply merge|keep|ignore; caller commits."""
    matched_uuid = getattr(folder, 'matched_game_uuid', None)
    match_reason = getattr(folder, 'match_reason', None)
    match_score = getattr(folder, 'match_score', None)
    folder_path = folder.folder_path
    folder_id = folder.id

    if action == 'merge':
        db.session.delete(folder)
        result_status = 'cleared'
    elif action == 'keep':
        folder.status = 'Unmatched'
        result_status = 'Unmatched'
    else:
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
    return {
        'ok': True,
        'id': folder_id,
        'action': action,
        'folder_id': folder_id,
        'folder_path': folder_path,
        'result_status': result_status,
        'matched_game_uuid': matched_uuid,
        'match_reason': match_reason,
        'match_score': match_score,
    }


def _parse_scan_jobs_list_filters():
    """Query params for GET /api/scan_jobs_status. Returns filters dict."""
    statuses = parse_scan_job_status_filter(request.args.get('status'))
    return {
        'statuses': statuses,
        'library_uuid': (request.args.get('library_uuid') or '').strip(),
        'q': (request.args.get('q') or request.args.get('name') or '').strip(),
    }


def _query_scan_jobs(filters: dict):
    """Filtered ScanJob list (server-side). Outerjoin Library for name substring."""
    query = (
        select(ScanJob)
        .outerjoin(Library, ScanJob.library_uuid == Library.uuid)
        .order_by(ScanJob.last_run.desc().nullslast())
    )
    statuses = filters.get('statuses') or []
    if statuses:
        query = query.where(ScanJob.status.in_(statuses))
    library_uuid = filters.get('library_uuid') or ''
    if library_uuid:
        query = query.where(ScanJob.library_uuid == library_uuid)
    q = filters.get('q') or ''
    if q:
        pattern = f'%{q}%'
        query = query.where(or_(
            ScanJob.scan_folder.ilike(pattern),
            Library.name.ilike(pattern),
        ))
    return db.session.execute(query).scalars().unique().all()


def _scan_job_status_row(job, *, queue_position_fn=None) -> dict:
    folders_success = job.folders_success or 0
    folders_failed = job.folders_failed or 0
    total_folders = job.total_folders or 0
    timing = compute_scan_job_timing(job)
    processed = timing['folders_processed']
    row = {
        'id': job.id,
        'library_name': job.library.name if job.library else 'No Library Assigned',
        'library_uuid': job.library_uuid,
        'folders': job.folders,
        'status': job.status,
        'total_folders': total_folders,
        'folders_success': folders_success,
        'folders_failed': folders_failed,
        'folders_processed': processed,
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
        # Wave 18 timing — started_at == last_run (no separate create column)
        'started_at': timing['started_at'],
        'created_at': timing['created_at'],
        'elapsed_seconds': timing['elapsed_seconds'],
        'eta_seconds': timing['eta_seconds'],
        'stalled': timing['stalled'],
        'elapsed_label': timing['elapsed_label'],
        'eta_label': timing['eta_label'],
    }
    if job.status == 'Queued' and queue_position_fn is not None:
        row['queue_position'] = queue_position_fn(job.id)
    return row


@apis_bp.route('/scan_jobs_status', methods=['GET'])
@login_required
@admin_required
def scan_jobs_status():
    # Safety drain only when idle+Queued. A Running scan must not share this
    # lock with a 3s admin poll — see maybe_drain_scan_queue.
    try:
        maybe_drain_scan_queue(current_app._get_current_object())
    except Exception:
        pass

    filters = _parse_scan_jobs_list_filters()
    jobs = _query_scan_jobs(filters)
    jobs_data = [_scan_job_status_row(job, queue_position_fn=queue_position) for job in jobs]
    return jsonify(jobs_data)


@apis_bp.route('/unmatched_folders', methods=['GET'])
@login_required
@admin_required
def unmatched_folders():
    filters, err = _parse_unmatched_list_filters()
    if err:
        return err

    rows = _query_unmatched_rows(filters)
    folders = [folder for folder, _library_name, _platform in rows]
    games_by_uuid, cover_by_uuid = _prefetch_matched_game_maps(folders)

    unmatched_data = [
        _unmatched_list_row(
            folder,
            library_name,
            platform,
            games_by_uuid=games_by_uuid,
            cover_by_uuid=cover_by_uuid,
        )
        for folder, library_name, platform in rows
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
            dupe_thr = resolve_scan_match_policy().get('dupe_title_threshold')
            for game in all_games:
                expl = explain_duplicate_match(
                    game, folder.folder_path or '', title_threshold=dupe_thr,
                )
                if expl['is_duplicate'] and expl['match_score'] > best_score:
                    best = game
                    best_score = expl['match_score']
                    folder.matched_game_uuid = game.uuid
                    folder.match_reason = expl['match_reason']
                    folder.match_score = expl['match_score']
            matched = best
        payload.append(_duplicate_compare_payload(folder, matched))
    return jsonify({'duplicates': payload, 'count': len(payload)})


@apis_bp.route('/unmatched_folders/<folder_id>/name', methods=['PATCH', 'POST'])
@login_required
@librarian_required
def amend_unmatched_folder_name(folder_id):
    """Soft-amend librarian search/display names. Does NOT rename disk folder_path."""
    data = request.get_json(silent=True) or {}
    if not any(k in data for k in ('search_name', 'display_name', 'name')):
        return api_error(
            'Provide search_name and/or display_name (name aliases search_name)',
            code='bad_request',
            disk_rename=False,
        )

    folder = db.session.get(UnmatchedFolder, folder_id)
    if not folder:
        return api_error('Unmatched folder not found', code='not_found')

    changed = _apply_soft_amend(folder, data)
    if not changed:
        return api_error(
            'Provide search_name and/or display_name (name aliases search_name)',
            code='bad_request',
            disk_rename=False,
        )

    db.session.commit()
    return api_ok({
        'id': folder.id,
        'folder_path': folder.folder_path,
        'folder_name': folder_basename(folder.folder_path) or None,
        'search_name': _soft_name(folder.search_name),
        'display_name': _soft_name(folder.display_name),
        'effective_search_name': _effective_search_name(folder),
        'changed': changed,
        'disk_rename': False,
        'note': 'Soft naming only; disk folder_path unchanged.',
    })


@apis_bp.route('/unmatched_folders/batch/clear', methods=['POST'])
@login_required
@librarian_required
def batch_clear_unmatched_folders():
    """Delete unmatched rows by id (DB only — no disk I/O). Partial success OK."""
    data = request.get_json(silent=True) or {}
    ids, err = _parse_batch_ids(data)
    if err:
        return err

    results = []
    cleared = 0
    for folder_id in ids:
        folder = db.session.get(UnmatchedFolder, folder_id)
        if not folder:
            results.append({'id': folder_id, 'ok': False, 'error': 'not_found'})
            continue
        try:
            db.session.delete(folder)
            db.session.commit()
            results.append({'id': folder_id, 'ok': True, 'result': 'cleared'})
            cleared += 1
        except Exception as exc:
            db.session.rollback()
            results.append({'id': folder_id, 'ok': False, 'error': str(exc)})

    return api_ok({
        'cleared': cleared,
        'failed': sum(1 for r in results if not r.get('ok')),
        'results': results,
        'disk_io': False,
    })


@apis_bp.route('/unmatched_folders/batch/mark_kind', methods=['POST'])
@login_required
@librarian_required
def batch_mark_unmatched_kind():
    """Batch mark_kind. Partial success OK. No disk I/O."""
    from oneirodex.utils.item_kind import ITEM_KINDS, normalize_item_kind
    from oneirodex.utils.software_identify import mark_unmatched_as_kind

    data = request.get_json(silent=True) or {}
    ids, err = _parse_batch_ids(data)
    if err:
        return err

    kind_raw = data.get('item_kind') or data.get('content_kind') or data.get('kind')
    if not kind_raw or not str(kind_raw).strip():
        return api_error(
            f'item_kind required. Choose one of: {sorted(ITEM_KINDS)}',
            code='bad_request',
            item_kinds=sorted(ITEM_KINDS),
        )
    folded = str(kind_raw).strip().lower()
    _aliases = {'app', 'utility', 'utilities', 'software', 'emu', 'experiences'}
    if folded not in ITEM_KINDS and folded not in _aliases:
        return api_error(
            f'Invalid item_kind. Choose one of: {sorted(ITEM_KINDS)}',
            code='bad_request',
            item_kinds=sorted(ITEM_KINDS),
        )
    kind = normalize_item_kind(kind_raw)

    results = []
    marked = 0
    for folder_id in ids:
        folder = db.session.get(UnmatchedFolder, folder_id)
        if not folder:
            results.append({'id': folder_id, 'ok': False, 'error': 'not_found'})
            continue
        try:
            game = mark_unmatched_as_kind(
                folder,
                item_kind=kind,
                name=(data.get('name') or None),
                steam_app_id=None,
                summary=(data.get('summary') or None),
            )
            db.session.commit()
            results.append({
                'id': folder_id,
                'ok': True,
                'game_uuid': game.uuid,
                'name': game.name,
                'item_kind': game.item_kind,
            })
            marked += 1
        except ValueError as exc:
            db.session.rollback()
            results.append({'id': folder_id, 'ok': False, 'error': str(exc)})
        except Exception as exc:
            db.session.rollback()
            results.append({'id': folder_id, 'ok': False, 'error': str(exc)})

    return api_ok({
        'item_kind': kind,
        'marked': marked,
        'failed': sum(1 for r in results if not r.get('ok')),
        'results': results,
        'disk_io': False,
    })


@apis_bp.route('/unmatched_folders/batch/fix', methods=['POST'])
@login_required
@librarian_required
def batch_fix_unmatched_duplicates():
    """Batch duplicate triage (merge|keep|ignore). Partial success OK. No disk I/O."""
    data = request.get_json(silent=True) or {}
    ids, err = _parse_batch_ids(data)
    if err:
        return err

    action = (data.get('action') or '').strip().lower()
    if action not in VALID_DUPLICATE_FIX_ACTIONS:
        return api_error(
            f"Invalid action. Choose one of: {sorted(VALID_DUPLICATE_FIX_ACTIONS)}",
            code='bad_request',
        )

    notes = (data.get('notes') or '')[:512] or None
    results = []
    fixed = 0
    for folder_id in ids:
        folder = db.session.get(UnmatchedFolder, folder_id)
        if not folder:
            results.append({'id': folder_id, 'ok': False, 'error': 'not_found'})
            continue
        try:
            result = _fix_one_duplicate(folder, action, notes=notes)
            db.session.commit()
            results.append(result)
            fixed += 1
        except Exception as exc:
            db.session.rollback()
            results.append({'id': folder_id, 'ok': False, 'error': str(exc)})

    log_system_event(
        f"Batch duplicate fix {action} by {getattr(current_user, 'name', 'admin')}: {fixed}/{len(ids)}",
        event_type='duplicate_fix',
        event_level='information',
        audit_user=getattr(current_user, 'id', None),
    )

    return api_ok({
        'action': action,
        'fixed': fixed,
        'failed': sum(1 for r in results if not r.get('ok')),
        'results': results,
        'disk_io': False,
    })


@apis_bp.route('/unmatched_folders/batch/amend', methods=['POST'])
@login_required
@librarian_required
def batch_amend_unmatched_names():
    """Batch soft-amend search_name/display_name. Partial success OK. No disk rename."""
    data = request.get_json(silent=True) or {}
    items = data.get('items')
    results = []
    amended = 0

    def _amend_one(folder_id: str, payload: dict):
        nonlocal amended
        folder = db.session.get(UnmatchedFolder, folder_id)
        if not folder:
            results.append({'id': folder_id, 'ok': False, 'error': 'not_found'})
            return
        if not any(k in payload for k in ('search_name', 'display_name', 'name')):
            results.append({'id': folder_id, 'ok': False, 'error': 'search_name_or_display_name_required'})
            return
        try:
            changed = _apply_soft_amend(folder, payload)
            db.session.commit()
            results.append({
                'id': folder_id,
                'ok': True,
                'search_name': _soft_name(folder.search_name),
                'display_name': _soft_name(folder.display_name),
                'changed': changed,
            })
            amended += 1
        except Exception as exc:
            db.session.rollback()
            results.append({'id': folder_id, 'ok': False, 'error': str(exc)})

    if isinstance(items, list) and items:
        if len(items) > UNMATCHED_BATCH_ID_CAP:
            return api_error(
                f'ids cap is {UNMATCHED_BATCH_ID_CAP}',
                code='bad_request',
                cap=UNMATCHED_BATCH_ID_CAP,
                requested=len(items),
            )
        for item in items:
            if not isinstance(item, dict):
                results.append({'id': None, 'ok': False, 'error': 'invalid_item'})
                continue
            folder_id = str(item.get('id') or '').strip()
            if not folder_id:
                results.append({'id': None, 'ok': False, 'error': 'id_required'})
                continue
            _amend_one(folder_id, item)
    else:
        ids, err = _parse_batch_ids(data)
        if err:
            return err
        if not any(k in data for k in ('search_name', 'display_name', 'name')):
            return api_error(
                'Provide search_name and/or display_name (or items[] with per-id fields)',
                code='bad_request',
                disk_rename=False,
            )
        for folder_id in ids:
            _amend_one(folder_id, data)

    return api_ok({
        'amended': amended,
        'failed': sum(1 for r in results if not r.get('ok')),
        'results': results,
        'disk_rename': False,
        'disk_io': False,
    })


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
        return api_error(
            f"Invalid action. Choose one of: {sorted(VALID_DUPLICATE_FIX_ACTIONS)}",
            code='bad_request',
        )

    folder = db.session.get(UnmatchedFolder, folder_id)
    if not folder:
        return api_error('Unmatched folder not found', code='not_found')

    notes = (data.get('notes') or '')[:512] or None
    matched_uuid = getattr(folder, 'matched_game_uuid', None) or data.get('matched_game_uuid')
    match_reason = getattr(folder, 'match_reason', None)
    match_score = getattr(folder, 'match_score', None)
    folder_path = folder.folder_path

    result = _fix_one_duplicate(folder, action, notes=notes)
    db.session.commit()

    log_system_event(
        f"Duplicate fix {action} by {getattr(current_user, 'name', 'admin')}: {folder_path}",
        event_type='duplicate_fix',
        event_level='information',
        audit_user=getattr(current_user, 'id', None),
    )

    fix_log = db.session.execute(
        select(DuplicateFixLog).filter_by(
            unmatched_folder_id=folder_id,
            action=action,
        ).order_by(DuplicateFixLog.created_at.desc())
    ).scalars().first()

    return api_ok({
        'action': action,
        'folder_id': folder_id,
        'folder_path': folder_path,
        'result_status': result['result_status'],
        'matched_game_uuid': matched_uuid,
        'match_reason': match_reason,
        'match_score': match_score,
        'fix_log_id': fix_log.id if fix_log else None,
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
    from oneirodex.utils.item_kind import ITEM_KINDS, normalize_item_kind
    from oneirodex.utils.software_identify import mark_unmatched_as_kind

    data = request.get_json(silent=True) or {}
    kind_raw = data.get('item_kind') or data.get('content_kind') or data.get('kind')
    if not kind_raw or not str(kind_raw).strip():
        return api_error(
            f'item_kind required. Choose one of: {sorted(ITEM_KINDS)}',
            code='bad_request',
            item_kinds=sorted(ITEM_KINDS),
        )
    folded = str(kind_raw).strip().lower()
    _aliases = {'app', 'utility', 'utilities', 'software', 'emu', 'experiences'}
    if folded not in ITEM_KINDS and folded not in _aliases:
        return api_error(
            f'Invalid item_kind. Choose one of: {sorted(ITEM_KINDS)}',
            code='bad_request',
            item_kinds=sorted(ITEM_KINDS),
        )
    kind = normalize_item_kind(kind_raw)

    folder = db.session.get(UnmatchedFolder, folder_id)
    if not folder:
        return api_error('Unmatched folder not found', code='not_found')

    steam_app_id = data.get('steam_app_id')
    try:
        steam_app_id = int(steam_app_id) if steam_app_id is not None else None
    except (TypeError, ValueError):
        return api_error('steam_app_id must be an integer', code='bad_request')

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
        return api_error(str(exc), code='bad_request')
    except Exception as exc:
        db.session.rollback()
        current_app.logger.warning('scan match update failed: %s', exc)
        return api_error('Could not update the match', code='internal')

    log_system_event(
        f"Marked unmatched as {kind}: {game.name} ({game.uuid})",
        event_type='identify',
        event_level='information',
        audit_user=getattr(current_user, 'id', None),
    )
    return api_ok({
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
        return api_error('path required', code='bad_request')
    if len(raw) > 2048:
        return api_error('path too long', code='bad_request')

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
    filters, err = _parse_unmatched_list_filters()
    if err:
        return err

    fmt = (request.args.get('format', 'csv') or 'csv').lower()
    if fmt not in ('csv', 'json'):
        return api_error("Invalid format. Choose 'csv' or 'json'.", code='bad_request')

    rows = _query_unmatched_rows(filters)
    folders = [folder for folder, _ln, _pl in rows]
    games_by_uuid, cover_by_uuid = _prefetch_matched_game_maps(folders)

    export_rows = [
        _unmatched_list_row(
            folder,
            library_name,
            platform,
            games_by_uuid=games_by_uuid,
            cover_by_uuid=cover_by_uuid,
        )
        for folder, library_name, platform in rows
    ]

    status = filters['status']
    filename_status = status if status != 'all' else 'all'

    if fmt == 'json':
        response = jsonify(export_rows)
        response.headers['Content-Disposition'] = (
            f'attachment; filename="unmatched_folders_{filename_status}.json"'
        )
        return response

    buffer = io.StringIO()
    fieldnames = [
        'id', 'folder_path', 'folder_name', 'search_name', 'display_name',
        'status', 'library_uuid', 'library_name', 'platform_name',
        'matched_game_uuid', 'match_reason', 'match_score',
        'matched_game_name', 'matched_game_path', 'matched_game_cover_url', 'matched_game_igdb_id',
        'matched_game_size_bytes', 'matched_game_date_identified', 'matched_game_date_created',
        'size_bytes', 'folder_size_bytes', 'folder_mtime', 'mtime', 'modified_at', 'failed_time',
        'rom_region', 'rom_languages',
        'suggested_kind', 'suggested_kind_label', 'suggested_candidate_name',
        'why_unmatched', 'unmatched_reason',
    ]
    flat_rows = []
    for row in export_rows:
        flat = dict(row)
        mg = flat.pop('matched_game', None) or {}
        flat['matched_game_name'] = mg.get('name')
        flat['matched_game_path'] = mg.get('path')
        flat['matched_game_cover_url'] = mg.get('cover_url')
        flat['matched_game_igdb_id'] = mg.get('igdb_id')
        flat['matched_game_size_bytes'] = mg.get('size_bytes')
        flat['matched_game_date_identified'] = mg.get('date_identified')
        flat['matched_game_date_created'] = mg.get('date_created')
        flat_rows.append(flat)

    writer = csv.DictWriter(buffer, fieldnames=fieldnames, extrasaction='ignore')
    writer.writeheader()
    writer.writerows(flat_rows)

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
    dupe_thr = resolve_scan_match_policy().get('dupe_title_threshold')
    for folder in rows:
        is_true = False
        for game in games:
            if should_mark_as_duplicate(
                game, folder.folder_path, title_threshold=dupe_thr,
            ):
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
    from oneirodex.utils.match_proposal import backfill_unmatched_suggested_kind

    data = request.get_json(silent=True) or {}
    dry_run = bool(data.get('dry_run', False))
    limit = data.get('limit')
    result = backfill_unmatched_suggested_kind(limit=limit, dry_run=dry_run)
    if result.get('ok', True):
        return api_ok({**result, 'status': 'ok'})
    return api_error(
        'Could not backfill suggested kinds',
        code='internal',
        status=500,
        body_status='error',
        body_error=result.get('error') or 'commit_failed',
        scanned=result.get('scanned'),
        updated=result.get('updated'),
        skipped_no_sidecar=result.get('skipped_no_sidecar'),
        skipped_empty_hint=result.get('skipped_empty_hint'),
        dry_run=result.get('dry_run'),
        committed=result.get('committed'),
    )


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
    from oneirodex.utils.scan_queue import (
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
        return api_error(
            'library_uuid is required',
            code='bad_request',
            body_status='rejected',
            job_id=None,
            position=None,
        )

    library = db.session.execute(
        select(Library).filter_by(uuid=library_uuid)
    ).scalars().first()
    if not library:
        return api_error(
            'Library not found',
            code='not_found',
            body_status='rejected',
            job_id=None,
            position=None,
        )

    folder = (
        data.get('folder')
        or request.form.get('folder')
        or request.args.get('folder')
        or library.last_scan_folder
    )
    if not folder:
        return api_error(
            (
                'No folder provided and library has no last_scan_folder. '
                'Run one Auto Scan first or pass folder.'
            ),
            code='bad_request',
            body_status='rejected',
            job_id=None,
            position=None,
        )

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
    if result['status'] in ('started', 'queued'):
        return api_ok(result, status=http)
    extras = {
        key: value for key, value in result.items()
        if key not in ('ok', 'error', 'error_code', 'message', 'status')
    }
    return api_error(
        result.get('message') or 'Scan rejected',
        code='conflict',
        status=http,
        body_status='rejected',
        **extras,
    )


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
    from oneirodex.utilities import scan_and_add_games
    from oneirodex.utils.scan_queue import (
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
        return api_error(
            'No libraries have a remembered scan folder yet.',
            code='bad_request',
            body_status='rejected',
            body_error=(
                'No libraries have a remembered scan folder yet. '
                'Run one Auto Scan per library first.'
            ),
            queued=[],
        )

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

        Thread(target=_run_queue, daemon=True, name='oneirodex-refresh-all').start()
        message = (
            f'Refresh-all started for {len(queue)} libraries '
            f'(sequential worker, force_parallel). {FORCE_PARALLEL_RISK}'
        )
        return api_ok({
            'status': 'started',
            'queued': queue,
            'count': len(queue),
            'message': message,
            'risk': FORCE_PARALLEL_RISK,
        })

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
    return api_ok(payload)


# UX-C5 — why an operator says a proposed match is wrong. A controlled list
# keeps the feedback aggregatable; 'other' carries a free-text note so the
# vocabulary can grow from real usage instead of guesswork.
BAD_MATCH_REASONS = {
    'wrong_game': 'Wrong game entirely',
    'wrong_edition': 'Right game, wrong edition/version',
    'wrong_platform': 'Right game, wrong platform',
    'wrong_region': 'Right game, wrong region',
    'is_dlc_or_update': 'This is DLC / an update, not the base game',
    'is_not_a_game': 'Not a game (tool, emulator, extras)',
    'duplicate_of_other': 'Duplicate of another entry',
    'other': 'Other',
}


@apis_bp.route('/unmatched/bad_match_reasons', methods=['GET'])
@login_required
@librarian_required
def unmatched_bad_match_reasons():
    """Vocabulary for the Bad match picker, so the UI never hardcodes it."""
    return api_ok({
        'reasons': [{'id': key, 'label': label} for key, label in BAD_MATCH_REASONS.items()],
    })


@apis_bp.route('/unmatched/<folder_id>/bad_match', methods=['POST'])
@login_required
@librarian_required
def unmatched_flag_bad_match(folder_id: str):
    """Record that a proposed match is wrong, with a reason.

    Deliberately does **not** delete the row or touch the library: this is
    feedback about the match, not a destructive triage action. Post with
    ``{"reason": null}`` to clear a flag set by mistake.
    """
    row = db.session.get(UnmatchedFolder, folder_id)
    if row is None:
        return api_error('Folder not found', code='not_found')

    data = request.get_json(silent=True) or {}
    raw_reason = data.get('reason')

    if raw_reason in (None, '', False):
        row.bad_match_reason = None
        row.bad_match_note = None
        row.bad_match_at = None
        row.bad_match_by_user_id = None
        db.session.commit()
        return api_ok({'cleared': True})

    reason = str(raw_reason).strip().lower()
    if reason not in BAD_MATCH_REASONS:
        return api_error(
            f"reason must be one of: {', '.join(sorted(BAD_MATCH_REASONS))}",
            code='bad_request',
        )

    note = (data.get('note') or '').strip()[:500]
    # 'other' without a note is not feedback, it is a shrug.
    if reason == 'other' and not note:
        return api_error('A note is required when the reason is "other"', code='bad_request')

    from datetime import datetime, timezone

    row.bad_match_reason = reason
    row.bad_match_note = note or None
    row.bad_match_at = datetime.now(timezone.utc)
    row.bad_match_by_user_id = getattr(current_user, 'id', None)
    db.session.commit()

    log_system_event(
        f'Bad match flagged on {row.folder_path}: {reason}',
        event_type='admin_action',
        event_level='information',
        audit_user=getattr(current_user, 'id', None),
    )

    return api_ok({
        'folder_id': folder_id,
        'reason': reason,
        'label': BAD_MATCH_REASONS[reason],
        'note': row.bad_match_note,
    })
