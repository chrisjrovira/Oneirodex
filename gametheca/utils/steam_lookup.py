"""Steam Store helpers for App ID → title resolution."""

from __future__ import annotations

import requests


def fetch_steam_title_by_app_id(app_id: int, *, timeout: float = 5.0) -> str | None:
    """
    Resolve a Steam App ID to its store title.
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
        return name.strip() if isinstance(name, str) and name.strip() else None
    except (requests.RequestException, ValueError, TypeError, AttributeError):
        return None
