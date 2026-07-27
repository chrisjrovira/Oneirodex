"""Always-disabled stub for a future remote connector (no network)."""

from __future__ import annotations

from gametheca.utils.patch_catalog.base import PatchCatalogHit, PatchCatalogProvider


class StubRemotePatchCatalogProvider(PatchCatalogProvider):
    """Placeholder for a future operator-approved remote connector.

    Intentionally never enabled and never fetches the public internet.
    Operators who want remote sources must implement ToS-compliant connectors
    themselves and register them — GameTheca will not scrape romhacking.net.
    """

    id = 'remote_stub'
    name = 'Remote connector (stub)'
    description = (
        'Future hook only — disabled. No third-party patch DB scrape. '
        'Use the local YAML/JSON catalog for operator-owned metadata.'
    )

    def is_enabled(self) -> bool:
        return False

    def search(
        self,
        query: str,
        *,
        platform: str | None = None,
        region: str | None = None,
        target_lang: str | None = None,
        limit: int = 20,
    ) -> list[PatchCatalogHit]:
        return []

    def config_hint(self) -> str:
        return (
            'This stub never enables. Place an operator-owned catalog at PATCH_CATALOG_PATH '
            'and set ENABLE_PATCH_CATALOG=true.'
        )
