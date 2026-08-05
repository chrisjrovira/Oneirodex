from flask import Blueprint
from flask_login import login_required
from gametheca.utils.member_spa import render_member_spa
from sqlalchemy import func, select

from gametheca import cache, db
from gametheca.models import (
    DiscoverySection,
    Game,
    GlobalSettings,
    Image,
    Library,
    user_favorites,
)
from gametheca.utils.functions import format_size
from gametheca.utils.local_metadata import has_local_images, has_local_metadata
from gametheca.utils.processors import get_global_settings
from gametheca.utils.secondary_scrapers import game_card_flags
from gametheca.utils.store_ownership import get_matched_owned_game_uuids, ownership_flags
from gametheca.utils.cover_url import resolve_game_cover_url
from gametheca.utils.library_acl import apply_game_access_filters, filter_libraries
from gametheca.utils.client_lifecycle import load_lifecycle_map
from gametheca.utils.discovery_zones import resolve_custom_zone_games
from gametheca.utils.storefront import build_storefront_shelf
from gametheca.utils.lifecycle import web_lifecycle_fields
from gametheca.utils.play_url import browse_play_fields, library_platform_key

discover_bp = Blueprint('discover', __name__)


def serialize_discover_game(
    game,
    cover_image,
    *,
    is_favorite,
    has_local_override,
    owned_game_uuids=None,
    user_id=None,
    client_state=None,
):
    cover_url = resolve_game_cover_url(game, cover_image)
    owned_uuids = owned_game_uuids or set()
    platform_key = library_platform_key(game)
    platform_label = None
    library = getattr(game, 'library', None)
    platform = getattr(library, 'platform', None) if library is not None else None
    if platform is not None:
        platform_label = getattr(platform, 'value', None) or platform_key

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
        'date_identified': game.date_identified.isoformat() if game.date_identified else None,
        'date_created': game.date_created.isoformat() if game.date_created else None,
        'first_release_date': (
            game.first_release_date.isoformat()
            if game.first_release_date
            else None
        ),
        'freshness_status': getattr(game, 'freshness_status', None),
        'library_platform': platform_key,
        'library_platform_label': platform_label,
        'badge_title_collision': bool(platform_key),
        **browse_play_fields(game),
        **game_card_flags(game),
        **web_lifecycle_fields(game, user_id=user_id, client_state=client_state),
        **ownership_flags(game.uuid, owned_uuids),
    }


# Storefront seed shelves are derived, so an empty one is hidden rather than
# rendered as a sad empty row (W25-STORE-1).
STOREFRONT_SHELF_IDS = frozenset({'curated_for_you', 'upcoming'})


def build_discover_sections(user) -> list[dict]:
    """Build Discover shelf payloads for the signed-in user (HTML shell or JSON API)."""
    # Scheduled shelves ("events") only render inside their window (W25-STORE-1).
    visible_sections = [
        section
        for section in db.session.execute(
            select(DiscoverySection)
            .filter_by(is_visible=True)
            .order_by(DiscoverySection.display_order)
        ).scalars().all()
        if section.is_live()
    ]
    settings = db.session.execute(
        select(GlobalSettings).order_by(GlobalSettings.id).limit(1)
    ).scalars().first()
    favorite_game_uuids = {game.uuid for game in user.favorites}
    owned_game_uuids = get_matched_owned_game_uuids(user.id)
    lifecycle_map = load_lifecycle_map(user.id)

    def fetch_game_details(games_query, limit=8):
        if hasattr(games_query, 'limit'):
            games = games_query.limit(limit).all()
        else:
            games = games_query[:limit] if limit else games_query

        game_details = []
        for game in games:
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
                    owned_game_uuids=owned_game_uuids,
                    user_id=user.id,
                    client_state=lifecycle_map.get(game.uuid),
                )
            )
        return game_details

    section_data = {}
    discover_sections = []

    for section in visible_sections:
        if section.identifier == 'libraries':
            libraries = filter_libraries(
                db.session.execute(select(Library)).scalars().all(),
                user,
            )
            section_data['libraries'] = [{
                'uuid': lib.uuid,
                'name': lib.name,
                'image_url': lib.image_url
            } for lib in libraries]
        elif section.identifier == 'latest_games':
            section_data['latest_games'] = fetch_game_details(
                db.session.execute(
                    apply_game_access_filters(
                        select(Game).order_by(Game.date_created.desc()).limit(8),
                        user,
                    )
                ).scalars().all()
            )
        elif section.identifier == 'most_downloaded':
            section_data['most_downloaded'] = fetch_game_details(
                db.session.execute(
                    apply_game_access_filters(
                        select(Game)
                        .filter(Game.times_downloaded > 0)
                        .order_by(Game.times_downloaded.desc())
                        .limit(8),
                        user,
                    )
                ).scalars().all()
            )
        elif section.identifier == 'highest_rated':
            section_data['highest_rated'] = fetch_game_details(
                db.session.execute(
                    apply_game_access_filters(
                        select(Game)
                        .filter(Game.rating.isnot(None))
                        .order_by(Game.rating.desc())
                        .limit(8),
                        user,
                    )
                ).scalars().all()
            )
        elif section.identifier == 'last_updated':
            section_data['last_updated'] = fetch_game_details(
                db.session.execute(
                    apply_game_access_filters(
                        select(Game)
                        .filter(Game.last_updated.isnot(None))
                        .order_by(Game.last_updated.desc())
                        .limit(8),
                        user,
                    )
                ).scalars().all()
            )
        elif section.identifier == 'most_favorited':
            fav_counts = (
                select(
                    user_favorites.c.game_uuid.label('game_uuid'),
                    func.count(user_favorites.c.user_id).label('favorite_count'),
                )
                .group_by(user_favorites.c.game_uuid)
                .subquery()
            )
            most_favorited = db.session.execute(
                apply_game_access_filters(
                    select(Game)
                    .join(fav_counts, Game.uuid == fav_counts.c.game_uuid)
                    .order_by(fav_counts.c.favorite_count.desc())
                    .limit(8),
                    user,
                )
            ).scalars().all()
            section_data['most_favorited'] = fetch_game_details(most_favorited)
        elif section.section_type == 'custom':
            section_data[section.identifier] = fetch_game_details(
                resolve_custom_zone_games(section.config, user, limit=8)
            )
        else:
            storefront_games = build_storefront_shelf(section.identifier, user, limit=8)
            if storefront_games is not None:
                section_data[section.identifier] = fetch_game_details(storefront_games)

        if section.identifier != 'libraries':
            games = section_data.get(section.identifier, [])
            # Honest empty: a storefront shelf with nothing to say is hidden,
            # not padded. Admin/custom shelves keep their existing behaviour.
            if not games and section.identifier in STOREFRONT_SHELF_IDS:
                continue
            discover_sections.append({
                'identifier': section.identifier,
                'title': section.name,
                'layout': section.layout or 'shelf',
                'is_event': bool(section.starts_at or section.ends_at),
                'ends_at': section.ends_at.isoformat() if section.ends_at else None,
                'games': games,
            })

    return discover_sections


@discover_bp.context_processor
@cache.cached(timeout=500, key_prefix='global_settings')
def inject_settings():
    """Context processor to inject global settings into templates"""
    return get_global_settings()


@discover_bp.route('/discover')
@login_required
def discover():
    # Shelves load client-side via GET /api/discover/sections (keeps HTML shell light).
    return render_member_spa()
