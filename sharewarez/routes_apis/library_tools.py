"""Admin library tools: rename preview/apply, match proposals, library doctor."""

from __future__ import annotations

import json
import os

from flask import jsonify, request, current_app
from flask_login import login_required
from sqlalchemy import select

from sharewarez import db
from sharewarez.models import Game, Library
from sharewarez.utils.auth import admin_required
from sharewarez.utils.security import is_safe_path, get_allowed_base_directories
from sharewarez.utils.disk_rename import build_rename_plan, apply_rename_plan
from sharewarez.utils.match_proposal import PROPOSAL_FILENAME
from sharewarez.utils.library_doctor import doctor_dry_run, doctor_write_proposals, iter_game_folders

from . import apis_bp


def _allowed_bases():
    return get_allowed_base_directories(current_app)


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
    """Scan library games for sharewarez.proposal.json files."""
    libraries = db.session.execute(select(Library)).scalars().all()
    found = []
    for library in libraries:
        games = db.session.execute(select(Game).filter_by(library_uuid=library.uuid)).scalars().all()
        for game in games:
            proposal_path = os.path.join(game.full_disk_path or '', PROPOSAL_FILENAME)
            if os.path.isfile(proposal_path):
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
    proposal_path = os.path.join(path, PROPOSAL_FILENAME)
    try:
        if os.path.isfile(proposal_path):
            os.remove(proposal_path)
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
            proposal_path = os.path.join(folder, PROPOSAL_FILENAME)
            if not os.path.isfile(proposal_path):
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
    from sharewarez.utils.library_doctor import doctor_apply_renames
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
