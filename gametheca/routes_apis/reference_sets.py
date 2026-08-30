"""Reference set (DAT) upload and set-completion APIs."""

from __future__ import annotations

from gametheca.utils.api_response import api_error, api_ok
from flask import jsonify, request
from flask_login import current_user, login_required

from gametheca.utils.auth import admin_required
from gametheca.utils.event_logging import log_system_event
from gametheca.utils.set_completion import (
    REGION_PREF_ORDER,
    VALID_SOURCES,
    compute_set_completion,
    delete_reference_set,
    list_reference_sets,
    rehash_library_platform,
    upsert_reference_set,
    validate_library_platform,
)

from . import apis_bp

MAX_DAT_BYTES = 32 * 1024 * 1024  # 32 MiB


@apis_bp.route('/reference-sets', methods=['GET'])
@login_required
def api_list_reference_sets():
    return jsonify({'sets': list_reference_sets()})


@apis_bp.route('/reference-sets', methods=['POST'])
@login_required
@admin_required
def api_upload_reference_set():
    upload = request.files.get('file') or request.files.get('dat')
    if not upload or not upload.filename:
        return api_error('DAT file required', code='bad_request')

    platform = (request.form.get('library_platform') or request.form.get('platform') or '').strip()
    region = (request.form.get('region') or 'USA').strip()
    source = (request.form.get('source') or 'nointro').strip()
    name = (request.form.get('name') or '').strip() or None

    raw = upload.read(MAX_DAT_BYTES + 1)
    if len(raw) > MAX_DAT_BYTES:
        return api_error(f'DAT too large (max {MAX_DAT_BYTES} bytes)', code='bad_request')
    if not raw:
        return api_error('Empty DAT file', code='bad_request')

    try:
        validate_library_platform(platform)
        ref = upsert_reference_set(
            library_platform=platform,
            region=region,
            source=source,
            dat_bytes=raw,
            name=name,
            uploader_id=getattr(current_user, 'id', None),
        )
    except ValueError as exc:
        return api_error(str(exc), code='bad_request')
    except Exception as exc:  # noqa: BLE001 — surface parse errors cleanly
        return api_error(f'Failed to parse DAT: {exc}', code='bad_request')

    log_system_event(
        f'Reference set uploaded: {ref.library_platform}/{ref.region} ({ref.entry_count} entries)',
        event_type='admin',
        event_level='information',
    )
    return jsonify(ref.to_dict()), 201


@apis_bp.route('/reference-sets/<int:set_id>', methods=['DELETE'])
@login_required
@admin_required
def api_delete_reference_set(set_id: int):
    if not delete_reference_set(set_id):
        return api_error('Not found', code='not_found')
    log_system_event(
        f'Reference set deleted: id={set_id}',
        event_type='admin',
        event_level='information',
    )
    return api_ok({'id': set_id})


@apis_bp.route('/reference-sets/rehash', methods=['POST'])
@login_required
@admin_required
def api_rehash_reference_platform():
    """Hash ROM files on disk for a library platform (enables CRC DAT matching)."""
    data = request.get_json(silent=True) or {}
    platform = (
        request.form.get('library_platform')
        or data.get('library_platform')
        or data.get('platform')
        or ''
    ).strip()
    if not platform:
        return api_error('library_platform required', code='bad_request')
    try:
        result = rehash_library_platform(platform)
    except ValueError as exc:
        return api_error(str(exc), code='bad_request')
    log_system_event(
        f'Reference set rehash: {result["platform"]} hashed={result["hashed"]} skipped={result["skipped"]}',
        event_type='admin',
        event_level='information',
    )
    return jsonify(result)


@apis_bp.route('/set-completion', methods=['GET'])
@login_required
def api_set_completion():
    platform = (request.args.get('library_platform') or request.args.get('platform') or '').strip()
    region = (request.args.get('region') or 'USA').strip()
    include_matched = request.args.get('include_matched', '0') in ('1', 'true', 'yes')
    try:
        missing_limit = request.args.get('missing_limit', type=int)
    except (TypeError, ValueError):
        missing_limit = None

    if not platform:
        return api_error('library_platform required', code='bad_request')

    try:
        report = compute_set_completion(
            library_platform=platform,
            region=region,
            user=current_user,
            include_matched=include_matched,
            missing_limit=missing_limit,
        )
    except ValueError as exc:
        return api_error(str(exc), code='bad_request')

    if report is None:
        return api_error(
            f'No reference set for {platform}/{region}',
            code='not_found',
            library_platform=platform,
            region=region,
            valid_regions=list(REGION_PREF_ORDER),
            valid_sources=sorted(VALID_SOURCES),
        )

    return jsonify(report)
