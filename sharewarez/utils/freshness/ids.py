"""Extract store IDs from GameURL rows, steam_url, and folder labels."""

from __future__ import annotations

import os
import re
from urllib.parse import urlparse

from sharewarez.utils.game_name_parse import parse_game_label

STEAM_APP_RE = re.compile(r'(?:store\.steampowered\.com/app/|steamcommunity\.com/app/)(\d+)', re.I)
STEAM_QUERY_RE = re.compile(r'[?&]appid=(\d+)', re.I)
GOG_PRODUCT_RE = re.compile(r'gog\.com/(?:en/)?(?:game|games)/([a-z0-9_]+)', re.I)
GOG_ID_RE = re.compile(r'gog\.com/(?:en/)?(?:game|games)/\w+/(\d+)', re.I)
EPIC_SLUG_RE = re.compile(
    r'epicgames\.com/(?:store/)?(?:[a-z]{2}/)?(?:product|p)/([a-z0-9-]+)',
    re.I,
)


def _urls_from_game(game) -> list[tuple[str, str]]:
    pairs = []
    for row in getattr(game, 'urls', None) or []:
        url_type = (getattr(row, 'url_type', None) or '').lower()
        url = getattr(row, 'url', None) or ''
        if url:
            pairs.append((url_type, url))
    steam_url = getattr(game, 'steam_url', None) or ''
    if steam_url:
        pairs.append(('steam', steam_url))
    return pairs


def resolve_steam_app_id(game) -> int | None:
    existing = getattr(game, 'steam_app_id', None)
    if existing:
        try:
            return int(existing)
        except (TypeError, ValueError):
            pass
    for _type, url in _urls_from_game(game):
        match = STEAM_APP_RE.search(url) or STEAM_QUERY_RE.search(url)
        if match:
            return int(match.group(1))
    path = getattr(game, 'full_disk_path', None) or ''
    label = os.path.basename(path.rstrip('\\/')) or (getattr(game, 'name', None) or '')
    parsed = parse_game_label(label)
    app_id = parsed.get('steam_app_id')
    if app_id:
        try:
            return int(app_id)
        except (TypeError, ValueError):
            return None
    return None


def resolve_gog_identity(game) -> dict:
    """Return {product_id?, slug?} from GOG URLs."""
    out: dict = {}
    for url_type, url in _urls_from_game(game):
        if 'gog' not in url_type and 'gog.com' not in url.lower():
            continue
        id_match = GOG_ID_RE.search(url)
        if id_match:
            out['product_id'] = id_match.group(1)
        slug_match = GOG_PRODUCT_RE.search(url)
        if slug_match:
            out['slug'] = slug_match.group(1)
        if out:
            break
    return out


def resolve_epic_identity(game) -> dict:
    """Return {slug?} from Epic store URLs."""
    out: dict = {}
    for url_type, url in _urls_from_game(game):
        if 'epic' not in url_type and 'epicgames.com' not in url.lower():
            continue
        match = EPIC_SLUG_RE.search(url)
        if match:
            out['slug'] = match.group(1)
            out['url'] = url
            break
        # Fallback: last path segment
        path = urlparse(url).path.rstrip('/')
        if path:
            out['slug'] = path.split('/')[-1]
            out['url'] = url
            break
    return out
