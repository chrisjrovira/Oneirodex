"""Package re-export of repo-root ``product_env`` (ADR 0003).

``LEGACY_PREFIX`` / ``NEW_PREFIX`` are gone: there is one prefix now, exported
as ``PREFIX``. See ``product_env`` for why the ``GT_*`` fallback was dropped.
"""

from __future__ import annotations

from product_env import PREFIX, getenv_product, getenv_product_int

__all__ = ['PREFIX', 'getenv_product', 'getenv_product_int']
