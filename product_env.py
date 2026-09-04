"""Product env names (ADR 0003).

``ONEIRODEX_<SUFFIX>`` is the only accepted prefix. The legacy ``GT_<SUFFIX>``
fallback was removed in the clean-break rename — an ``.env`` still using the
old names must be updated or those settings fall back to their defaults.

Lives at the repo root so ``config.py`` can import it without touching the
``oneirodex`` package (that import would be circular — ``oneirodex/__init__.py``
loads Config first).
"""

from __future__ import annotations

import os


PREFIX = 'ONEIRODEX_'


def getenv_product(suffix: str, default: str | None = None) -> str | None:
    """Read ``ONEIRODEX_<suffix>``.

    An empty or whitespace-only value is treated as unset, so a blank key in a
    template ``.env`` cannot shadow the default.
    """
    suffix = (suffix or '').lstrip('_')
    raw = os.environ.get(PREFIX + suffix)
    if raw is not None and str(raw).strip() != '':
        return raw
    return default


def getenv_product_int(
    suffix: str,
    default: int,
    *,
    minimum: int = 1,
    maximum: int = 64,
) -> int:
    """Integer env with the same rule as ``getenv_product``, clamped to range."""
    raw = getenv_product(suffix)
    if raw is None:
        return default
    try:
        value = int(str(raw).strip())
    except (TypeError, ValueError):
        return default
    return max(minimum, min(maximum, value))
