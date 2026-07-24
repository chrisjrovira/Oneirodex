"""Collections and announcements APIs."""

from flask import jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import select

from gametheca import db
from gametheca.models import Announcement, Game, GameCollection, GameCollectionItem

from . import apis_bp


@apis_bp.route('/collections', methods=['GET'])
@login_required
def list_collections():
    query = select(GameCollection).order_by(GameCollection.created_at.desc())
    rows = db.session.execute(query).scalars().all()
    visible = [
        c for c in rows
        if c.is_public or c.owner_user_id == current_user.id or current_user.role == 'admin'
    ]
    return jsonify({'collections': [c.to_dict() for c in visible]})


@apis_bp.route('/collections', methods=['POST'])
@login_required
def create_collection():
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'name required'}), 400
    collection = GameCollection(
        name=name[:120],
        description=(data.get('description') or '')[:4000] or None,
        owner_user_id=current_user.id,
        is_public=bool(data.get('is_public', True)),
        is_system=False,
    )
    db.session.add(collection)
    db.session.commit()
    return jsonify(collection.to_dict()), 201


@apis_bp.route('/collections/<collection_uuid>', methods=['GET'])
@login_required
def get_collection(collection_uuid: str):
    collection = db.session.execute(
        select(GameCollection).filter_by(uuid=collection_uuid)
    ).scalars().first()
    if not collection:
        return jsonify({'error': 'Not found'}), 404
    if not collection.is_public and collection.owner_user_id != current_user.id and current_user.role != 'admin':
        return jsonify({'error': 'Forbidden'}), 403
    return jsonify(collection.to_dict(include_items=True))


@apis_bp.route('/collections/<collection_uuid>/items', methods=['POST'])
@login_required
def add_collection_item(collection_uuid: str):
    collection = db.session.execute(
        select(GameCollection).filter_by(uuid=collection_uuid)
    ).scalars().first()
    if not collection:
        return jsonify({'error': 'Not found'}), 404
    if collection.owner_user_id != current_user.id and current_user.role != 'admin':
        return jsonify({'error': 'Forbidden'}), 403
    data = request.get_json(silent=True) or {}
    game_uuid = (data.get('game_uuid') or '').strip()
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game:
        return jsonify({'error': 'Game not found'}), 404
    existing = db.session.execute(
        select(GameCollectionItem).filter_by(collection_id=collection.id, game_uuid=game_uuid)
    ).scalars().first()
    if existing:
        return jsonify(existing.to_dict())
    position = len(collection.items)
    item = GameCollectionItem(collection_id=collection.id, game_uuid=game_uuid, position=position)
    db.session.add(item)
    db.session.commit()
    return jsonify(item.to_dict()), 201


@apis_bp.route('/announcements', methods=['GET'])
@login_required
def list_announcements():
    rows = db.session.execute(
        select(Announcement)
        .filter_by(published=True)
        .order_by(Announcement.created_at.desc())
        .limit(50)
    ).scalars().all()
    return jsonify({'announcements': [a.to_dict() for a in rows]})


@apis_bp.route('/announcements', methods=['POST'])
@login_required
def create_announcement():
    if current_user.role != 'admin':
        return jsonify({'error': 'Admin required'}), 403
    data = request.get_json(silent=True) or {}
    title = (data.get('title') or '').strip()
    body = (data.get('body') or '').strip()
    if not title or not body:
        return jsonify({'error': 'title and body required'}), 400
    row = Announcement(
        title=title[:200],
        body=body[:20000],
        published=bool(data.get('published', True)),
        author_user_id=current_user.id,
    )
    db.session.add(row)
    db.session.commit()
    return jsonify(row.to_dict()), 201
