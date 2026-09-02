"""GOG store freshness (public endpoints, best-effort)."""

from __future__ import annotations

from oneirodex.utils.http_retry import request_with_backoff


def fetch_gog_remote(*, product_id: str | None = None, slug: str | None = None) -> dict:
    result = {
        'store': 'gog',
        'product_id': product_id,
        'slug': slug,
        'ok': False,
        'version': None,
        'name': None,
        'dlc_count': None,
        'dlc_titles': [],
        'error': None,
    }
    if not product_id and not slug:
        result['error'] = 'missing_gog_identity'
        return result

    # Resolve slug → id via embed search when needed
    resolved_id = product_id
    if not resolved_id and slug:
        search = request_with_backoff(
            'https://embed.gog.com/games/ajax/filtered',
            host_key='gog',
            params={'mediaType': 'game', 'search': slug.replace('_', ' ')},
            timeout=10,
        )
        if search:
            try:
                products = search.json().get('products') or []
                for product in products:
                    if (product.get('slug') or '').lower() == slug.lower():
                        resolved_id = str(product.get('id'))
                        result['name'] = product.get('title')
                        break
                if not resolved_id and products:
                    resolved_id = str(products[0].get('id'))
                    result['name'] = products[0].get('title')
            except (ValueError, TypeError, KeyError, AttributeError):
                pass

    if not resolved_id:
        result['error'] = 'gog_id_unresolved'
        return result

    result['product_id'] = resolved_id
    resp = request_with_backoff(
        f'https://api.gog.com/products/{resolved_id}',
        host_key='gog',
        params={'expand': 'expanded_dlcs,downloads'},
        timeout=10,
    )
    if not resp:
        result['error'] = 'gog_product_failed'
        return result

    try:
        data = resp.json()
    except ValueError:
        result['error'] = 'invalid_json'
        return result

    result['ok'] = True
    result['name'] = data.get('title') or result.get('name')
    # GOG rarely exposes a clean build string on this endpoint; leave None for compare.
    result['version'] = None

    dlcs = data.get('expanded_dlcs') or data.get('dlcs') or []
    titles = []
    if isinstance(dlcs, list):
        for item in dlcs:
            if isinstance(item, dict):
                title = item.get('title') or item.get('name')
                if title:
                    titles.append(title)
            elif isinstance(item, (int, str)):
                titles.append(str(item))
    result['dlc_titles'] = titles[:100]
    result['dlc_count'] = len(titles)
    return result
