"""Metadata image provider framework (artwork only — never downloads games)."""

from oneirodex.utils.providers.base import (
    ImageSearchResult,
    MetadataImageProvider,
    ProviderDisabledError,
    mask_api_key,
)
from oneirodex.utils.providers.igdb import IgdbCoverProvider
from oneirodex.utils.providers.meta_quest import (
    MetaQuestProvider,
    get_meta_quest_api_mode,
    normalize_meta_quest_source,
    search_meta_quest_games,
    unofficial_graphql_enabled,
)
from oneirodex.utils.providers.registry import get_provider, list_providers, reset_provider_cache
from oneirodex.utils.providers.steamgriddb import (
    SteamGridDBProvider,
    get_steamgriddb_api_key,
)

__all__ = [
    'ImageSearchResult',
    'IgdbCoverProvider',
    'MetaQuestProvider',
    'MetadataImageProvider',
    'ProviderDisabledError',
    'SteamGridDBProvider',
    'get_meta_quest_api_mode',
    'get_provider',
    'get_steamgriddb_api_key',
    'list_providers',
    'mask_api_key',
    'normalize_meta_quest_source',
    'reset_provider_cache',
    'search_meta_quest_games',
    'unofficial_graphql_enabled',
]
