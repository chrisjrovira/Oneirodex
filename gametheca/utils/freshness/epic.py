"""Epic Games Store freshness (best-effort; public catalog is weak)."""

from __future__ import annotations

from gametheca.utils.http_retry import request_with_backoff


def fetch_epic_remote(*, slug: str | None = None, url: str | None = None) -> dict:
    """Epic has no stable public version API — record identity + probe catalog."""
    result = {
        'store': 'epic',
        'slug': slug,
        'url': url,
        'ok': False,
        'version': None,
        'name': None,
        'dlc_count': None,
        'supported': False,
        'error': None,
        'note': 'Epic public APIs do not expose reliable build/DLC lists; identity only.',
    }
    if not slug and not url:
        result['error'] = 'missing_epic_identity'
        return result

    # Best-effort GraphQL-less probe via store redirect page title is fragile;
    # try the unofficial catalog slug endpoint used by community tools.
    if slug:
        resp = request_with_backoff(
            f'https://store-content-ipv4.ak.epicgames.com/api/en-US/content/products/{slug}',
            host_key='epic',
            timeout=10,
        )
        if resp and resp.status_code == 200:
            try:
                data = resp.json()
                result['ok'] = True
                result['supported'] = False  # still no version/DLC contract
                pages = data.get('pages') or []
                if pages and isinstance(pages[0], dict):
                    result['name'] = pages[0].get('displayName') or pages[0].get('pageTitle')
                result['version'] = None
                result['note'] = (
                    'Epic product page found; version/DLC compare not available via public API.'
                )
                return result
            except ValueError:
                pass

    result['ok'] = True
    result['error'] = None
    result['note'] = (
        'Epic link recorded; version/DLC compare not supported yet (best-effort identity only).'
    )
    return result
