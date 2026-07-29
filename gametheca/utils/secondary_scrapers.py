import re

import requests

from gametheca.utils.http_retry import request_with_backoff

VR_PERSPECTIVE_NAME = 'Virtual Reality'

_VR_CATEGORY_MARKERS = (
    'vr only',
    'vr support',
    'virtual reality',
    'steamvr',
)


def categories_indicate_vr(categories):
    """True when Steam category descriptions indicate a VR title."""
    if not categories:
        return False
    for raw in categories:
        text = (raw or '').lower()
        if not text:
            continue
        if any(marker in text for marker in _VR_CATEGORY_MARKERS):
            return True
        # Standalone "VR" token (avoid matching words like "overview")
        if re.search(r'(^|[^a-z])vr([^a-z]|$)', text):
            return True
    return False


def normalize_perspective_name(name):
    """Map Steam-style labels onto canonical IGDB-style perspective names."""
    if not name:
        return name
    lowered = name.strip().lower()
    if lowered in {'vr / virtual reality', 'virtual reality', 'vr'}:
        return VR_PERSPECTIVE_NAME
    return name.strip()


def steam_perspective_names(categories):
    """Derive player-perspective names from Steam store categories."""
    names = []
    if categories_indicate_vr(categories):
        names.append(VR_PERSPECTIVE_NAME)
    joined = ' '.join((c or '').lower() for c in (categories or []))
    if 'first-person' in joined or 'first person' in joined:
        names.append('First person')
    if 'third-person' in joined or 'third person' in joined:
        names.append('Third person')
    return names


def perspectives_indicate_vr(perspective_names):
    if not perspective_names:
        return False
    for name in perspective_names:
        normalized = normalize_perspective_name(name or '')
        if normalized == VR_PERSPECTIVE_NAME:
            return True
        lowered = (name or '').lower()
        if 'virtual reality' in lowered or re.search(r'(^|[^a-z])vr([^a-z]|$)', lowered):
            return True
    return False


def game_indicates_vr(game):
    """True when a Game (or duck-typed object) already has a VR perspective."""
    perspectives = getattr(game, 'player_perspectives', None) or []
    return perspectives_indicate_vr([getattr(p, 'name', None) for p in perspectives])


def game_card_flags(game):
    """Flags used by library cards / browse JSON payloads."""
    return {'is_vr': game_indicates_vr(game)}


def enrich_game_metadata(game_name, igdb_data=None, rawg_api_key=None):
    """
    Sweeps Steam and RAWG APIs to fill in ANY missing fields in the game metadata.
    """
    metadata = igdb_data or {}

    steam_data = fetch_steam_data(game_name)
    if steam_data:
        metadata = merge_metadata(metadata, steam_data)

    if rawg_api_key or missing_core_fields(metadata):
        rawg_data = fetch_rawg_data(game_name, rawg_api_key)
        if rawg_data:
            metadata = merge_metadata(metadata, rawg_data)

    return metadata


def missing_core_fields(data):
    """Checks if critical metadata fields are still empty."""
    return not data.get('summary') or not data.get('genres') or not data.get('developer')


def search_steam_games(game_name, limit=10):
    """Return a list of Steam store search hits for manual identify UI."""
    try:
        clean_name = re.sub(r'[\(\)\[\]]', '', game_name or '')
        if not clean_name.strip():
            return []
        search_url = (
            f"https://store.steampowered.com/api/storesearch/"
            f"?term={requests.utils.quote(clean_name)}&l=english&cc=US"
        )
        resp = request_with_backoff(search_url, host_key='steam', timeout=5)
        if resp is None:
            return []
        items = (resp.json().get('items') or [])[:limit]
        results = []
        for item in items:
            app_id = item.get('id')
            results.append({
                'source': 'steam',
                'id': app_id,
                'name': item.get('name'),
                'url': f'https://store.steampowered.com/app/{app_id}/' if app_id else None,
                'cover_url': (item.get('tiny_image') or None),
                'summary': None,
                'steam_app_id': app_id,
            })
        return results
    except Exception as e:
        print(f"Steam search error for {game_name}: {e}")
        return []


