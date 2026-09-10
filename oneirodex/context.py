"""App-level template context processors.

The ``'main'`` blueprint (``oneirodex/routes.py``) carried an ``inject_settings``
context processor -- ``@cache.cached(timeout=500, key_prefix='global_settings')``
returning :func:`oneirodex.utils.processors.get_global_settings`. Wave A2.1f
retired that blueprint; ``member_bp`` / ``admin2_bp`` already register an
identical processor, and this module re-registers it app-wide so templates
rendered outside those blueprints keep the same ``settings`` keys. The cache key
and timeout are unchanged, so the DB hit is shared with the blueprint copies.
"""

from oneirodex import cache
from oneirodex.utils.processors import get_global_settings


@cache.cached(timeout=500, key_prefix='global_settings')
def inject_settings():
    """Inject global settings into every template context."""
    return get_global_settings()


def register_context_processors(app):
    """Wire app-level context processors from ``create_app()``."""
    app.context_processor(inject_settings)
