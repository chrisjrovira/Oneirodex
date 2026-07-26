# /gametheca/routes_apis/game.py
from datetime import datetime, timezone
from flask import jsonify, request, url_for
from flask_login import login_required, current_user
from gametheca import db
from gametheca.models import Image, Game, Library, Genre, GameMode, PlayerPerspective, Theme
from gametheca.utils.event_logging import log_system_event
from gametheca.utils.game_core import get_game_by_uuid
from gametheca.utils.game_details_payload import build_game_details_payload
from gametheca.utils.library_acl import apply_game_access_filters, user_can_access_game, user_can_access_library
from sqlalchemy import func, select
from . import apis_bp

@apis_bp.route('/search')
@login_required
def search():
    query = request.args.get('query', '').strip()
    results = []
    if query:
        # Sanitize input - limit length and escape special characters
        if len(query) > 100:  # Reasonable search term length limit
            return jsonify({'error': 'Search term too long'}), 400

        # Build query with name search
        search_term = f'%{query}%'
        search_query = apply_game_access_filters(
            select(Game).filter(Game.name.ilike(search_term)),
            current_user,
        )

        # Apply active filters from request parameters
        library_uuid = request.args.get('library_uuid')
        genre = request.args.get('genre')
        rating = request.args.get('rating', type=int)
        game_mode = request.args.get('game_mode')
        player_perspective = request.args.get('player_perspective')
        theme = request.args.get('theme')

        # Apply filter logic matching routes_library.py:get_games()
        if library_uuid:
            if not user_can_access_library(current_user, library_uuid):
                return jsonify([])
            search_query = search_query.filter(Game.library_uuid == library_uuid)
        if genre:
            search_query = search_query.filter(Game.genres.any(Genre.name == genre))
        if rating is not None:
            search_query = search_query.filter(Game.rating >= rating)
        if game_mode:
            search_query = search_query.filter(Game.game_modes.any(GameMode.name == game_mode))
        if player_perspective:
            search_query = search_query.filter(Game.player_perspectives.any(PlayerPerspective.name == player_perspective))
        if theme:
            search_query = search_query.filter(Game.themes.any(Theme.name == theme))

        # Execute query and build results
        games = db.session.execute(search_query).scalars().all()
        results = [{'id': game.id, 'uuid': game.uuid, 'name': game.name} for game in games]
    return jsonify(results)


@apis_bp.route('/games/<game_uuid>/details', methods=['GET'])
@login_required
def game_details_api(game_uuid):
    """Full game details JSON for the member SPA details page."""
    game = get_game_by_uuid(game_uuid)
    if not game:
        return jsonify({'error': 'Game not found'}), 404
    if not user_can_access_game(current_user, game):
        return jsonify({'error': 'Access denied'}), 403
    return jsonify(build_game_details_payload(game, current_user))


@apis_bp.route('/game_screenshots/<game_uuid>')
@login_required
def game_screenshots(game_uuid):
    screenshots = db.session.execute(select(Image).filter_by(game_uuid=game_uuid, image_type='screenshot')).scalars().all()
    screenshot_urls = [url_for('static', filename=f'library/images/{screenshot.url}') for screenshot in screenshots]
    return jsonify(screenshot_urls)

