"""Admin library tools: rename preview/apply, match proposals, library doctor."""

from __future__ import annotations

import json
import os

from flask import jsonify, request, current_app
from flask_login import login_required
from sqlalchemy import select

from gametheca import db
from gametheca.models import Game, Library
from gametheca.utils.auth import admin_required
from gametheca.utils.security import is_safe_path, get_allowed_base_directories
from gametheca.utils.disk_rename import build_rename_plan, apply_rename_plan
from gametheca.utils.match_proposal import (
    resolve_proposal_path,
    remove_proposal_files,
)
from gametheca.utils.library_doctor import doctor_dry_run, doctor_write_proposals, iter_game_folders
from gametheca.utils.propose_leaf_libraries import propose_leaf_libraries
from gametheca.utils.import_leaf_libraries import preview_from_csv, preview_from_json

from . import apis_bp


def _allowed_bases():
    return get_allowed_base_directories(current_app)


@apis_bp.route('/library_tools/propose_leaf_libraries', methods=['GET', 'POST'])
@login_required
@admin_required
def propose_leaf_libraries_api():
    """Propose candidate leaf libraries under a console/tree root (never creates).

    Body/query: ``root`` (or ``path``) — absolute path under allowed bases.
    Returns ``{status, root, candidates:[{path, suggested_name, platform,
    scan_mode, scan_depth, reason}], count}``. Does **not** insert Library rows.
    """
    data = request.get_json(silent=True) or {}
    root = (
        data.get('root')
        or data.get('path')
        or request.args.get('root')
        or request.args.get('path')
        or ''
    )
    root = str(root).strip()
    if not root:
        return jsonify({'status': 'error', 'message': 'root path required'}), 400

    safe, err = is_safe_path(root, _allowed_bases())
    if not safe:
        return jsonify({'status': 'error', 'message': err or 'Unsafe path'}), 403

    if not os.path.isdir(root):
        return jsonify({'status': 'error', 'message': 'root is not a directory'}), 400

    candidates = propose_leaf_libraries(root)
    return jsonify({
        'status': 'ok',
        'root': os.path.normpath(root),
        'candidates': candidates,
        'count': len(candidates),
        'auto_create': False,
    })


@apis_bp.route('/library_tools/import_leaf_libraries/preview', methods=['POST'])
@login_required
@admin_required
def import_leaf_libraries_preview_api():
    """Preview/validate CSV or JSON leaf library definitions (never creates).

    Accepts:
      - JSON body: array of rows, or ``{candidates|items|libraries|rows: [...]}``
      - multipart ``file`` upload (``.json`` / ``.csv``, UTF-8)

    Each row: ``path``, ``suggested_name``/``name``, ``platform``, ``scan_mode``,
    ``scan_depth`` (same shape as propose-from-tree candidates).

    Returns ``{status, auto_create:false, candidates, errors, count, error_count,
    create_hint}``. Create selected rows client-side via existing
    ``POST /admin/library/add`` + ``POST /api/admin/libraries/scan`` (propose UI).
    """
    bases = _allowed_bases()
    upload = request.files.get('file')
    if upload and upload.filename:
        filename = (upload.filename or '').lower()
        raw = upload.read()
        try:
            text = raw.decode('utf-8-sig')
        except UnicodeDecodeError:
            return jsonify({
                'status': 'error',
                'message': 'File must be UTF-8 text',
                'auto_create': False,
            }), 400
        if filename.endswith('.csv') or (request.form.get('format') or '').lower() == 'csv':
            result = preview_from_csv(text, allowed_bases=bases)
        else:
            result = preview_from_json(text, allowed_bases=bases)
        return jsonify(result)

    data = request.get_json(silent=True)
    if data is None:
        # Allow raw CSV text under form field `csv` / `text`
        csv_text = request.form.get('csv') or request.form.get('text')
        if csv_text:
            result = preview_from_csv(csv_text, allowed_bases=bases)
            return jsonify(result)
        return jsonify({
            'status': 'error',
            'message': 'JSON body or file upload required',
            'auto_create': False,
        }), 400

    result = preview_from_json(data, allowed_bases=bases)
    return jsonify(result)


