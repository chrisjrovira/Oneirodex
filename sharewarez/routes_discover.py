from flask import Blueprint, render_template, url_for
from flask_login import current_user, login_required
from sqlalchemy import func, select

from sharewarez import cache, db
from sharewarez.models import (
    DiscoverySection,
    Game,
    GlobalSettings,
    Image,
    Library,
    user_favorites,
)
from sharewarez.utils.functions import format_size
from sharewarez.utils.local_metadata import has_local_images, has_local_metadata
from sharewarez.utils.processors import get_global_settings, get_loc
from sharewarez.utils.secondary_scrapers import game_card_flags
from sharewarez.utils.cover_url import resolve_cover_url

discover_bp = Blueprint('discover', __name__)


def serialize_discover_game(
    game,
    cover_image,
    *,
    is_favorite,
    has_local_override,
):
    cover_url = resolve_cover_url(cover_image)

    return {
        'id': game.id,
        'uuid': game.uuid,
        'name': game.name,
        'cover_url': cover_url,
        'summary': game.summary,
        'url': game.url,
        'size': format_size(game.size),
        'genres': [genre.name for genre in game.genres],
        'is_favorite': is_favorite,
        'has_local_override': has_local_override,
        'first_release_date': (
            game.first_release_date.strftime('%Y-%m-%d')
            if game.first_release_date
            else 'Not available'
        ),
        **game_card_flags(game),
    }


@discover_bp.context_processor
@cache.cached(timeout=500, key_prefix='global_settings')
def inject_settings():
    """Context processor to inject global settings into templates"""
    return get_global_settings()


@discover_bp.route('/discover')
@login_required
def discover():
    page_loc = get_loc("discover")

    # Get visible sections in correct order
    visible_sections = db.session.execute(select(DiscoverySection).filter_by(is_visible=True).order_by(DiscoverySection.display_order)).scalars().all()
    settings = db.session.execute(select(GlobalSettings)).scalar_one_or_none()
    favorite_game_uuids = {game.uuid for game in current_user.favorites}

    def fetch_game_details(games_query, limit=8):
        # Handle both query objects and lists
        if hasattr(games_query, 'limit'):
            games = games_query.limit(limit).all()
        else:
            games = games_query[:limit] if limit else games_query

        game_details = []
        for game in games:
            # If game is a tuple (from group by query), get the Game object
            if isinstance(game, tuple):
                game = game[0]
                
            cover_image = db.session.execute(
                select(Image).filter_by(
                    game_uuid=game.uuid,
                    image_type='cover',
                )
            ).scalars().first()
            has_local_override = False
            if settings:
                has_local_override = (
                    settings.use_local_metadata
                    and has_local_metadata(
                        game.full_disk_path,
                        settings.local_metadata_filename or 'gametheca.json',
                    )
                ) or (
                    settings.use_local_images
                    and has_local_images(game.full_disk_path)
                )
            game_details.append(
                serialize_discover_game(
                    game,
                    cover_image,
                    is_favorite=game.uuid in favorite_game_uuids,
                    has_local_override=has_local_override,
                )
            )
        return game_details

    # Create a dictionary to store section data
    section_data = {}
    discover_sections = []

    for section in visible_sections:
        if section.identifier == 'libraries':
            libraries = db.session.execute(select(Library)).scalars().all()
            section_data['libraries'] = [{
                'uuid': lib.uuid,
                'name': lib.name,
                'image_url': lib.image_url
            } for lib in libraries]
        elif section.identifier == 'latest_games':
            section_data['latest_games'] = fetch_game_details(db.session.execute(select(Game).order_by(Game.date_created.desc())).scalars().all())
        elif section.identifier == 'most_downloaded':
            section_data['most_downloaded'] = fetch_game_details(db.session.execute(select(Game).filter(Game.times_downloaded > 0).order_by(Game.times_downloaded.desc())).scalars().all())
        elif section.identifier == 'highest_rated':
            section_data['highest_rated'] = fetch_game_details(db.session.execute(select(Game).filter(Game.rating.isnot(None)).order_by(Game.rating.desc())).scalars().all())
        elif section.identifier == 'last_updated':
            section_data['last_updated'] = fetch_game_details(db.session.execute(select(Game).filter(Game.last_updated.isnot(None)).order_by(Game.last_updated.desc())).scalars().all())
        elif section.identifier == 'most_favorited':
            most_favorited = db.session.execute(
                select(Game, func.count(user_favorites.c.user_id).label('favorite_count'))
                .join(user_favorites)
                .group_by(Game)
                .order_by(func.count(user_favorites.c.user_id).desc())
            ).all()
            section_data['most_favorited'] = fetch_game_details([game[0] for game in most_favorited])

        if section.identifier != 'libraries':
            discover_sections.append({
                'identifier': section.identifier,
                'title': section.name,
                'games': section_data.get(section.identifier, []),
            })

    return render_template('games/discover.html',
                           visible_sections=visible_sections,
                           section_data=section_data,
                           discover_sections=discover_sections,
                           loc=page_loc)
