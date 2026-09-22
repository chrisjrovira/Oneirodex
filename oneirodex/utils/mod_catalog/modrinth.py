"""Modrinth -- the Minecraft registry (Fabric / Forge / Quilt / NeoForge).
Open API v2, no key; the project asks every client to send a User-Agent.

Modrinth is one game's registry, so the source only answers for a title
that *is* Minecraft (any edition, any launcher wording). The loader comes
straight from the hit's categories, in the INSP-36 vocabulary already.
"""

from __future__ import annotations

import json
from typing import Any

from oneirodex.utils.http_safe import safe_request
from oneirodex.utils.security import validate_user_outbound_http_url

from .base import TIMEOUT_SECONDS, USER_AGENT, ModHit, as_int, catalog_enabled, clamp_limit, text

SOURCE_ID = 'modrinth'
BASE_URL = 'https://api.modrinth.com'
SEARCH_PATH = '/v2/search'
PROJECT_URL = 'https://modrinth.com/mod/{slug}'
LOADERS = ('fabric', 'forge', 'quilt', 'neoforge')


def applies_to(game_title: str) -> bool:
    return 'minecraft' in (game_title or '').lower()


def _hit(row: dict[str, Any]) -> ModHit | None:
    title = text(row.get('title'), 200)
    slug = text(row.get('slug') or row.get('project_id'), 200)
    if not title or not slug:
        return None
    cats = [text(c, 60).lower() for c in (row.get('categories') or []) if text(c)]
    loaders = [c for c in cats if c in LOADERS]
    return ModHit(
        name=title,
        url=PROJECT_URL.format(slug=slug),
        source=SOURCE_ID,
        version=text(row.get('latest_version'), 40),
        # One loader is a fact; several is a choice the librarian makes in the row.
        loader=loaders[0] if len(loaders) == 1 else '',
        summary=text(row.get('description'), 400),
        author=text(row.get('author'), 120),
        downloads=as_int(row.get('downloads')),
        updated=text(row.get('date_modified'), 40) or None,
        categories=[c for c in cats if c not in LOADERS],
    )


def search(game_title: str, *, query: str = '', limit: int | None = None) -> list[ModHit] | None:
    """``None`` when the title is not Minecraft or the service gives no data;
    ``[]`` when Modrinth answered and nothing matched."""
    if not catalog_enabled() or not applies_to(game_title):
        return None
    params = {
        'query': (query or '')[:100],
        'limit': clamp_limit(limit),
        'index': 'relevance' if query else 'downloads',
        'facets': json.dumps([['project_type:mod']]),
    }
    try:
        resp = safe_request(
            'GET',
            BASE_URL + SEARCH_PATH,
            validator=validate_user_outbound_http_url,
            timeout=TIMEOUT_SECONDS,
            params=params,
            headers={'User-Agent': USER_AGENT, 'Accept': 'application/json'},
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        rows = data.get('hits') if isinstance(data, dict) else None
        if not isinstance(rows, list):
            return None
        hits = [h for h in (_hit(r) for r in rows if isinstance(r, dict)) if h]
        return hits
    except Exception:  # noqa: BLE001
        return None
