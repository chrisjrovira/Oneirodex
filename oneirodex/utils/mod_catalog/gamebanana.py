"""GameBanana -- the long-tail UGC registry (Source games, fighting games,
rhythm games, skins). Public read API, no key, rate-limited.

Two reads, like Thunderstore: resolve the game by name, then page that
game's mod feed. GameBanana has no loader vocabulary -- most entries are
file drops the game reads itself -- so ``loader`` stays empty and the
librarian sets it if one applies.
"""

from __future__ import annotations

import re
import threading
import time
from datetime import datetime, timezone
from typing import Any

from oneirodex.utils.http_safe import safe_request
from oneirodex.utils.security import validate_user_outbound_http_url

from .base import TIMEOUT_SECONDS, USER_AGENT, ModHit, as_int, catalog_enabled, clamp_limit, text

SOURCE_ID = 'gamebanana'
BASE_URL = 'https://gamebanana.com'
NAME_MATCH_PATH = '/apiv11/Util/Game/NameMatch'
SUBFEED_PATH = '/apiv11/Game/{game_id}/Subfeed'
_GAME_TTL = 24 * 3600

_LOCK = threading.Lock()
_GAMES: dict[str, dict[str, Any]] = {}
_GAMES_AT: dict[str, float] = {}
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
        raise RuntimeError(f'gamebanana HTTP {resp.status_code}')
    return resp.json()


def find_game(game_title: str) -> dict[str, Any] | None:
    """The GameBanana game row (``_idRow``, ``_sName``) whose name matches the
    title exactly after normalisation; ``None`` when nothing does."""
    key = _norm(game_title)
    if not key:
        return None
    with _LOCK:
        cached = _GAMES.get(key)
        if cached is not None and time.monotonic() - _GAMES_AT.get(key, 0.0) < _GAME_TTL:
            return cached or None
    data = _get(NAME_MATCH_PATH, _sName=game_title[:100])
    rows = data.get('_aRecords') if isinstance(data, dict) else data
    match: dict[str, Any] | None = None
    for row in rows or []:
        if not isinstance(row, dict):
            continue
        name = text(row.get('_sName'), 200)
        gid = as_int(row.get('_idRow'))
        if gid and _norm(name) == key:
            match = {'id': gid, 'name': name}
            break
    with _LOCK:
        _GAMES[key] = match or {}
        _GAMES_AT[key] = time.monotonic()
    return match


def _when(ts: Any) -> str | None:
    value = as_int(ts)
    if not value:
        return None
    try:
        return datetime.fromtimestamp(value, tz=timezone.utc).date().isoformat()
    except (OverflowError, OSError, ValueError):
        return None


def _hit(row: dict[str, Any]) -> ModHit | None:
    name = text(row.get('_sName'), 200)
    url = text(row.get('_sProfileUrl'), 2000)
    if not name or not url:
        return None
    submitter = row.get('_aSubmitter') if isinstance(row.get('_aSubmitter'), dict) else {}
    category = row.get('_aRootCategory') if isinstance(row.get('_aRootCategory'), dict) else {}
    cats = [c for c in (text(category.get('_sName'), 60),) if c]
    return ModHit(
        name=name,
        url=url,
        source=SOURCE_ID,
        version=text(row.get('_sVersion'), 40),
        loader='',
        summary=text(row.get('_sDescription') or row.get('_sText'), 400),
        author=text(submitter.get('_sName'), 120),
        downloads=as_int(row.get('_nDownloadCount')),
        updated=_when(row.get('_tsDateModified') or row.get('_tsDateUpdated') or row.get('_tsDateAdded')),
        categories=cats,
    )


def search(game_title: str, *, query: str = '', limit: int | None = None) -> list[ModHit] | None:
    """Mods for the game's GameBanana page, newest first (the feed's order);
    ``query`` filters by name locally. ``None`` when GameBanana has no page
    for the title or does not answer."""
    if not catalog_enabled():
        return None
    try:
        game = find_game(game_title)
        if game is None:
            return None
        cap = clamp_limit(limit)
        data = _get(
            SUBFEED_PATH.format(game_id=game['id']),
            _nPage=1,
            _nPerpage=max(cap, 20),
            _csvModelInclusions='Mod',
        )
        rows = data.get('_aRecords') if isinstance(data, dict) else data
        if not isinstance(rows, list):
            return None
        needle = _norm(query)
        hits: list[ModHit] = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            if text(row.get('_sModelName'), 40) not in ('', 'Mod'):
                continue
            hit = _hit(row)
            if hit is None:
                continue
            if needle and needle not in _norm(hit.name) and needle not in _norm(hit.summary):
                continue
            hits.append(hit)
            if len(hits) >= cap:
                break
        return hits
    except Exception:  # noqa: BLE001 -- offline / blocked / schema drift is "no data"
        return None