@apis_bp.route('/library_tools/rename/preview', methods=['POST'])
@login_required
@admin_required
def rename_preview():
    data = request.get_json(silent=True) or {}
    game_uuid = data.get('game_uuid')
    template = data.get('template') or '{title}'
    rename_root = bool(data.get('rename_root', True))
    rename_media = bool(data.get('rename_top_level_media', False))
    move_bucket = bool(data.get('move_letter_bucket', False))
    title = data.get('title')
    year = data.get('year')

    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalar_one_or_none() if game_uuid else None
    if not game:
        return jsonify({'status': 'error', 'message': 'Game not found'}), 404

    root = game.full_disk_path
    safe, err = is_safe_path(root, _allowed_bases())
    if not safe:
        return jsonify({'status': 'error', 'message': err or 'Unsafe path'}), 403

    plan = build_rename_plan(
        root,
        title=title or game.name,
        year=year,
        template=template,
        rename_root=rename_root,
        rename_top_level_media=rename_media,
        move_letter_bucket=move_bucket,
    )
    return jsonify({'status': 'ok', 'plan': plan, 'game_uuid': game.uuid})


@apis_bp.route('/library_tools/rename/apply', methods=['POST'])
@login_required
@admin_required
def rename_apply():
    data = request.get_json(silent=True) or {}
    game_uuid = data.get('game_uuid')
    plan = data.get('plan') or []
    if not isinstance(plan, list) or not plan:
        return jsonify({'status': 'error', 'message': 'No rename operations selected'}), 400

    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalar_one_or_none() if game_uuid else None
    if not game:
        return jsonify({'status': 'error', 'message': 'Game not found'}), 404

    results = apply_rename_plan(plan, _allowed_bases())
    # Update DB path if root folder rename succeeded
    for item, result in zip(plan, results):
        if result.get('ok') and item.get('kind') == 'root_folder':
            game.full_disk_path = result['to_path']
            try:
                from gametheca.utils.rom_language import apply_rom_language_fields

                apply_rom_language_fields(game, result['to_path'])
            except Exception:
                pass
            try:
                db.session.commit()
            except Exception as exc:
                db.session.rollback()
                return jsonify({
                    'status': 'error',
                    'message': f'Disk renamed but DB update failed: {exc}',
                    'results': results,
                }), 500

    return jsonify({'status': 'ok', 'results': results, 'full_disk_path': game.full_disk_path})


@apis_bp.route('/library_tools/proposals', methods=['GET'])
@login_required
@admin_required
def list_proposals():
    """Scan library games for gametheca.proposal.json files."""
    libraries = db.session.execute(select(Library)).scalars().all()
    found = []
    for library in libraries:
        games = db.session.execute(select(Game).filter_by(library_uuid=library.uuid)).scalars().all()
        for game in games:
            proposal_path = resolve_proposal_path(game.full_disk_path or '')
            if proposal_path:
                try:
                    with open(proposal_path, encoding='utf-8') as handle:
                        payload = json.load(handle)
                except (OSError, json.JSONDecodeError):
                    payload = None
                found.append({
                    'game_uuid': game.uuid,
                    'game_name': game.name,
                    'path': game.full_disk_path,
                    'proposal': (payload or {}).get('proposal'),
                    'library_uuid': library.uuid,
                    'library_name': library.name,
                })
    return jsonify({'status': 'ok', 'proposals': found})


@apis_bp.route('/library_tools/proposals/approve', methods=['POST'])
@login_required
@admin_required
def approve_proposal():
    """
    Approve a proposal by IGDB ID for an on-disk folder path.
    Clears the proposal sidecar and returns identify hint for import.
    """
    data = request.get_json(silent=True) or {}
    path = data.get('path')
    igdb_id = data.get('igdb_id')
    if not path or not igdb_id:
        return jsonify({'status': 'error', 'message': 'path and igdb_id required'}), 400
    safe, err = is_safe_path(path, _allowed_bases())
    if not safe:
        return jsonify({'status': 'error', 'message': err or 'Unsafe path'}), 403
    try:
        remove_proposal_files(path)
    except OSError as exc:
        return jsonify({'status': 'error', 'message': str(exc)}), 500
    return jsonify({
        'status': 'ok',
        'message': 'Proposal cleared. Complete import via Add Game / Identify with this IGDB ID.',
        'path': path,
        'igdb_id': igdb_id,
        'identify_hint': f"/add_game_manual?full_disk_path={path}&igdb_id={igdb_id}",
    })


