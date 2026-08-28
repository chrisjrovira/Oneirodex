"""Package re-export of repo-root ``product_env`` (ADR 0003 phase 3)."""

from __future__ import annotations

from product_env import LEGACY_PREFIX, NEW_PREFIX, getenv_product, getenv_product_int

__all__ = ['LEGACY_PREFIX', 'NEW_PREFIX', 'getenv_product', 'getenv_product_int']
