"""Provider registry — lists enabled artwork providers from settings/env."""

from __future__ import annotations

from gametheca.utils.providers.base import MetadataImageProvider
from gametheca.utils.providers.giantbomb import GiantBombProvider, PcGamingWikiProvider
from gametheca.utils.providers.igdb import IgdbCoverProvider
from gametheca.utils.providers.meta_quest import MetaQuestProvider
from gametheca.utils.providers.steamgriddb import SteamGridDBProvider

_PROVIDER_CLASSES: dict[str, type[MetadataImageProvider]] = {
    SteamGridDBProvider.id: SteamGridDBProvider,
    IgdbCoverProvider.id: IgdbCoverProvider,
    GiantBombProvider.id: GiantBombProvider,
    PcGamingWikiProvider.id: PcGamingWikiProvider,
    MetaQuestProvider.id: MetaQuestProvider,
}

_provider_instances: dict[str, MetadataImageProvider] = {}


def _get_provider_instance(provider_id: str) -> MetadataImageProvider:
    provider_class = _PROVIDER_CLASSES.get(provider_id)
    if provider_class is None:
        raise KeyError(f'Unknown provider: {provider_id}')
    if provider_id not in _provider_instances:
        _provider_instances[provider_id] = provider_class()
    return _provider_instances[provider_id]


def reset_provider_cache() -> None:
    """Clear cached provider instances (useful in tests)."""
    _provider_instances.clear()


def get_provider(provider_id: str) -> MetadataImageProvider:
    """Return a registered provider instance by id."""
    return _get_provider_instance(provider_id)


def list_providers() -> list[dict]:
    """Return metadata for all registered providers and their enabled state."""
    items: list[dict] = []
    for provider_id in sorted(_PROVIDER_CLASSES):
        provider = _get_provider_instance(provider_id)
        items.append({
            'id': provider.id,
            'name': provider.name,
            'description': provider.description,
            'enabled': provider.is_enabled(),
            'config_hint': provider.config_hint(),
        })
    return items
