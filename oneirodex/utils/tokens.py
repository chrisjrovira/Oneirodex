"""Signed-token helpers.

``get_serializer`` was defined (identically) in both ``oneirodex/routes.py`` and
``oneirodex/routes_login.py``. Wave A2.1f retired the ``'main'`` blueprint, so the
canonical copy now lives here and ``routes_login`` imports it.
"""

from itsdangerous import URLSafeTimedSerializer
from flask import current_app


def get_serializer() -> URLSafeTimedSerializer:
    """Return a ``URLSafeTimedSerializer`` keyed by the active app's SECRET_KEY."""
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
