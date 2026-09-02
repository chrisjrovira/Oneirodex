"""Operator-owned translation patch catalog (metadata only — no scrapes)."""

from oneirodex.utils.patch_catalog.base import (
    PatchCatalogDisabledError,
    PatchCatalogHit,
    PatchCatalogProvider,
)
from oneirodex.utils.patch_catalog.registry import (
    get_patch_provider,
    list_patch_providers,
    reset_patch_catalog_cache,
    search_all_patch_providers,
)

__all__ = [
    'PatchCatalogDisabledError',
    'PatchCatalogHit',
    'PatchCatalogProvider',
    'get_patch_provider',
    'list_patch_providers',
    'reset_patch_catalog_cache',
    'search_all_patch_providers',
]
