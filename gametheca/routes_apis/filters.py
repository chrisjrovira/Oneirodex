# /gametheca/routes_apis/filters.py
from typing import Tuple, List, Dict, Any, Type
from flask import jsonify, Response
from flask_login import current_user, login_required
from gametheca.models import Genre, Theme, GameMode, PlayerPerspective, Library, Platform, Game
from gametheca import db
from gametheca.utils.event_logging import log_system_event
from gametheca.utils.library_acl import allowed_library_uuids, apply_game_access_filters
from sqlalchemy import select, func
from sqlalchemy.exc import SQLAlchemyError
from . import apis_bp

def _get_filter_data(model_class: Type[db.Model], filter_type: str) -> Tuple[Response, int]:
    """
    Generic helper function to fetch and format filter data.
    
    Args:
        model_class: SQLAlchemy model class to query
        filter_type: String identifier for logging purposes
        
    Returns:
        Tuple of JSON response and HTTP status code
    """
    try:
        results = db.session.execute(select(model_class).order_by(model_class.name.asc())).scalars().all()
        data_list = [{'id': item.id, 'name': item.name} for item in results]
        
        return jsonify(data_list), 200
        
    except SQLAlchemyError as e:
        log_system_event('filters_api', f'Database error fetching {filter_type}: {str(e)}', 'error')
        return jsonify({
            'status': 'error',
            'message': f'Database error retrieving {filter_type}'
        }), 500
        
    except Exception as e:
        log_system_event('filters_api', f'Unexpected error fetching {filter_type}: {str(e)}', 'error')
        return jsonify({
            'status': 'error',
            'message': f'Error retrieving {filter_type}'
        }), 500


@apis_bp.route('/genres')
@login_required
def get_genres() -> Tuple[Response, int]:
    """
    Get all available game genres.
    
    Returns:
        JSON response containing list of genres with id and name fields.
        On success: List of genre objects with 200 status
        On error: Error object with appropriate status code
    """
    return _get_filter_data(Genre, 'genres')


@apis_bp.route('/themes')
@login_required
def get_themes() -> Tuple[Response, int]:
    """
    Get all available game themes.
    
    Returns:
        JSON response containing list of themes with id and name fields.
        On success: List of theme objects with 200 status
        On error: Error object with appropriate status code
    """
    return _get_filter_data(Theme, 'themes')


@apis_bp.route('/game_modes')
@login_required
def get_game_modes() -> Tuple[Response, int]:
    """
    Get all available game modes.
    
    Returns:
        JSON response containing list of game modes with id and name fields.
        On success: List of game mode objects with 200 status
        On error: Error object with appropriate status code
    """
    return _get_filter_data(GameMode, 'game_modes')


@apis_bp.route('/player_perspectives')
@login_required
def get_player_perspectives() -> Tuple[Response, int]:
    """
    Get all available player perspectives.
    
    Returns:
        JSON response containing list of player perspectives with id and name fields.
        On success: List of perspective objects with 200 status
        On error: Error object with appropriate status code
    """
    return _get_filter_data(PlayerPerspective, 'player_perspectives')


@apis_bp.route('/library_platforms')
@login_required
def get_library_platforms():
    try:
        allowed = allowed_library_uuids(current_user)
        if allowed is not None and not allowed:
            return jsonify([]), 200

        accessible_games = apply_game_access_filters(select(Game.id, Game.library_uuid), current_user).subquery()
        query = (
            select(Library.platform, func.count(accessible_games.c.id))
            .select_from(Library)
            .outerjoin(accessible_games, accessible_games.c.library_uuid == Library.uuid)
            .group_by(Library.platform)
        )
        if allowed is not None:
            query = query.filter(Library.uuid.in_(list(allowed)))

        count_rows = db.session.execute(query).all()
        counts = {}
        for platform, game_count in count_rows:
            if platform is None:
                continue
            counts[platform] = counts.get(platform, 0) + int(game_count or 0)

        data = []
        for p, game_count in sorted(counts.items(), key=lambda item: item[0].value.lower()):
            data.append({
                'id': p.name,
                'name': p.value,
                'value': p.name,
                'game_count': game_count,
            })
        return jsonify(data), 200
    except SQLAlchemyError as e:
        log_system_event('filters_api', f'Database error fetching library_platforms: {str(e)}', 'error')
        return jsonify({'status': 'error', 'message': 'Database error retrieving library platforms'}), 500


@apis_bp.route('/igdb_platforms')
@login_required
def get_igdb_platforms():
    try:
        results = db.session.execute(
            select(Platform)
            .join(Platform.games)
            .distinct()
            .order_by(Platform.name.asc())
        ).scalars().all()
        data_list = [{'id': item.id, 'name': item.name} for item in results]
        return jsonify(data_list), 200
    except SQLAlchemyError as e:
        log_system_event('filters_api', f'Database error fetching igdb_platforms: {str(e)}', 'error')
        return jsonify({'status': 'error', 'message': 'Database error retrieving igdb platforms'}), 500
