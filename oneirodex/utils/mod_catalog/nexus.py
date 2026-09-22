"""Nexus Mods -- the big PC RPG registry. **Browse only, behind a personal
API key the operator places** (``NEXUS_API_KEY``); never a download.

Nexus's terms allow a personal key to read the catalogue but forbid
third-party download automation, so this source stops at *trending* and
*latest* for a game -- names, versions, summaries and the mod page -- and
``source_url`` is that page. The official v1 API has no free-text search;
``query`` filters the browsed page locally.

Without a key the source reports *unavailable* with a note, and the plugin /
inventory row reads ``available`` (a key is what turns it on). The key is an
operator secret: it goes in the request header and nowhere else.
"""

from __future__ import annotations

import os
import re
import threading
import time
from datetime import datetime, timezone
from typing import Any

from oneirodex.utils.http_safe import safe_request
from oneirodex.utils.security import validate_user_outbound_http_url

from .base import TIMEOUT_SECONDS, USER_AGENT, ModHit, as_int, catalog_enabled, clamp_limit, text

SOURCE_ID = 'nexus'
BASE_URL = 'https://api.nexusmods.com'
GAMES_PATH = '/v1/games.json'
TRENDING_PATH = '/v1/games/{domain}/mods/trending.json'
LATEST_PATH = '/v1/games/{domain}/mods/latest_added.json'
MOD_URL = 'https://www.nexusmods.com/{domain}/mods/{mod_id}'
_GAMES_TTL = 24 * 3600

_LOCK = threading.Lock()
_GAMES: list[dict[str, str]] | None = None
_GAMES_AT = 0.0
_WORD = re.compile(r'[^a-z0-9]+')


def api_key() -> str:
    return (os.environ.get('NEXUS_API_KEY') or '').strip()


def configured() -> bool:
    return bool(api_key())


def _norm(name: str) -> str:
    return _WORD.sub(' ', (name or '').lower()).strip()


def _get(path: str) -> Any:
    resp = safe_request(
        'GET',
        BASE_URL + path,
        validator=validate_user_outbound_http_url,
        timeout=TIMEOUT_SECONDS,
        headers={
            'User-Agent': USER_AGENT,
            'Accept': 'application/json',
            'apikey': api_key(),
        },
    )
    if resp.status_code != 200:
        raise RuntimeError(f'nexus HTTP {resp.status_code}')
    return resp.json()


def _load_games() -> list[dict[str, str]]:
    global _GAMES, _GAMES_AT
    with _LOCK:
        if _GAMES is not None and time.monotonic() - _GAMES_AT < _GAMES_TTL:
            return _GAMES
    rows: list[dict[str, str]] = []
    for item in _get(GAMES_PATH) or []:
        if not isinstance(item, dict):
            continue
        domain = text(item.get('domain_name'), 100)
        name = text(item.get('name'), 200)
        if domain and name:
            rows.append({'domain': domain, 'name': name})
    with _LOCK:
        _GAMES, _GAMES_AT = rows, time.monotonic()
    return rows


def find_domain(game_title: str) -> str | None:
    key = _norm(game_title)
    if not key:
        return None
    rows = _load_games()
    for row in rows:
        if _norm(row['name']) == key:
            return row['domain']
    prefixed = [row for row in rows if _norm(row['name']).startswith(key) or key.startswith(_norm(row['name']))]
    if len(prefixed) == 1:
        return prefixed[0]['domain']
    return None


def _when(ts: Any) -> str | None:
    value = as_int(ts)
    if not value:
        return None
    try:
        return datetime.fromtimestamp(value, tz=timezone.utc).date().isoformat()
    except (OverflowError, OSError, ValueError):
        return None


def _hit(row: dict[str, Any], domain: str) -> ModHit | None:
    name = text(row.get('name'), 200)
    mod_id = as_int(row.get('mod_id'))
    if not name or not mod_id:
        return None
    if row.get('available') is False or text(row.get('status'), 40) not in ('', 'published'):
        return None
    return ModHit(
        name=name,
        url=MOD_URL.format(domain=domain, mod_id=mod_id),
        source=SOURCE_ID,
        version=text(row.get('version'), 40),
        loader='',
        summary=text(row.get('summary'), 400),
        author=text(row.get('author') or row.get('uploaded_by'), 120),
        downloads=as_int(row.get('mod_downloads') or row.get('unique_downloads')),
        updated=_when(row.get('updated_timestamp') or row.get('created_timestamp')),
        categories=[],
    )


def search(game_title: str, *, query: str = '', limit: int | None = None) -> list[ModHit] | None:
    """Trending, then latest, for the game's Nexus domain; ``query`` filters
    locally. ``None`` without a key, without a domain, or without an answer."""
    if not catalog_enabled() or not configured():
        return None
    try:
        domain = find_domain(game_title)
        if domain is None:
            return None
        cap = clamp_limit(limit)
        needle = _norm(query)
        seen: set[str] = set()
        hits: list[ModHit] = []
        for path in (TRENDING_PATH, LATEST_PATH):
            rows = _get(path.format(domain=domain))
            if not isinstance(rows, list):
                continue
            for row in rows:
                if not isinstance(row, dict):
                    continue
                hit = _hit(row, domain)
                if hit is None or hit.url in seen:
                    continue
                if needle and needle not in _norm(hit.name) and needle not in _norm(hit.summary):
                    continue
                seen.add(hit.url)
                hits.append(hit)
                if len(hits) >= cap:
                    return hits
        return hits
    except Exception:  # noqa: BLE001
        return None
