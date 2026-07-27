"""Collections and announcements APIs."""

from flask import jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import func, select

from gametheca import db
from gametheca.models import Announcement, Game, GameCollection, GameCollectionItem
from gametheca.utils.library_acl import user_can_access_game

from . import apis_bp


def _can_edit_collection(collection: GameCollection) -> bool:
    return (
        collection.owner_user_id == current_user.id
        or current_user.role == 'admin'
    )


def _collection_payload(collection: GameCollection, *, include_items=False, item_count=None):
    data = collection.to_dict(include_items=include_items)
    data['can_edit'] = _can_edit_collection(collection)
    if item_count is not None:
        data['item_count'] = int(item_count)
    elif include_items:
        data['item_count'] = len(data.get('items') or [])
    return data


def _item_counts_by_collection_id(collection_ids: list[int]) -> dict[int, int]:
    if not collection_ids:
        return {}
    rows = db.session.execute(
        select(
            GameCollectionItem.collection_id,
            func.count(GameCollectionItem.id),
        )
        .where(GameCollectionItem.collection_id.in_(collection_ids))
        .group_by(GameCollectionItem.collection_id)
    ).all()
    return {collection_id: int(count) for collection_id, count in rows}


@apis_bp.route('/collections', methods=['GET'])
@login_required
def list_collections():
    query = select(GameCollection).order_by(GameCollection.created_at.desc())
    rows = db.session.execute(query).scalars().all()
    visible = [
        c for c in rows
        if c.is_public or c.owner_user_id == current_user.id or current_user.role == 'admin'
    ]
    counts = _item_counts_by_collection_id([c.id for c in visible])
    return jsonify({
        'collections': [
            _collection_payload(c, item_count=counts.get(c.id, 0))
            for c in visible
        ],
    })


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
    return jsonify(_collection_payload(collection, item_count=0)), 201


def _is_collection_owner_or_admin(collection: GameCollection) -> bool:
    return collection.owner_user_id == current_user.id or current_user.role == 'admin'


def _filtered_collection_payload(collection: GameCollection):
    """Build detail payload; non-owner viewers only see accessible games."""
    payload = _collection_payload(collection, include_items=True)
    if _is_collection_owner_or_admin(collection):
        return payload
    filtered = [
        item.to_dict()
        for item in collection.items
        if user_can_access_game(current_user, item.game)
    ]
    payload['items'] = filtered
    payload['item_count'] = len(filtered)
    return payload


@apis_bp.route('/collections/<collection_uuid>', methods=['GET'])
@login_required
def get_collection(collection_uuid: str):
    collection = db.session.execute(
        select(GameCollection).filter_by(uuid=collection_uuid)
    ).scalars().first()
    if not collection:
        return jsonify({'error': 'Not found'}), 404
    if not collection.is_public and not _is_collection_owner_or_admin(collection):
        return jsonify({'error': 'Forbidden'}), 403
    return jsonify(_filtered_collection_payload(collection))


@apis_bp.route('/collections/<collection_uuid>', methods=['PATCH'])
@login_required
def update_collection(collection_uuid: str):
    collection = db.session.execute(
        select(GameCollection).filter_by(uuid=collection_uuid)
    ).scalars().first()
    if not collection:
        return jsonify({'error': 'Not found'}), 404
    if not _can_edit_collection(collection):
        return jsonify({'error': 'Forbidden'}), 403
    if collection.is_system:
        return jsonify({'error': 'System collections cannot be edited'}), 400

    data = request.get_json(silent=True) or {}
    if 'name' in data:
        name = (data.get('name') or '').strip()
        if not name:
            return jsonify({'error': 'name required'}), 400
        collection.name = name[:120]
    if 'description' in data:
        raw = data.get('description')
        if raw is None:
            collection.description = None
        else:
            collection.description = (str(raw).strip()[:4000] or None)
    if 'is_public' in data:
        collection.is_public = bool(data.get('is_public'))

    db.session.commit()
    return jsonify(_collection_payload(collection, include_items=True))


@apis_bp.route('/collections/<collection_uuid>', methods=['DELETE'])
@login_required
def delete_collection(collection_uuid: str):
    collection = db.session.execute(
        select(GameCollection).filter_by(uuid=collection_uuid)
    ).scalars().first()
    if not collection:
        return jsonify({'error': 'Not found'}), 404
    if not _can_edit_collection(collection):
        return jsonify({'error': 'Forbidden'}), 403
    if collection.is_system:
        return jsonify({'error': 'System collections cannot be deleted'}), 400
    uuid = collection.uuid
    db.session.delete(collection)
    db.session.commit()
    return jsonify({'ok': True, 'uuid': uuid})


@apis_bp.route('/collections/<collection_uuid>/items', methods=['POST'])
@login_required
def add_collection_item(collection_uuid: str):
    collection = db.session.execute(
        select(GameCollection).filter_by(uuid=collection_uuid)
    ).scalars().first()
    if not collection:
        return jsonify({'error': 'Not found'}), 404
    if not _can_edit_collection(collection):
        return jsonify({'error': 'Forbidden'}), 403
    data = request.get_json(silent=True) or {}
    game_uuid = (data.get('game_uuid') or '').strip()
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game:
        return jsonify({'error': 'Game not found'}), 404
    if not user_can_access_game(current_user, game):
        return jsonify({'error': 'Game not accessible'}), 403
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


