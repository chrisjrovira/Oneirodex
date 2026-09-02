from flask import Blueprint
from oneirodex import cache
from oneirodex.utils.processors import get_global_settings

games_bp = Blueprint('games', __name__)

@games_bp.context_processor
@cache.cached(timeout=20, key_prefix='global_settings')
def inject_settings():
    """Context processor to inject global settings into templates"""
    return get_global_settings()

# Import routes to register them with the blueprint
from . import add, details, edit
