"""VR / headset browse APIs (catalog + detail, no downloads)."""

from __future__ import annotations

from flask import current_app, jsonify, request
from flask_login import current_user, login_required
from sqlalchemy import exists, func, select

from gametheca import db
from gametheca.models import Game, Image, PlayerPerspective, game_player_perspective_association
from gametheca.utils.api_response import api_error
from gametheca.utils.cover_url import resolve_cover_url
from gametheca.utils.functions import format_size
from gametheca.utils.library_acl import apply_game_access_filters, user_can_access_game
from gametheca.utils.secondary_scrapers import VR_PERSPECTIVE_NAME, game_indicates_vr

from . import apis_bp

_VR_PERSPECTIVE_NAMES = (
    VR_PERSPECTIVE_NAME.lower(),
    'vr',
    'vr / virtual reality',
)


def _vr_games_query():
    """Games tagged with a Virtual Reality player perspective — not the whole library.

    Uses EXISTS (not DISTINCT on Game) so Postgres JSON columns on ``games``
    do not break equality for DISTINCT.
    """
    assoc = game_player_perspective_association
    vr_link = (
        select(1)
        .select_from(
            assoc.join(
                PlayerPerspective,
                PlayerPerspective.id == assoc.c.player_perspective_id,
            )
        )
        .where(
            assoc.c.game_id == Game.id,
            func.lower(PlayerPerspective.name).in_(_VR_PERSPECTIVE_NAMES),
        )
    )
    return select(Game).where(exists(vr_link))


def _vr_enabled() -> bool:
    return str(current_app.config.get('ENABLE_VR_BROWSE', '')).lower() in (
        '1', 'true', 'yes', 'on',
    )


def _cover_url_for_uuid(game_uuid: str) -> str | None:
    cover = db.session.execute(
        select(Image).filter_by(game_uuid=game_uuid, image_type='cover').limit(1),
    ).scalars().first()
    if not cover:
        cover = db.session.execute(
            select(Image).filter(Image.game_uuid == game_uuid, Image.url.ilike('%cover%')).limit(1),
        ).scalars().first()
    return resolve_cover_url(cover)


@apis_bp.route('/vr/catalog', methods=['GET'])
@login_required
def vr_catalog():
    if not _vr_enabled():
        return api_error('VR browse is disabled', code='forbidden')
    try:
        page = max(1, int(request.args.get('page') or 1))
        per_page = min(100, max(1, int(request.args.get('per_page') or 24)))
    except (TypeError, ValueError):
        return api_error('Invalid pagination', code='bad_request')

    query = apply_game_access_filters(_vr_games_query(), current_user)
    query = query.order_by(Game.name.asc())

    total = db.session.execute(
        select(func.count()).select_from(query.order_by(None).subquery()),
    ).scalar() or 0
    pages = max(1, (total + per_page - 1) // per_page)
    rows = db.session.execute(
        query.offset((page - 1) * per_page).limit(per_page),
    ).scalars().all()

    return jsonify({
        'page': page,
        'pages': pages,
        'total': total,
        'games': [
            {
                'uuid': g.uuid,
                'name': g.name,
                'cover_url': _cover_url_for_uuid(g.uuid),
            }
            for g in rows
        ],
    })


@apis_bp.route('/vr/games/<game_uuid>', methods=['GET'])
@login_required
def vr_game_detail(game_uuid: str):
    if not _vr_enabled():
        return api_error('VR browse is disabled', code='forbidden')
    game = db.session.execute(select(Game).filter_by(uuid=game_uuid)).scalars().first()
    if not game:
        return api_error('Game not found', code='not_found')
    if not user_can_access_game(current_user, game):
        return api_error('Forbidden', code='forbidden')
    # Detail matches the catalog: non-VR titles are not part of this hub.
    if not game_indicates_vr(game):
        return api_error('Game not found', code='not_found')
    size = format_size(game.size) if game.size is not None else None
    return jsonify({
        'uuid': game.uuid,
        'name': game.name,
        'cover_url': _cover_url_for_uuid(game.uuid),
        'summary': game.summary,
        'size': size,
    })