@apis_bp.route('/move_game_to_library', methods=['POST'])
@login_required
def move_game_to_library():
    try:
        data = request.get_json()
        game_uuid = data.get('game_uuid')
        target_library_uuid = data.get('target_library_uuid')
        
        if not game_uuid or not target_library_uuid:
            return jsonify({
                'success': False,
                'message': 'Missing required parameters'
            }), 400
            
        game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
        target_library = db.session.execute(select(Library).filter_by(uuid=target_library_uuid)).scalars().first()
        
        if not game or not target_library:
            return jsonify({
                'success': False,
                'message': 'Game or target library not found'
            }), 404
            
        # Update the game's library
        game.library_uuid = target_library_uuid
        db.session.commit()
        
        log_system_event(f"Game {game.name} moved to library {target_library.name} by user {current_user.name}", event_type='game', event_level='information')
        
        return jsonify({'success': True, 'message': f'Game moved to {target_library.name}'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@apis_bp.route('/get_next_custom_igdb_id', methods=['GET'])
@login_required
def get_next_custom_igdb_id():
    """Return the next available custom IGDB ID (above 2000000420)"""
    try:
        # Find the highest custom IGDB ID currently in use
        base_custom_id = 2000000420
        highest_custom_id = db.session.execute(
            select(func.max(Game.igdb_id)).filter(Game.igdb_id >= base_custom_id)
        ).scalar()
        
        # If no custom IDs exist yet, return the base value, otherwise return the next available ID
        next_id = base_custom_id if highest_custom_id is None else highest_custom_id + 1
        return jsonify({'next_id': next_id})
    except Exception as e:
        print(f"Error getting next custom IGDB ID: {e}")
        return jsonify({'error': str(e)}), 500


@apis_bp.route('/games/<game_uuid>/freshness', methods=['GET'])
@login_required
def game_freshness_get(game_uuid):
    """Return cached freshness snapshot for a game."""
    from gametheca.utils.freshness import freshness_public_view

    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game:
        return jsonify({'error': 'Game not found'}), 404
    return jsonify(freshness_public_view(game))


@apis_bp.route('/games/<game_uuid>/freshness/check', methods=['POST'])
@login_required
def game_freshness_check(game_uuid):
    """On-demand local vs store freshness check."""
    from gametheca.utils.freshness import check_and_store_freshness

    game = db.session.execute(
        select(Game).filter_by(uuid=game_uuid)
    ).scalars().first()
    if not game:
        return jsonify({'error': 'Game not found'}), 404

    try:
        # Eager-load relationships used by local/update hints
        _ = list(game.updates or [])
        _ = list(game.extras or [])
        _ = list(game.urls or [])
        result = check_and_store_freshness(game, commit=True, db_session=db.session)
        log_system_event(
            f"Freshness check for {game.name}: {result.get('status')}",
            event_type='game',
            event_level='information',
        )
        return jsonify(result)
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': str(exc)}), 500


@apis_bp.route('/admin/freshness/refresh', methods=['POST'])
@login_required
def admin_freshness_refresh():
    """Bulk refresh freshness for library badges (admin).

    Body JSON:
      limit (int, default 25, max 500) — use a large value for whole-library runs
      only_stale (bool, default true) — skip games checked in the last 24h
      library_uuid (str, optional) — restrict to one library
      entire_library (bool) — when true with a library_uuid, ignore limit cap soft-stop
    """
    from gametheca.utils.freshness import check_and_store_freshness

    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({'error': 'Admin required'}), 403

    data = request.get_json(silent=True) or {}
    entire = bool(data.get('entire_library') or data.get('all'))
    limit_raw = data.get('limit')
    if entire and limit_raw is None:
        limit = 500
    else:
        limit = min(int(limit_raw or 25), 500)
    only_stale = bool(data.get('only_stale', True))
    library_uuid = (data.get('library_uuid') or '').strip() or None

    query = select(Game).order_by(Game.name.asc())
    if library_uuid:
        query = query.filter(Game.library_uuid == library_uuid)
    # Over-fetch when skipping stale so we still fill the batch
    fetch_n = limit * 5 if only_stale else limit
    games = db.session.execute(query.limit(fetch_n)).scalars().all()
    updated = []
    errors = []
    skipped = 0
    now = datetime.now(timezone.utc)
    for game in games:
        if len(updated) >= limit:
            break
        if only_stale and game.freshness_checked_at and game.freshness_status:
            checked = game.freshness_checked_at
            if checked.tzinfo is None:
                checked = checked.replace(tzinfo=timezone.utc)
            if (now - checked).total_seconds() < 86400:
                skipped += 1
                continue
        try:
            _ = list(game.updates or [])
            _ = list(game.extras or [])
            _ = list(game.urls or [])
            public = check_and_store_freshness(game, commit=False)
            updated.append({'uuid': game.uuid, 'name': game.name, 'status': public.get('status')})
        except Exception as exc:
            errors.append({'uuid': game.uuid, 'name': game.name, 'error': str(exc)})
    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': str(exc)}), 500

    return jsonify({
        'updated': updated,
        'errors': errors,
        'count': len(updated),
        'skipped_fresh': skipped,
        'library_uuid': library_uuid,
        'limit': limit,
    })
