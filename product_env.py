"""Dual product env names (ADR 0003 phase 3).

``ONEIRODEX_<SUFFIX>`` wins when set; ``GT_<SUFFIX>`` still works so existing
``.env`` files and Unraid stacks keep booting. Lives at the repo root so
``config.py`` can import it without touching the ``oneirodex`` package (that
import would be circular — ``oneirodex/__init__.py`` loads Config first).
"""

from __future__ import annotations

import os


NEW_PREFIX = 'ONEIRODEX_'
LEGACY_PREFIX = 'GT_'


def getenv_product(suffix: str, default: str | None = None) -> str | None:
    """Read ``ONEIRODEX_<suffix>``, then ``GT_<suffix>``.

    Empty values are skipped so a blank new key cannot hide a real legacy one.
    """
    suffix = (suffix or '').lstrip('_')
    for prefix in (NEW_PREFIX, LEGACY_PREFIX):
        raw = os.environ.get(prefix + suffix)
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
    """Integer env with the same dual-prefix rule as ``getenv_product``."""
    raw = getenv_product(suffix)
    if raw is None:
        return default
    try:
        value = int(str(raw).strip())
    except (TypeError, ValueError):
        return default
    return max(minimum, min(maximum, value))
