"""Read-only mod catalogue sources (INSP-22). See :mod:`.base`."""

from __future__ import annotations

from typing import Any

from . import gamebanana, modrinth, nexus, thunderstore
from .base import ModHit, catalog_enabled, clamp_limit

SOURCES: dict[str, Any] = {
    thunderstore.SOURCE_ID: thunderstore,
    modrinth.SOURCE_ID: modrinth,
    gamebanana.SOURCE_ID: gamebanana,
    nexus.SOURCE_ID: nexus,
}
SOURCE_LABELS = {
    thunderstore.SOURCE_ID: 'Thunderstore',
    modrinth.SOURCE_ID: 'Modrinth',
    gamebanana.SOURCE_ID: 'GameBanana',
    nexus.SOURCE_ID: 'Nexus Mods',
}
SOURCE_NOTES = {
    thunderstore.SOURCE_ID: 'BepInEx / MelonLoader communities, one per game. Open REST, no key.',
    modrinth.SOURCE_ID: 'Minecraft mods (Fabric / Forge / Quilt / NeoForge). Open API, no key.',
    gamebanana.SOURCE_ID: 'Long-tail UGC (Source, fighting, rhythm games; skins). Public API, no key, rate-limited.',
    nexus.SOURCE_ID: 'PC RPG registry. Browse only (trending + latest) behind a personal NEXUS_API_KEY the operator places; its terms forbid third-party download automation.',
}
# A source that needs a credential before it can answer at all.
KEYED_SOURCES = {nexus.SOURCE_ID: 'NEXUS_API_KEY'}

__all__ = [
    'ModHit',
    'SOURCES',
    'SOURCE_LABELS',
    'SOURCE_NOTES',
    'KEYED_SOURCES',
    'catalog_enabled',
    'source_configured',
    'catalog_search',
    'source_ids',
]


def source_ids() -> list[str]:
    return list(SOURCES)


def source_configured(source: str) -> bool:
    """Keyless sources are usable whenever the catalogue is on; a keyed one
    needs its key in the environment."""
    module = SOURCES.get(source)
    if module is None:
        return False
    check = getattr(module, 'configured', None)
    return bool(check()) if callable(check) else True


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
    if not source_configured(module.SOURCE_ID):
        return {
            'source': module.SOURCE_ID,
            'status': 'unavailable',
            'hits': None,
            'note': f'{SOURCE_LABELS[module.SOURCE_ID]} needs {KEYED_SOURCES.get(module.SOURCE_ID, "a key")} on the server before it can answer.',
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
