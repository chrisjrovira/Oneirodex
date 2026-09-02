"""Settings-hub status for the admin SPA.

The hub used to render its on/off badges in Jinja from a `module_status`
template variable. When the body moved to React (Wave 7) the template was
emptied but nothing replaced the badges, so `settings_hub_module_status()` was
still being computed on every hub GET and thrown away. This is the consumer
that was missing.
"""

from __future__ import annotations

from flask import jsonify
from flask_login import login_required

from oneirodex.utils.auth import admin_required
from oneirodex.utils.module_status import settings_hub_module_status

from . import apis_bp


@apis_bp.route('/settings/module-status', methods=['GET'])
@login_required
@admin_required
def settings_module_status():
    """Badge payload for the settings hub, keyed by section id."""
    return jsonify(settings_hub_module_status())
