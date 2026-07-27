"""Steam store freshness (public endpoints)."""

from __future__ import annotations

from gametheca.utils.http_retry import request_with_backoff


def fetch_steam_remote(app_id: int) -> dict:
    """Return version-ish facts + DLC list for a Steam app."""
    result = {
        'store': 'steam',
        'app_id': app_id,
        'ok': False,
        'version': None,
        'name': None,
        'release_date': None,
        'last_news_date': None,
        'dlc_ids': [],
        'dlc_count': 0,
        'error': None,
    }
    if not app_id:
        result['error'] = 'missing_app_id'
        return result

    resp = request_with_backoff(
        'https://store.steampowered.com/api/appdetails',
        host_key='steam',
        params={'appids': app_id, 'l': 'english'},
        timeout=10,
    )
    if not resp:
        result['error'] = 'appdetails_failed'
        return result

    try:
        payload = resp.json().get(str(app_id)) or {}
    except ValueError:
        result['error'] = 'invalid_json'
        return result

    if not payload.get('success'):
        result['error'] = 'app_not_found'
        return result

    data = payload.get('data') or {}
    result['ok'] = True
    result['name'] = data.get('name')
    release = (data.get('release_date') or {}).get('date')
    result['release_date'] = release
    # Steam store has no stable "build version"; use release date as weak version signal.
    result['version'] = release
    dlc_ids = data.get('dlc') or []
    result['dlc_ids'] = [int(x) for x in dlc_ids if str(x).isdigit()][:200]
    result['dlc_count'] = len(result['dlc_ids'])

    news = request_with_backoff(
        'https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/',
        host_key='steam',
        params={'appid': app_id, 'count': 1, 'maxlength': 1},
        timeout=10,
    )
    if news:
        try:
            items = ((news.json().get('appnews') or {}).get('newsitems') or [])
            if items:
                # date is unix seconds
                ts = items[0].get('date')
                if ts:
                    from datetime import datetime, timezone
                    result['last_news_date'] = datetime.fromtimestamp(
                        int(ts), tz=timezone.utc
                    ).isoformat()
        except (ValueError, TypeError, KeyError):
            pass

    return result
