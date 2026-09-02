"""Registry for translation patch catalog providers."""

from __future__ import annotations

from oneirodex.utils.patch_catalog.base import PatchCatalogHit, PatchCatalogProvider
from oneirodex.utils.patch_catalog.local_yaml import LocalYamlPatchCatalogProvider
from oneirodex.utils.patch_catalog.stub import StubRemotePatchCatalogProvider

_PROVIDER_CLASSES: dict[str, type[PatchCatalogProvider]] = {
    LocalYamlPatchCatalogProvider.id: LocalYamlPatchCatalogProvider,
    StubRemotePatchCatalogProvider.id: StubRemotePatchCatalogProvider,
}

_provider_instances: dict[str, PatchCatalogProvider] = {}


def reset_patch_catalog_cache() -> None:
    _provider_instances.clear()


def get_patch_provider(provider_id: str) -> PatchCatalogProvider:
    provider_class = _PROVIDER_CLASSES.get(provider_id)
    if provider_class is None:
        raise KeyError(f'Unknown patch catalog provider: {provider_id}')
    if provider_id not in _provider_instances:
        _provider_instances[provider_id] = provider_class()
    return _provider_instances[provider_id]


def list_patch_providers() -> list[dict]:
    rows = []
    for provider_id in sorted(_PROVIDER_CLASSES):
        provider = get_patch_provider(provider_id)
        rows.append(
            {
                'id': provider.id,
                'name': provider.name,
                'description': provider.description,
                'enabled': provider.is_enabled(),
                'config_hint': provider.config_hint(),
            }
        )
    return rows


def search_all_patch_providers(
    query: str,
    *,
    platform: str | None = None,
    region: str | None = None,
    target_lang: str | None = None,
    limit: int = 20,
) -> list[PatchCatalogHit]:
    """Merge hits from all enabled providers, sorted by score."""
    merged: list[PatchCatalogHit] = []
    for provider_id in sorted(_PROVIDER_CLASSES):
        provider = get_patch_provider(provider_id)
        if not provider.is_enabled():
            continue
        merged.extend(
            provider.search(
                query,
                platform=platform,
                region=region,
                target_lang=target_lang,
                limit=limit,
            )
        )
    merged.sort(key=lambda h: (-h.score, h.title.lower()))
    return merged[: max(1, min(int(limit or 20), 50))]
