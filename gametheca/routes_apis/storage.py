"""Storage helpers (hardlink preview/apply)."""

from __future__ import annotations

from flask import current_app, jsonify, request
from flask_login import login_required

from gametheca.utils.auth import admin_required
from gametheca.utils.event_logging import log_system_event
from gametheca.utils.hardlinks import apply_hardlink, preview_hardlink
from gametheca.utils.security import get_allowed_base_directories, is_safe_path

from . import apis_bp


def _helpers_enabled() -> bool:
    return str(current_app.config.get('ENABLE_HARDLINK_HELPERS', '')).lower() in (
        '1', 'true', 'yes', 'on',
    )


def _apply_allowed() -> bool:
    return _helpers_enabled() and str(
        current_app.config.get('ALLOW_HARDLINK_APPLY', ''),
    ).lower() in ('1', 'true', 'yes', 'on')


def _paths_allowed(source: str, dest: str) -> tuple[bool, str | None]:
    bases = get_allowed_base_directories(current_app)
    ok_s, err_s = is_safe_path(source, bases)
    if not ok_s:
        return False, err_s or 'Unsafe source path'
    ok_d, err_d = is_safe_path(dest, bases)
    if not ok_d:
        return False, err_d or 'Unsafe destination path'
    return True, None


@apis_bp.route('/storage/hardlink/preview', methods=['POST'])
@login_required
@admin_required
def hardlink_preview():
    if not _helpers_enabled():
        return jsonify({'error': 'Hardlink helpers are disabled'}), 403
    data = request.get_json(silent=True) or {}
    source = (data.get('source') or '').strip()
    dest = (data.get('dest') or '').strip()
    if not source or not dest:
        return jsonify({'error': 'source and dest are required'}), 400
    ok, err = _paths_allowed(source, dest)
    if not ok:
        return jsonify({'error': err}), 403
    return jsonify(preview_hardlink(source, dest))


@apis_bp.route('/storage/hardlink/apply', methods=['POST'])
@login_required
@admin_required
def hardlink_apply():
    if not _apply_allowed():
        return jsonify({
            'error': 'Hardlink apply is disabled. Set ALLOW_HARDLINK_APPLY=true.',
        }), 403
    data = request.get_json(silent=True) or {}
    source = (data.get('source') or '').strip()
    dest = (data.get('dest') or '').strip()
    if not source or not dest:
        return jsonify({'error': 'source and dest are required'}), 400
    ok, err = _paths_allowed(source, dest)
    if not ok:
        return jsonify({'error': err}), 403
    try:
        result = apply_hardlink(source, dest)
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    except OSError as exc:
        return jsonify({'error': f'Hardlink failed: {exc}'}), 500
    try:
        log_system_event(
            f'Hardlink created: {result.get("source")} -> {result.get("dest")}',
            event_type='audit',
            event_level='information',
        )
    except Exception:
        pass
    return jsonify(result), 201
