"""Quality profile + playtime share-card APIs."""

from __future__ import annotations

from flask import Response, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import select

from gametheca import db
from gametheca.models import Game, UserGameProgress
from gametheca.utils.auth import admin_required
from gametheca.utils.quality_profiles import get_quality_profile, save_quality_profile, score_release_title
from gametheca.utils.stats_share import build_playtime_share_svg

from . import apis_bp


@apis_bp.route('/quality-profiles', methods=['GET'])
@login_required
@admin_required
def quality_profiles_get():
    return jsonify(get_quality_profile())


@apis_bp.route('/quality-profiles', methods=['PUT'])
@login_required
@admin_required
def quality_profiles_put():
    data = request.get_json(silent=True) or {}
    try:
        saved = save_quality_profile(data)
    except (TypeError, ValueError) as exc:
        return jsonify({'error': str(exc)}), 400
    return jsonify(saved)


@apis_bp.route('/quality-profiles/score', methods=['POST'])
@login_required
@admin_required
def quality_profiles_score():
    data = request.get_json(silent=True) or {}
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'title is required'}), 400
    size = data.get('size_bytes')
    try:
        size_bytes = int(size) if size is not None else None
    except (TypeError, ValueError):
        size_bytes = None
    return jsonify(score_release_title(title, size_bytes=size_bytes))


@apis_bp.route('/playtime/share/<game_uuid>.svg', methods=['GET'])
@login_required
def playtime_share_card(game_uuid: str):
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game:
        return jsonify({'error': 'Game not found'}), 404
    row = db.session.execute(
        select(UserGameProgress).filter_by(user_id=current_user.id, game_uuid=game_uuid),
    ).scalars().first()
    total = int(row.total_seconds) if row else 0
    sessions = int(row.session_count) if row else 0
    svg = build_playtime_share_svg(
        username=current_user.name,
        game_name=game.name,
        total_seconds=total,
        session_count=sessions,
    )
    return Response(svg, mimetype='image/svg+xml')
