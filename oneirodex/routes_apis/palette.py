"""Command-palette empty-state suggestions (on-box only)."""

from flask import request
from flask_login import current_user, login_required

from oneirodex.utils.api_response import api_ok
from oneirodex.utils.palette_suggest import clamp_suggest_limit, palette_suggest

from . import apis_bp


@apis_bp.route('/palette/suggest', methods=['GET'])
@login_required
def palette_suggest_api():
    """Recently played + household-favourite titles for the palette empty state."""
    limit = clamp_suggest_limit(request.args.get('limit'))
    return api_ok(palette_suggest(current_user, limit=limit))
