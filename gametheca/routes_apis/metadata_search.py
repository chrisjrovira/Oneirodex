"""Manual multi-source metadata search for identify / add game UI."""

from flask import current_app, jsonify, request
from flask_login import login_required

from gametheca.utils.auth import admin_required
from gametheca.utils.secondary_scrapers import (
    search_gog_games,
    search_rawg_games,
    search_steam_games,
)

from . import apis_bp

SUPPORTED_SOURCES = ('steam', 'rawg', 'gog')


@apis_bp.route('/search_metadata', methods=['GET'])
@login_required
@admin_required
def search_metadata():
    """Search Steam / RAWG / GOG by game name (admin identify UI).

    Query args:
      name (required)
      source: steam|rawg|gog (required)
      limit: int (default 10, max 20)
    """
    name = (request.args.get('name') or '').strip()
    source = (request.args.get('source') or '').strip().lower()
    try:
        limit = min(int(request.args.get('limit') or 10), 20)
    except (TypeError, ValueError):
        limit = 10

    if not name:
        return jsonify({'error': 'No game name provided'}), 400
    if source not in SUPPORTED_SOURCES:
        return jsonify({
            'error': f'Unsupported source. Use one of: {", ".join(SUPPORTED_SOURCES)}',
        }), 400

    if source == 'steam':
        results = search_steam_games(name, limit=limit)
    elif source == 'rawg':
        api_key = current_app.config.get('RAWG_API_KEY') or None
        results = search_rawg_games(name, api_key=api_key, limit=limit)
    else:
        results = search_gog_games(name, limit=limit)

    return jsonify({'source': source, 'results': results})