def search_rawg_games(game_name, api_key=None, limit=10):
    """Return RAWG search hits for manual identify UI."""
    try:
        clean_name = re.sub(r'[\(\)\[\]]', '', game_name or '')
        if not clean_name.strip():
            return []
        params = {'search': clean_name, 'page_size': limit}
        if api_key:
            params['key'] = api_key
        resp = request_with_backoff(
            "https://api.rawg.io/api/games",
            host_key='rawg',
            params=params,
            timeout=5,
        )
        if resp is None:
            return []
        results = []
        for game in resp.json().get('results') or []:
            results.append({
                'source': 'rawg',
                'id': game.get('id'),
                'name': game.get('name'),
                'url': f"https://rawg.io/games/{game.get('slug')}" if game.get('slug') else None,
                'cover_url': game.get('background_image'),
                'summary': None,
                'release_date': game.get('released'),
                'rating': game.get('rating'),
            })
        return results
    except Exception as e:
        print(f"RAWG search error for {game_name}: {e}")
        return []


def search_gog_games(game_name, limit=10):
    """Return GOG embed search hits for manual identify UI."""
    try:
        clean_name = re.sub(r'[\(\)\[\]]', '', game_name or '').strip()
        if not clean_name:
            return []
        resp = request_with_backoff(
            'https://embed.gog.com/games/ajax/filtered',
            host_key='gog',
            params={'mediaType': 'game', 'search': clean_name},
            timeout=5,
        )
        if resp is None:
            return []
        products = (resp.json().get('products') or [])[:limit]
        results = []
        for product in products:
            slug = product.get('slug')
            product_id = product.get('id')
            results.append({
                'source': 'gog',
                'id': product_id,
                'name': product.get('title') or product.get('name'),
                'url': f'https://www.gog.com/game/{slug}' if slug else None,
                'cover_url': product.get('image') or product.get('image2'),
                'summary': None,
                'gog_id': product_id,
                'slug': slug,
            })
        return results
    except Exception as e:
        print(f"GOG search error for {game_name}: {e}")
        return []


def search_epic_games(game_name, limit=10):
    """Return Epic Games Store catalog search hits (metadata only — no DRM download)."""
    try:
        clean_name = re.sub(r'[\(\)\[\]]', '', game_name or '').strip()
        if not clean_name:
            return []
        # Public catalog fuzzy search used by open-source launchers (register/identify only).
        resp = request_with_backoff(
            f'https://catalog-public-service-prod06.ol.epicgames.com/catalog/api/shared/'
            f'namespace/epic/fuzzySearch/{requests.utils.quote(clean_name)}',
            host_key='epic',
            params={'count': limit},
            timeout=8,
            headers={'User-Agent': 'GameTheca/1.0 (self-hosted library)'},
        )
        if resp is None:
            return []
        payload = resp.json() if resp.content else {}
        elements = (payload.get('elements') or payload.get('data') or [])[:limit]
        results = []
        for item in elements:
            if not isinstance(item, dict):
                continue
            title = item.get('title') or item.get('name')
            offer_id = item.get('id') or item.get('offerId') or item.get('namespace')
            slug = item.get('urlSlug') or item.get('productSlug') or item.get('slug')
            key_images = item.get('keyImages') or []
            cover = None
            for img in key_images:
                if not isinstance(img, dict):
                    continue
                if (img.get('type') or '').lower() in (
                    'thumbnail', 'dieselgamesboxwide', 'offerimagesquare', 'offerimagetall',
                ):
                    cover = img.get('url')
                    if cover:
                        break
            if not cover and key_images and isinstance(key_images[0], dict):
                cover = key_images[0].get('url')
            results.append({
                'source': 'epic',
                'id': offer_id,
                'name': title,
                'url': f'https://store.epicgames.com/p/{slug}' if slug else None,
                'cover_url': cover,
                'summary': item.get('description'),
                'epic_id': offer_id,
                'slug': slug,
                'ownership_only': True,
            })
        return results
    except Exception as e:
        print(f"Epic search error for {game_name}: {e}")
        return []


