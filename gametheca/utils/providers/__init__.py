"""Metadata image provider framework (artwork only — never downloads games)."""

from gametheca.utils.providers.base import (
    ImageSearchResult,
    MetadataImageProvider,
    ProviderDisabledError,
    mask_api_key,
)
from gametheca.utils.providers.igdb import IgdbCoverProvider
from gametheca.utils.providers.registry import get_provider, list_providers, reset_provider_cache
from gametheca.utils.providers.steamgriddb import (
    SteamGridDBProvider,
    get_steamgriddb_api_key,
)

__all__ = [
    'ImageSearchResult',
    'IgdbCoverProvider',
    'MetadataImageProvider',
    'ProviderDisabledError',
    'SteamGridDBProvider',
    'get_provider',
    'get_steamgriddb_api_key',
    'list_providers',
    'mask_api_key',
    'reset_provider_cache',
]