@apis_bp.route('/library_tools/proposals/scan_roots', methods=['POST'])
@login_required
@admin_required
def scan_roots_for_proposals():
    data = request.get_json(silent=True) or {}
    roots = data.get('roots') or []
    if not isinstance(roots, list):
        return jsonify({'status': 'error', 'message': 'roots must be a list'}), 400

    found = []
    for root in roots:
        safe, err = is_safe_path(root, _allowed_bases())
        if not safe:
            continue
        for folder in iter_game_folders(root):
            proposal_path = resolve_proposal_path(folder)
            if not proposal_path:
                continue
            try:
                with open(proposal_path, encoding='utf-8') as handle:
                    payload = json.load(handle)
            except (OSError, json.JSONDecodeError):
                payload = None
            found.append({
                'path': folder,
                'proposal': (payload or {}).get('proposal'),
            })
    return jsonify({'status': 'ok', 'proposals': found})


@apis_bp.route('/library_tools/doctor/dry_run', methods=['POST'])
@login_required
@admin_required
def library_doctor_dry_run():
    data = request.get_json(silent=True) or {}
    roots = data.get('roots') or []
    template = data.get('template') or '{title}'
    limit = data.get('limit')
    if not isinstance(roots, list) or not roots:
        return jsonify({'status': 'error', 'message': 'roots required'}), 400

    safe_roots = []
    for root in roots:
        ok, _ = is_safe_path(root, _allowed_bases())
        if ok:
            safe_roots.append(root)
    if not safe_roots:
        return jsonify({'status': 'error', 'message': 'No safe roots'}), 403

    rows = doctor_dry_run(safe_roots, template=template, limit=limit)
    return jsonify({'status': 'ok', 'rows': rows, 'count': len(rows)})


@apis_bp.route('/library_tools/doctor/write_proposals', methods=['POST'])
@login_required
@admin_required
def library_doctor_write_proposals():
    data = request.get_json(silent=True) or {}
    rows = data.get('rows') or []
    if not isinstance(rows, list):
        return jsonify({'status': 'error', 'message': 'rows must be a list'}), 400
    # Only allow writing under safe bases
    filtered = []
    for row in rows:
        path = row.get('path')
        if path and is_safe_path(path, _allowed_bases())[0]:
            filtered.append(row)
    results = doctor_write_proposals(filtered)
    return jsonify({'status': 'ok', 'results': results})


@apis_bp.route('/library_tools/doctor/apply_renames', methods=['POST'])
@login_required
@admin_required
def library_doctor_apply_renames():
    from gametheca.utils.library_doctor import doctor_apply_renames
    data = request.get_json(silent=True) or {}
    rows = data.get('rows') or []
    template = data.get('template') or '{title}'
    if not isinstance(rows, list) or not rows:
        return jsonify({'status': 'error', 'message': 'rows required'}), 400
    filtered = []
    for row in rows:
        path = row.get('path')
        if path and is_safe_path(path, _allowed_bases())[0]:
            filtered.append(row)
    results = doctor_apply_renames(filtered, _allowed_bases(), template=template)
    return jsonify({'status': 'ok', 'results': results})