def search_itch_games(game_name, limit=10):
    """Return itch.io search hits via public JSON when available (metadata only)."""
    try:
        clean_name = re.sub(r'[\(\)\[\]]', '', game_name or '').strip()
        if not clean_name:
            return []
        # Public browse JSON used by itch catalog pages (no API key).
        resp = request_with_backoff(
            'https://itch.io/games/ajax-search',
            host_key='itch',
            params={'q': clean_name},
            timeout=8,
            headers={'User-Agent': 'GameTheca/1.0 (self-hosted library)'},
        )
        if resp is None:
            return []
        payload = resp.json() if resp.content else {}
        games = (payload.get('games') or [])[:limit]
        results = []
        for game in games:
            if not isinstance(game, dict):
                continue
            game_id = game.get('id')
            title = game.get('title') or game.get('name')
            url = game.get('url') or game.get('link')
            cover = game.get('cover') or game.get('cover_url') or game.get('still_cover_url')
            results.append({
                'source': 'itch',
                'id': game_id,
                'name': title,
                'url': url,
                'cover_url': cover,
                'summary': game.get('short_text') or game.get('description'),
                'itch_id': game_id,
            })
        return results
    except Exception as e:
        print(f"itch.io search error for {game_name}: {e}")
        return []


def search_giantbomb_games(game_name, api_key=None, limit=10):
    """Return GiantBomb search hits for manual identify UI (requires API key)."""
    try:
        from gametheca.utils.providers.giantbomb import get_giantbomb_api_key

        key = (api_key or get_giantbomb_api_key() or '').strip()
        if not key:
            return []
        clean_name = re.sub(r'[\(\)\[\]]', '', game_name or '').strip()
        if not clean_name:
            return []
        resp = request_with_backoff(
            'https://www.giantbomb.com/api/search/',
            host_key='giantbomb',
            params={
                'api_key': key,
                'format': 'json',
                'query': clean_name,
                'resources': 'game',
                'limit': limit,
            },
            timeout=8,
            headers={'User-Agent': 'GameTheca/1.0 (self-hosted library)'},
        )
        if resp is None:
            return []
        results = []
        for item in (resp.json().get('results') or [])[:limit]:
            image = item.get('image') or {}
            results.append({
                'source': 'giantbomb',
                'id': item.get('id'),
                'name': item.get('name'),
                'url': item.get('site_detail_url'),
                'cover_url': image.get('super_url') or image.get('medium_url'),
                'summary': item.get('deck'),
                'giantbomb_id': item.get('id'),
            })
        return results
    except Exception as e:
        print(f"GiantBomb search error for {game_name}: {e}")
        return []


def search_meta_quest_games(game_name, limit=10):
    """Proxy to Meta/Quest IGDB platform search (metadata / ownership only)."""
    from gametheca.utils.providers.meta_quest import search_meta_quest_games as _search

    return _search(game_name, limit=limit)


def fetch_steam_data(game_name):
    """Query Steam Store API for complete game details."""
    try:
        clean_name = re.sub(r'[\(\)\[\]]', '', game_name)
        search_url = (
            f"https://store.steampowered.com/api/storesearch/"
            f"?term={requests.utils.quote(clean_name)}&l=english&cc=US"
        )
        resp = request_with_backoff(search_url, host_key='steam', timeout=5)
        if resp is None:
            return None

        data = resp.json()
        items = data.get('items') or []
        if not items:
            return None

        clean_lower = clean_name.strip().lower()
        exact = next(
            (item for item in items if (item.get('name') or '').strip().lower() == clean_lower),
            None,
        )
        app_id = (exact or items[0])['id']
        details_url = f"https://store.steampowered.com/api/appdetails?appids={app_id}"
        details_resp = request_with_backoff(details_url, host_key='steam', timeout=5)
        if details_resp is None:
            return None

        app_info = details_resp.json().get(str(app_id), {}).get('data', {})
        if not app_info:
            return None

        categories = [c.get('description', '') for c in app_info.get('categories', [])]
        genres = [g.get('description', '') for g in app_info.get('genres', [])]
        developers = app_info.get('developers', [])
        publishers = app_info.get('publishers', [])

        is_vr = categories_indicate_vr(categories)
        extracted_perspectives = steam_perspective_names(categories)

        return {
            'summary': app_info.get('short_description'),
            'genres': genres,
            'developer': developers[0] if developers else None,
            'publisher': publishers[0] if publishers else None,
            'player_perspectives': extracted_perspectives,
            'release_date': app_info.get('release_date', {}).get('date'),
            'cover_url': app_info.get('header_image'),
            'is_vr': is_vr,
            'steam_app_id': app_id,
        }
    except Exception as e:
        print(f"Steam API Metadata backfill error for {game_name}: {e}")
        return None


