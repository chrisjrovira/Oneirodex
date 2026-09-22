"""Read-only mod catalogue sources (INSP-22). See :mod:`.base`."""

from __future__ import annotations

from typing import Any

from . import modrinth, thunderstore
from .base import ModHit, catalog_enabled, clamp_limit

SOURCES: dict[str, Any] = {
    thunderstore.SOURCE_ID: thunderstore,
    modrinth.SOURCE_ID: modrinth,
}
SOURCE_LABELS = {
    thunderstore.SOURCE_ID: 'Thunderstore',
    modrinth.SOURCE_ID: 'Modrinth',
}
SOURCE_NOTES = {
    thunderstore.SOURCE_ID: 'BepInEx / MelonLoader communities, one per game. Open REST, no key.',
    modrinth.SOURCE_ID: 'Minecraft mods (Fabric / Forge / Quilt / NeoForge). Open API, no key.',
}

__all__ = [
    'ModHit',
    'SOURCES',
    'SOURCE_LABELS',
    'SOURCE_NOTES',
    'catalog_enabled',
    'catalog_search',
    'source_ids',
]


def source_ids() -> list[str]:
    return list(SOURCES)


def catalog_search(
    source: str,
    game_title: str,
    *,
    query: str = '',
    limit: int | None = None,
) -> dict[str, Any]:
    """One envelope shape for the API: ``status`` is ``ok`` (hits, maybe
    none), ``unavailable`` (the source had no data -- off, offline, or no
    registry for this title), or ``unknown_source``. ``hits`` is ``None`` on
    anything but ``ok`` so a caller can never mistake silence for empty."""
    module = SOURCES.get((source or '').strip().lower())
    if module is None:
        return {'source': source, 'status': 'unknown_source', 'hits': None, 'sources': source_ids()}
    if not catalog_enabled():
        return {
            'source': module.SOURCE_ID,
            'status': 'unavailable',
            'hits': None,
            'note': 'Mod catalogue browsing is off (ENABLE_MOD_CATALOG).',
        }
    hits = module.search(game_title, query=query or '', limit=clamp_limit(limit))
    if hits is None:
        return {
            'source': module.SOURCE_ID,
            'status': 'unavailable',
            'hits': None,
            'note': f'{SOURCE_LABELS[module.SOURCE_ID]} had no data for this title -- no registry for it, or the service did not answer.',
        }
    return {
        'source': module.SOURCE_ID,
        'status': 'ok',
        'hits': [h.to_dict() for h in hits],
        'count': len(hits),
    }
