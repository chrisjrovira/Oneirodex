"""Steam Store helpers for App ID → title / type resolution."""

from __future__ import annotations

import requests


def fetch_steam_app_details(app_id: int, *, timeout: float = 5.0) -> dict | None:
    """
    Resolve a Steam App ID to store details (name, type, …).
    Returns None on any failure (network, missing app, unexpected payload).
    """
    if not app_id or not isinstance(app_id, int) or app_id <= 0:
        return None

    url = f'https://store.steampowered.com/api/appdetails?appids={app_id}&l=english'
    try:
        resp = requests.get(url, timeout=timeout)
        if resp.status_code != 200:
            return None
        payload = resp.json()
        entry = payload.get(str(app_id)) or {}
        if not entry.get('success'):
            return None
        data = entry.get('data') or {}
        name = data.get('name')
        if not isinstance(name, str) or not name.strip():
            return None
        steam_type = data.get('type')
        return {
            'steam_app_id': app_id,
            'name': name.strip(),
            'steam_type': (steam_type.strip().lower() if isinstance(steam_type, str) else None),
            'header_image': data.get('header_image'),
            'short_description': data.get('short_description'),
        }
    except (requests.RequestException, ValueError, TypeError, AttributeError):
        return None


def fetch_steam_title_by_app_id(app_id: int, *, timeout: float = 5.0) -> str | None:
    """
    Resolve a Steam App ID to its store title.
    Returns None on any failure (network, missing app, unexpected payload).
    """
    details = fetch_steam_app_details(app_id, timeout=timeout)
    return details.get('name') if details else None