@apis_bp.route('/collections/<collection_uuid>/items/<game_uuid>', methods=['DELETE'])
@login_required
def remove_collection_item(collection_uuid: str, game_uuid: str):
    collection = db.session.execute(
        select(GameCollection).filter_by(uuid=collection_uuid)
    ).scalars().first()
    if not collection:
        return jsonify({'error': 'Not found'}), 404
    if not _can_edit_collection(collection):
        return jsonify({'error': 'Forbidden'}), 403
    item = db.session.execute(
        select(GameCollectionItem).filter_by(
            collection_id=collection.id,
            game_uuid=game_uuid,
        )
    ).scalars().first()
    if not item:
        return jsonify({'error': 'Not found'}), 404
    db.session.delete(item)
    db.session.commit()
    return jsonify({'ok': True, 'game_uuid': game_uuid})


@apis_bp.route('/collections/<collection_uuid>/items/order', methods=['PUT'])
@login_required
def reorder_collection_items(collection_uuid: str):
    collection = db.session.execute(
        select(GameCollection).filter_by(uuid=collection_uuid)
    ).scalars().first()
    if not collection:
        return jsonify({'error': 'Not found'}), 404
    if not _can_edit_collection(collection):
        return jsonify({'error': 'Forbidden'}), 403

    data = request.get_json(silent=True) or {}
    game_uuids = data.get('game_uuids')
    if not isinstance(game_uuids, list):
        return jsonify({'error': 'game_uuids required'}), 400
    normalized = [str(uuid).strip() for uuid in game_uuids if uuid is not None]
    if len(normalized) != len(set(normalized)):
        return jsonify({'error': 'game_uuids must list each collection item exactly once'}), 400
    current_uuids = {item.game_uuid for item in collection.items}
    if set(normalized) != current_uuids:
        return jsonify({'error': 'game_uuids must list each collection item exactly once'}), 400

    by_uuid = {item.game_uuid: item for item in collection.items}
    for position, game_uuid in enumerate(normalized):
        by_uuid[game_uuid].position = position
    db.session.commit()
    db.session.refresh(collection)
    return jsonify(_collection_payload(collection, include_items=True))


@apis_bp.route('/announcements', methods=['GET'])
@login_required
def list_announcements():
    include_drafts = (
        request.args.get('include_drafts') == '1'
        and current_user.role == 'admin'
    )
    query = select(Announcement).order_by(Announcement.created_at.desc()).limit(50)
    if not include_drafts:
        query = query.filter_by(published=True)
    rows = db.session.execute(query).scalars().all()
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


@apis_bp.route('/news/gaming', methods=['GET'])
@login_required
def gaming_news_feed():
    """Best-effort top gaming headlines from public RSS feeds."""
    from gametheca.utils.gaming_news import fetch_gaming_headlines

    limit = request.args.get('limit', 12, type=int)
    items = fetch_gaming_headlines(limit=max(1, min(limit or 12, 30)))
    return jsonify({'items': items})


@apis_bp.route('/news/free-games', methods=['GET'])
@login_required
def free_games_feed():
    """Active free / giveaway offers (Wave 18)."""
    from flask import current_app

    from gametheca.utils.free_games import connected_stores_for_user, list_active_offers

    if not bool(current_app.config.get('ENABLE_FREE_GAMES', True)):
        return jsonify({'items': [], 'enabled': False, 'connected_stores': []})

    store = (request.args.get('store') or '').strip() or None
    limit = request.args.get('limit', 40, type=int)
    connected = connected_stores_for_user(current_user.id)
    items = list_active_offers(
        store=store,
        limit=max(1, min(limit or 40, 100)),
        connected_stores=connected,
    )
    return jsonify({
        'items': items,
        'enabled': True,
        'connected_stores': sorted(connected),
    })


@apis_bp.route('/news/free-games/<int:offer_id>/claim-assist', methods=['POST'])
@login_required
def free_games_claim_assist(offer_id: int):
    """
    Avenue B: when the store is connected, register the title + Steam live sync.
    Does not silently redeem DRM — member still uses Claim / Open in app (avenue A).
    """
    from flask import current_app
    from sqlalchemy import select

    from gametheca import db
    from gametheca.models import FreeGameOffer
    from gametheca.utils.free_games import claim_assist_for_user

    if not bool(current_app.config.get('ENABLE_FREE_GAMES', True)):
        return jsonify({'error': 'Free games disabled'}), 403

    offer = db.session.execute(
        select(FreeGameOffer).where(FreeGameOffer.id == offer_id)
    ).scalars().first()
    if offer is None:
        return jsonify({'error': 'Offer not found'}), 404

    result = claim_assist_for_user(current_user.id, offer)
    status = 200 if result.get('ok') else 400
    return jsonify(result), status
