# /sharewarez/routes_apis/user.py
from flask import jsonify, request, url_for
from flask_login import login_required, current_user
from sharewarez import db
from sharewarez.models import (
    Game,
    GlobalSettings,
    Image,
    User,
    user_game_status,
    get_status_info,
)
from sharewarez.utils.local_metadata import has_local_images, has_local_metadata
from sharewarez.utils.secondary_scrapers import game_card_flags
from sharewarez.utils.cover_url import resolve_cover_url
from sqlalchemy import func, select, and_, delete
from datetime import datetime, timezone
from . import apis_bp

@apis_bp.route('/current_user_role', methods=['GET'])
@login_required
def get_current_user_role():
    return jsonify({'role': current_user.role}), 200

@apis_bp.route('/check_username', methods=['POST'])
@login_required
def check_username():
    print(F"Route: /api/check_username - {current_user.name} - {current_user.role}")    
    data = request.get_json()
    username = data.get('username')
    if not username:
        print(f"Check username: Missing username")
        return jsonify({"error": "Missing username parameter"}), 400
    print(f"Checking username: {username}")
    existing_user = db.session.execute(select(User).filter(func.lower(User.name) == func.lower(username))).scalars().first()
    return jsonify({"exists": existing_user is not None})

@apis_bp.route('/check_favorite/<game_uuid>')
@login_required
def check_favorite(game_uuid):
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game:
        return jsonify({'error': 'Game not found'}), 404
    is_favorite = game in current_user.favorites
    return jsonify({'is_favorite': is_favorite})

@apis_bp.route('/toggle_favorite/<game_uuid>', methods=['POST'])
@login_required
def toggle_favorite(game_uuid):
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game:
        return jsonify({'error': 'Game not found'}), 404
    
    if game in current_user.favorites:
        current_user.favorites.remove(game)
        is_favorite = False
    else:
        current_user.favorites.append(game)
        is_favorite = True
    
    db.session.commit()
    return jsonify({'success': True, 'is_favorite': is_favorite})


@apis_bp.route('/favorites', methods=['GET'])
@login_required
def favorites():
    games = current_user.favorites
    game_uuids = [game.uuid for game in games]
    user_statuses = {}
    if game_uuids:
        status_results = db.session.execute(
            select(user_game_status.c.game_uuid, user_game_status.c.status).where(
                and_(
                    user_game_status.c.user_id == current_user.id,
                    user_game_status.c.game_uuid.in_(game_uuids),
                )
            )
        ).all()
        user_statuses = {row[0]: row[1] for row in status_results}

    settings = db.session.execute(select(GlobalSettings)).scalar_one_or_none()
    game_data = []
    for game in games:
        cover_image = db.session.execute(
            select(Image).filter_by(game_uuid=game.uuid, image_type='cover')
        ).scalars().first()
        cover_url = resolve_cover_url(cover_image)

        has_local_override = False
        if settings:
            has_local_override = (
                settings.use_local_metadata
                and has_local_metadata(
                    game.full_disk_path,
                    settings.local_metadata_filename or 'sharewarez.json',
                )
            ) or (
                settings.use_local_images
                and has_local_images(game.full_disk_path)
            )

        game_data.append({
            'uuid': game.uuid,
            'name': game.name,
            'cover_url': cover_url,
            'is_favorite': True,
            'has_local_override': has_local_override,
            **game_card_flags(game),
            'genres': [genre.name for genre in game.genres],
            'user_status': user_statuses.get(game.uuid),
        })

    return jsonify({'games': game_data})


@apis_bp.route('/get_game_status/<game_uuid>', methods=['GET'])
@login_required
def get_game_status(game_uuid):
    """Get the current user's completion status for a game"""
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game:
        return jsonify({'error': 'Game not found'}), 404

    # Query the status
    status_row = db.session.execute(
        select(user_game_status.c.status).where(
            and_(
                user_game_status.c.user_id == current_user.id,
                user_game_status.c.game_uuid == game_uuid
            )
        )
    ).first()

    status = status_row[0] if status_row else None
    status_info = get_status_info(status)

    return jsonify({
        'success': True,
        'status': status,
        'status_info': status_info
    })

@apis_bp.route('/set_game_status/<game_uuid>', methods=['POST'])
@login_required
def set_game_status(game_uuid):
    """Set or update the user's completion status for a game"""
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game:
        return jsonify({'error': 'Game not found'}), 404

    data = request.get_json()
    status = data.get('status', '').strip()

    # Validate status
    valid_statuses = ['unplayed', 'unfinished', 'beaten', 'completed', 'null', '']
    if status not in valid_statuses:
        return jsonify({'error': 'Invalid status value'}), 400

    # If status is empty, remove the status record
    if not status:
        db.session.execute(
            delete(user_game_status).where(
                and_(
                    user_game_status.c.user_id == current_user.id,
                    user_game_status.c.game_uuid == game_uuid
                )
            )
        )
        db.session.commit()
        return jsonify({
            'success': True,
            'status': None,
            'status_info': get_status_info(None),
            'message': 'Status cleared'
        })

    # Check if status already exists
    existing = db.session.execute(
        select(user_game_status).where(
            and_(
                user_game_status.c.user_id == current_user.id,
                user_game_status.c.game_uuid == game_uuid
            )
        )
    ).first()

    if existing:
        # Update existing status
        db.session.execute(
            user_game_status.update().where(
                and_(
                    user_game_status.c.user_id == current_user.id,
                    user_game_status.c.game_uuid == game_uuid
                )
            ).values(
                status=status,
                updated_at=datetime.now(timezone.utc)
            )
        )
    else:
        # Insert new status
        db.session.execute(
            user_game_status.insert().values(
                user_id=current_user.id,
                game_uuid=game_uuid,
                status=status,
                updated_at=datetime.now(timezone.utc)
            )
        )

    db.session.commit()
    status_info = get_status_info(status)

    return jsonify({
        'success': True,
        'status': status,
        'status_info': status_info,
        'message': f'Status updated to {status_info["label"]}'
    })
