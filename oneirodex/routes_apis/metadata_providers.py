"""Admin metadata provider toggles (Steam / GOG / Epic)."""

from __future__ import annotations

from flask import request
from flask_login import login_required

from oneirodex.utils.api_response import api_error, api_ok
from oneirodex.utils.auth import admin_required
from oneirodex.utils.metadata_providers import (
    get_metadata_providers_config,
    save_metadata_providers,
)

from . import apis_bp


@apis_bp.route('/admin/integrations/metadata-providers', methods=['GET', 'PUT'])
@login_required
@admin_required
def metadata_providers_config():
    """
    GET: ``{providers: {steam,gog,epic}, notes: {...}}``.
    PUT: partial update (flat or nested under ``providers``); echoes full config.
    """
    if request.method == 'GET':
        return api_ok(get_metadata_providers_config())

    data = request.get_json(silent=True) or {}
    if not data:
        return api_error('No fields to update', code='bad_request')
    try:
        saved = save_metadata_providers(data)
    except ValueError as exc:
        return api_error(str(exc), code='bad_request')
    return api_ok(saved)
