"""Admin Integrations inventory API."""

from flask import jsonify
from flask_login import login_required

from gametheca.utils.auth import admin_required
from gametheca.utils.integrations_inventory import build_integrations_inventory

from . import apis_bp


@apis_bp.route('/admin/integrations/inventory', methods=['GET'])
@login_required
@admin_required
def integrations_inventory():
    """List all admin-facing integrations with status + deep links."""
    items = build_integrations_inventory()
    return jsonify({
        'integrations': items,
        'count': len(items),
        'hub_href': '/admin/integrations',
    })
