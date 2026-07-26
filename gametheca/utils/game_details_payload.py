"""Shared game-details payload for SPA API and (legacy) Jinja."""

from __future__ import annotations

from flask import url_for
from sqlalchemy import and_, select

from gametheca import db
from gametheca.models import (
    GameExtra,
    GameUpdate,
    UserGameProgress,
    get_status_info,
    user_game_status,
)
from gametheca.utils.client_lifecycle import load_lifecycle_map
from gametheca.utils.cover_url import resolve_cover_url
from gametheca.utils.functions import format_size, get_url_icon, sanitize_string_input
from gametheca.utils.lifecycle import web_lifecycle_fields
from gametheca.utils.play_url import browse_play_fields, library_platform_key
from gametheca.utils.secondary_scrapers import game_card_flags


def build_game_details_payload(game, user) -> dict:
    """JSON-safe details payload (no disk paths)."""
    user_id = getattr(user, 'id', None) if user is not None else None
    updates = db.session.execute(
        select(GameUpdate).filter_by(game_uuid=game.uuid)
    ).scalars().all()
    extras = db.session.execute(
        select(GameExtra).filter_by(game_uuid=game.uuid)
    ).scalars().all()
    lifecycle_map = load_lifecycle_map(user_id)

    cover_image = None
    for img in game.images.all():
        if getattr(img, 'image_type', None) == 'cover':
            cover_image = img
            break
    if cover_image is None and getattr(game, 'cover', None) is not None:
        cover_image = game.cover

    platform_key = library_platform_key(game)
    platform_label = None
    library = getattr(game, 'library', None)
    platform = getattr(library, 'platform', None) if library is not None else None
    if platform is not None:
        platform_label = getattr(platform, 'value', None) or platform_key

    steam_app_id = getattr(game, 'steam_app_id', None)
    steam_url = getattr(game, 'steam_url', None) or None
    if steam_app_id and not steam_url:
        steam_url = f'https://store.steampowered.com/app/{int(steam_app_id)}'

    screenshots = []
    for img in game.images.all():
        if getattr(img, 'image_type', None) != 'screenshot':
            continue
        raw = getattr(img, 'url', None) or ''
        if raw.startswith('http') or raw.startswith('/'):
            screenshots.append(raw)
        else:
            screenshots.append(url_for('static', filename=f'library/images/{raw}'))

    is_favorite = False
    user_status = None
    status_icon = 'fa-circle'
    status_label = 'No Status'
    if user_id:
        is_favorite = user_id in [u.id for u in game.favorited_by]
        status_row = db.session.execute(
            select(user_game_status.c.status).where(
                and_(
                    user_game_status.c.user_id == user_id,
                    user_game_status.c.game_uuid == game.uuid,
                )
            )
        ).first()
        if status_row:
            user_status = status_row[0]
        status_info = get_status_info(user_status)
        status_icon = status_info['icon']
        status_label = status_info['label']

    playtime = {
        'total_seconds': 0,
        'session_count': 0,
        'last_played_at': None,
    }
    if user_id:
        progress = db.session.execute(
            select(UserGameProgress).filter_by(user_id=user_id, game_uuid=game.uuid)
        ).scalars().first()
        if progress:
            playtime = {
                'total_seconds': int(progress.total_seconds or 0),
                'session_count': int(progress.session_count or 0),
                'last_played_at': (
                    progress.last_played_at.isoformat()
                    if progress.last_played_at
                    else None
                ),
            }

    video_urls = getattr(game, 'video_urls', None) or []
    if not isinstance(video_urls, list):
        video_urls = []

    return {
        'id': game.id,
        'uuid': game.uuid,
        'igdb_id': game.igdb_id,
        'name': game.name,
        'summary': game.summary,
        'storyline': game.storyline,
        'cover_url': resolve_cover_url(cover_image),
        'aggregated_rating': game.aggregated_rating,
        'aggregated_rating_count': game.aggregated_rating_count,
        'rating': game.rating,
        'rating_count': game.rating_count,
        'total_rating': game.total_rating,
        'total_rating_count': game.total_rating_count,
        'first_release_date': (
            game.first_release_date.isoformat() if game.first_release_date else None
        ),
        'date_identified': (
            game.date_identified.isoformat() if game.date_identified else None
        ),
        'last_updated': (
            game.last_updated.isoformat() if game.last_updated else None
        ),
        'slug': game.slug,
        'status': game.status.value if game.status else None,
        'category': game.category.value if game.category else None,
        'url_igdb': game.url_igdb,
        'url': game.url,
        'video_urls': video_urls,
        'genres': [genre.name for genre in game.genres],
        'game_modes': [mode.name for mode in game.game_modes],
        'themes': [theme.name for theme in game.themes],
        'platforms': [platform.name for platform in game.platforms],
        'player_perspectives': [p.name for p in game.player_perspectives],
        'developer': game.developer.name if game.developer else None,
        'publisher': game.publisher.name if game.publisher else None,
        'size': format_size(game.size),
        'size_bytes': int(game.size or 0),
        'times_downloaded': game.times_downloaded,
        'steam_app_id': steam_app_id,
        'steam_url': steam_url if steam_url and steam_url != 'Not available' else None,
        'hltb_id': game.hltb_id,
        'hltb_main_story': game.hltb_main_story,
        'hltb_main_extra': game.hltb_main_extra,
        'hltb_completionist': game.hltb_completionist,
        'hltb_all_styles': game.hltb_all_styles,
        'freshness_status': getattr(game, 'freshness_status', None),
        'freshness_confidence': getattr(game, 'freshness_confidence', None),
        'library_uuid': game.library_uuid,
        'library_platform': platform_key,
        'library_platform_label': platform_label,
        'updates_count': len(updates),
        'extras_count': len(extras),
        'nfo_content': (
            sanitize_string_input(game.nfo_content, 10000) if game.nfo_content else None
        ),
        'urls': [
            {
                'type': url.url_type,
                'url': url.url,
                'icon': get_url_icon(url.url_type, url.url),
            }
            for url in game.urls
        ],
        'screenshots': screenshots,
        'is_favorite': is_favorite,
        'user_status': user_status,
        'status_icon': status_icon,
        'status_label': status_label,
        'playtime': playtime,
        'is_admin': bool(getattr(user, 'role', None) == 'admin'),
        **browse_play_fields(game),
        **game_card_flags(game),
        **web_lifecycle_fields(
            game,
            updates_count=len(updates),
            user_id=user_id,
            client_state=lifecycle_map.get(game.uuid),
        ),
    }
