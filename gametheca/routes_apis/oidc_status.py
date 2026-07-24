"""OIDC readiness status API (does not contact the IdP)."""

from flask import jsonify
from flask_login import login_required

from gametheca.utils.auth import admin_required
from gametheca.utils.oidc import oidc_readiness_report

from . import apis_bp


@apis_bp.route('/oidc/status', methods=['GET'])
@login_required
@admin_required
def oidc_status():
    """Return local OIDC configuration readiness for operators."""
    return jsonify(oidc_readiness_report())
