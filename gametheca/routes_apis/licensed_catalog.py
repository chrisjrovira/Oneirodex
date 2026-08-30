"""Member licensed-catalog report and admin IGDB cache refresh."""

from __future__ import annotations

from flask import request
from flask_login import current_user, login_required

from gametheca.utils.api_response import api_error, api_ok
from gametheca.utils.auth import admin_required
from gametheca.utils.event_logging import log_system_event
from gametheca.utils.licensed_catalog import (
    cache_age_summary,
    licensed_catalog_report,
    refresh_platform_catalog,
)
from gametheca.utils.set_completion import REGION_LABELS, REGION_PREF_ORDER

from . import apis_bp


@apis_bp.route('/licensed-catalog', methods=['GET'])
@login_required
def api_licensed_catalog():
    platform = (request.args.get('library_platform') or request.args.get('platform') or '').strip()
    if not platform:
        return api_ok(
            {
                'regions': list(REGION_PREF_ORDER),
                'region_labels': dict(REGION_LABELS),
                'note': (
                    'Pass library_platform to read cached IGDB release_dates. '
                    'Empty cache is not zero games ever made.'
                ),
            }
        )
    try:
        report = licensed_catalog_report(platform, current_user)
    except ValueError as exc:
        return api_error(str(exc), code='bad_request')
    return api_ok(report)


@apis_bp.route('/licensed-catalog/refresh', methods=['POST'])
@login_required
@admin_required
def api_licensed_catalog_refresh():
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
        result = refresh_platform_catalog(platform)
    except ValueError as exc:
        return api_error(str(exc), code='bad_request')
    except RuntimeError as exc:
        return api_error(
            'IGDB did not return a licensed catalog page.',
            code='bad_gateway',
            detail=str(exc),
        )
    log_system_event(
        (
            f'Licensed catalog refresh: {result["library_platform"]} '
            f'titles={result["unique_titles"]} pages={result["pages"]}'
        ),
        event_type='admin',
        event_level='information',
    )
    return api_ok(result)


@apis_bp.route('/licensed-catalog/status', methods=['GET'])
@login_required
@admin_required
def api_licensed_catalog_status():
    platform = (request.args.get('library_platform') or request.args.get('platform') or '').strip()
    if not platform:
        return api_error('library_platform required', code='bad_request')
    try:
        return api_ok(cache_age_summary(platform))
    except ValueError as exc:
        return api_error(str(exc), code='bad_request')
