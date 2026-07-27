"""Base types for operator-owned translation patch catalogs (metadata only)."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass
from typing import Any


@dataclass(frozen=True)
class PatchCatalogHit:
    """Normalized catalog hit — guide metadata, never a binary download."""

    id: str
    title: str
    source_url: str
    provider: str
    platform: str | None = None
    region: str | None = None
    target_language: str | None = None
    patch_format: str | None = None
    notes: str | None = None
    score: int = 0

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class PatchCatalogDisabledError(Exception):
    """Raised when the patch catalog module or a provider is disabled."""

    def __init__(self, provider_id: str, message: str):
        self.provider_id = provider_id
        self.message = message
        super().__init__(message)


class PatchCatalogProvider(ABC):
    """Search operator-curated patch metadata. Never scrapes third-party DBs."""

    id: str
    name: str
    description: str

    @abstractmethod
    def is_enabled(self) -> bool:
        """True when this provider can return results."""

    @abstractmethod
    def search(
        self,
        query: str,
        *,
        platform: str | None = None,
        region: str | None = None,
        target_lang: str | None = None,
        limit: int = 20,
    ) -> list[PatchCatalogHit]:
        """Search catalog entries by title / aliases."""

    def config_hint(self) -> str:
        return 'Configure ENABLE_PATCH_CATALOG and PATCH_CATALOG_PATH for the local YAML provider.'
