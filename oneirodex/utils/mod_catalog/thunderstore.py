"""Thunderstore -- the BepInEx / MelonLoader world (Risk of Rain 2, Valheim,
Lethal Company, ...). Open REST, no key.

Thunderstore groups packages by *community*, one per game, so a search is
two reads: the community list (cached for a day in-process) to find the
game's identifier by name, then that community's package listing, ordered by
rating. Neither read needs an account.
"""

from __future__ import annotations

import re
import threading
import time
from typing import Any

from oneirodex.utils.http_safe import safe_request
from oneirodex.utils.security import validate_user_outbound_http_url

from .base import TIMEOUT_SECONDS, USER_AGENT, ModHit, as_int, catalog_enabled, clamp_limit, text

SOURCE_ID = 'thunderstore'
BASE_URL = 'https://thunderstore.io'
COMMUNITY_LIST_PATH = '/api/experimental/community/'
# Ordered package listing the site itself reads; smaller than the full v1 dump.
PACKAGES_PATH = '/api/experimental/frontend/c/{community}/packages/'
_COMMUNITY_TTL = 24 * 3600
# Package categories that name a loader, mapped to the INSP-36 vocabulary.
LOADER_CATEGORIES = {
    'bepinex': 'bepinex',
    'melonloader': 'melonloader',
    'libraries': '',
}

_LOCK = threading.Lock()
_COMMUNITIES: list[dict[str, str]] | None = None
_COMMUNITIES_AT = 0.0
_WORD = re.compile(r'[^a-z0-9]+')


def _norm(name: str) -> str:
    return _WORD.sub(' ', (name or '').lower()).strip()


def _get(path: str, **params) -> Any:
    resp = safe_request(
        'GET',
        BASE_URL + path,
        validator=validate_user_outbound_http_url,
        timeout=TIMEOUT_SECONDS,
        params=params or None,
        headers={'User-Agent': USER_AGENT, 'Accept': 'application/json'},
    )
    if resp.status_code != 200:
        raise RuntimeError(f'thunderstore HTTP {resp.status_code}')
    return resp.json()


def _load_communities() -> list[dict[str, str]]:
    global _COMMUNITIES, _COMMUNITIES_AT
    with _LOCK:
        if _COMMUNITIES is not None and time.monotonic() - _COMMUNITIES_AT < _COMMUNITY_TTL:
            return _COMMUNITIES
    rows: list[dict[str, str]] = []
    data = _get(COMMUNITY_LIST_PATH)
    items = data.get('results') if isinstance(data, dict) else data
    for item in items or []:
        if not isinstance(item, dict):
            continue
        ident = text(item.get('identifier'), 100)
        name = text(item.get('name'), 200)
        if ident and name:
            rows.append({'identifier': ident, 'name': name})
    with _LOCK:
        _COMMUNITIES, _COMMUNITIES_AT = rows, time.monotonic()
    return rows


def find_community(game_title: str) -> dict[str, str] | None:
    """Exact normalised name first, then the one community whose name the
    title starts with (``Risk of Rain 2`` vs ``Risk of Rain 2 (Legacy)``)."""
    key = _norm(game_title)
    if not key:
        return None
    rows = _load_communities()
    for row in rows:
        if _norm(row['name']) == key:
            return row
    prefixed = [row for row in rows if _norm(row['name']).startswith(key) or key.startswith(_norm(row['name']))]
    if len(prefixed) == 1:
        return prefixed[0]
    return None


def _hit(pkg: dict[str, Any], community: dict[str, str]) -> ModHit | None:
    name = text(pkg.get('name'), 200)
    namespace = text(pkg.get('namespace') or pkg.get('owner'), 200)
    if not name:
        return None
    url = text(pkg.get('package_url') or pkg.get('url'), 2000)
    if not url and namespace:
        url = f'{BASE_URL}/c/{community["identifier"]}/p/{namespace}/{name}/'
    cats = [text(c.get('name') if isinstance(c, dict) else c, 60) for c in (pkg.get('categories') or [])]
    loader = ''
    for cat in cats:
        mapped = LOADER_CATEGORIES.get(cat.lower())
        if mapped:
            loader = mapped
            break
    latest = pkg.get('latest') if isinstance(pkg.get('latest'), dict) else {}
    return ModHit(
        name=name.replace('_', ' '),
        url=url,
        source=SOURCE_ID,
        version=text(pkg.get('version_number') or latest.get('version_number'), 40),
        loader=loader,
        summary=text(pkg.get('description') or latest.get('description'), 400),
        author=namespace,
        downloads=as_int(pkg.get('download_count') or pkg.get('total_downloads')),
        updated=text(pkg.get('last_updated') or pkg.get('date_updated'), 40) or None,
        categories=[c for c in cats if c],
    )


def search(game_title: str, *, query: str = '', limit: int | None = None) -> list[ModHit] | None:
    """Hits for the game's community; ``[]`` when the community exists and has
    nothing matching; ``None`` when Thunderstore has no community for the
    title or the service is off / unreachable / unrecognisable."""
    if not catalog_enabled():
        return None
    try:
        community = find_community(game_title)
        if community is None:
            return None
        params = {'ordering': 'top-rated', 'page': 1}
        if query:
            params['q'] = query[:100]
        data = _get(PACKAGES_PATH.format(community=community['identifier']), **params)
        packages = data.get('packages') if isinstance(data, dict) else data
        if not isinstance(packages, list):
            return None
        hits: list[ModHit] = []
        for pkg in packages:
            if not isinstance(pkg, dict) or pkg.get('is_deprecated'):
                continue
            hit = _hit(pkg, community)
            if hit:
                hits.append(hit)
            if len(hits) >= clamp_limit(limit):
                break
        return hits
    except Exception:  # noqa: BLE001 -- offline / blocked / schema drift is "no data"
        return None
