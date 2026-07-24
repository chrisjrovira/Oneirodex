"""Library health API."""

from flask import jsonify, request
from flask_login import login_required, current_user
from sqlalchemy import select

from gametheca import db
from gametheca.models import Game
from gametheca.utils.library_health import score_game, summarize_library_health

from . import apis_bp


@apis_bp.route('/health/library', methods=['GET'])
@login_required
def library_health_summary():
    if current_user.role != 'admin':
        return jsonify({'error': 'Admin required'}), 403
    try:
        limit = min(int(request.args.get('limit') or 200), 2000)
    except (TypeError, ValueError):
        limit = 200
    library_uuid = (request.args.get('library_uuid') or '').strip() or None
    return jsonify(summarize_library_health(limit=limit, library_uuid=library_uuid))


@apis_bp.route('/health/games/<game_uuid>', methods=['GET'])
@login_required
def game_health_detail(game_uuid: str):
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game:
        return jsonify({'error': 'Game not found'}), 404
    return jsonify(score_game(game))
