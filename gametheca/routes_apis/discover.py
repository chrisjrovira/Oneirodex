"""Discover shelves JSON API — member SPA loads this after mount."""

from __future__ import annotations

from flask import jsonify
from flask_login import current_user, login_required

from gametheca.routes_discover import build_discover_sections

from . import apis_bp


@apis_bp.route('/discover/sections', methods=['GET'])
@login_required
def discover_sections():
    sections = build_discover_sections(current_user)
    return jsonify({'sections': sections})
