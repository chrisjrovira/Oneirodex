from flask import Blueprint
from gametheca import cache
from gametheca.utils.processors import get_global_settings

apis_bp = Blueprint('apis', __name__, url_prefix='/api')

@apis_bp.context_processor
@cache.cached(timeout=500, key_prefix='global_settings')
def inject_settings():
    """Context processor to inject global settings into templates"""
    return get_global_settings()

# Import routes to register them with the blueprint
from . import admin_search, ai_assist, browse, calendar, client, collections, download, emulator_cheats, emulator_saves, events, filters, game, health, igdb, imports_playnite, layouts, library, library_tools, locale, metadata_search, oidc_status, ownership, playtime, providers, quality_stats, scan, storage, system, tokens, updates, user, vr, wishlist, wanted, acquire, assists, wave8_11, social