@apis_bp.route('/library_tools/backfill_steam_metadata', methods=['POST'])
@login_required
@admin_required
def library_tools_backfill_steam_metadata():
    """Repair games that were identified via Steam but landed without content.

    Stage D used to persist only name/summary/cover, and the storesearch hit it
    matched on carries no description at all — so existing rows can have a Steam
    App ID and still show a blank summary with no genres or credits. This re-reads
    ``appdetails`` for those rows and fills the gaps (never overwrites).

    Body: ``library_uuid`` (optional scope), ``limit`` (default 100, max 500),
    ``only_incomplete`` (default true — skip rows that already have summary+genres),
    ``cascade`` (default true — see below).

    With ``cascade`` on, rows **without** a Steam App ID are repairable too. That
    matters because the Steam-only query could never reach a GOG-identified title
    or a console ROM, which are exactly the rows most likely to be bare.
    """
    from gametheca.utils.steam_metadata import hydrate_game_from_steam

    data = request.get_json(silent=True) or {}
    limit = min(max(int(data.get('limit') or 100), 1), 500)
    only_incomplete = bool(data.get('only_incomplete', True))
    use_cascade = bool(data.get('cascade', True))

    query = select(Game)
    if not use_cascade:
        query = query.filter(Game.steam_app_id.isnot(None))
    if data.get('library_uuid'):
        query = query.filter(Game.library_uuid == data['library_uuid'])

    candidates = db.session.execute(query).scalars().all()

    updated, skipped, errors = [], 0, []
    for game in candidates:
        if len(updated) >= limit:
            break
        if only_incomplete and (game.summary or '').strip() and (game.genres or []):
            skipped += 1
            continue
        try:
            if game.steam_app_id:
                report = hydrate_game_from_steam(game)
            else:
                report = {}
            if use_cascade and not ((game.summary or '').strip() and (game.genres or [])):
                from gametheca.utils.metadata_cascade import hydrate_game_from_cascade

                # A row that just went through hydrate_game_from_steam has had
                # Steam's appdetails applied already; asking the cascade to
                # search Steam by name again is a round trip per row, and a
                # backfill can run over hundreds of them.
                cascade_result = hydrate_game_from_cascade(
                    game, skip=('steam',) if game.steam_app_id else ()
                )
                for key, value in (cascade_result.get('applied') or {}).items():
                    # Union the two reports so the response says what actually
                    # changed, regardless of which path filled it.
                    if value and not report.get(key):
                        report[key] = value
        except Exception as exc:  # noqa: BLE001
            errors.append({'uuid': game.uuid, 'name': game.name, 'error': str(exc)})
            continue
        changed = any(
            bool(v) for v in report.values()
        ) if report else False
        if changed:
            updated.append({
                'uuid': game.uuid,
                'name': game.name,
                'filled': {k: v for k, v in report.items() if v},
            })
        else:
            skipped += 1

    if updated:
        db.session.commit()

    return jsonify({
        'ok': True,
        'scanned': len(candidates),
        'updated': len(updated),
        'skipped': skipped,
        'errors': errors,
        'games': updated[:50],
    })


@apis_bp.route('/library_tools/check_freshness', methods=['POST'])
@login_required
@admin_required
def library_tools_check_freshness():
    """Check version / updates / DLC across a library (FEAT-D1).

    The same pass a scan runs when ``SCAN_CHECK_FRESHNESS`` is on, exposed so it
    can be run against an already-scanned library without a re-scan.

    Body: ``library_uuid`` (required), ``limit`` (default 50, max 500),
    ``only_missing`` (default true — spend the budget on unknowns).
    """
    from gametheca.utils.freshness.service import check_library_freshness

    data = request.get_json(silent=True) or {}
    library_uuid = (data.get('library_uuid') or '').strip()
    if not library_uuid:
        return jsonify({'error': 'library_uuid is required'}), 400

    library = db.session.execute(
        select(Library).filter_by(uuid=library_uuid)
    ).scalars().first()
    if not library:
        return jsonify({'error': 'Library not found'}), 404

    try:
        limit = min(max(int(data.get('limit') or 50), 1), 500)
    except (TypeError, ValueError):
        return jsonify({'error': 'limit must be a number'}), 400

    result = check_library_freshness(
        library_uuid,
        limit=limit,
        only_missing=bool(data.get('only_missing', True)),
    )
    return jsonify({'ok': True, **result})