def fetch_rawg_data(game_name, api_key=None):
    """Query RAWG.io API for secondary backfill."""
    try:
        clean_name = re.sub(r'[\(\)\[\]]', '', game_name)
        params = {'search': clean_name, 'page_size': 1}
        if api_key:
            params['key'] = api_key

        resp = request_with_backoff("https://api.rawg.io/api/games", host_key='rawg', params=params, timeout=5)
        if resp is None:
            return None

        results = resp.json().get('results', [])
        if not results:
            return None

        game = results[0]
        genres = [g.get('name') for g in game.get('genres', [])]

        return {
            'summary': game.get('description_raw'),
            'rating': game.get('rating'),
            'genres': genres,
            'release_date': game.get('released'),
            'cover_url': game.get('background_image'),
        }
    except Exception as e:
        print(f"RAWG API Metadata backfill error for {game_name}: {e}")
        return None


def merge_metadata(primary, secondary):
    """
    Fills in ANY missing fields in primary metadata without overwriting existing data.
    """
    for key, val in secondary.items():
        if not val:
            continue

        if isinstance(val, list):
            existing_list = primary.setdefault(key, [])
            for item in val:
                normalized = (
                    normalize_perspective_name(item)
                    if key == 'player_perspectives'
                    else item
                )
                if normalized not in existing_list:
                    existing_list.append(normalized)
        elif not primary.get(key):
            primary[key] = val

    return primary


def apply_steam_enrichment_to_game(game, game_name, get_or_create_entity, fetch_steam=None):
    """
    Fetch Steam store data and attach missing player perspectives (including VR).

    get_or_create_entity(name=...) must return a perspective-like entity.
    Caller typically binds PlayerPerspective via game_core.get_or_create_entity.

    Returns a result dict:
      applied (bool), is_vr (bool), perspectives_added (list[str]), reason (str|None)
    """
    fetch = fetch_steam or fetch_steam_data
    steam_data = fetch(game_name)
    if not steam_data:
        return {
            'applied': False,
            'is_vr': False,
            'perspectives_added': [],
            'reason': 'no_steam_data',
        }

    is_vr = bool(steam_data.get('is_vr'))
    existing_names = {
        normalize_perspective_name(getattr(p, 'name', '') or '')
        for p in (game.player_perspectives or [])
    }

    perspectives_added = []
    perspective_names = [
        normalize_perspective_name(n)
        for n in (steam_data.get('player_perspectives') or [])
    ]

    for name in perspective_names:
        if not name or name in existing_names:
            continue
        entity = get_or_create_entity(name=name)
        game.player_perspectives.append(entity)
        existing_names.add(name)
        perspectives_added.append(name)

    if not getattr(game, 'summary', None) and steam_data.get('summary'):
        game.summary = steam_data['summary']

    return {
        'applied': True,
        'is_vr': is_vr or VR_PERSPECTIVE_NAME in perspectives_added or game_indicates_vr(game),
        'perspectives_added': perspectives_added,
        'reason': None,
        'steam_app_id': steam_data.get('steam_app_id'),
    }
