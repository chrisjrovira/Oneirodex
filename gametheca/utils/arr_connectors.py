"""Optional *arr connectors: Prowlarr/Jackett search + qBittorrent add-url."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any
from urllib.parse import urljoin

import requests
from flask import current_app
from sqlalchemy import select

from gametheca import db
from gametheca.models import GlobalSettings

DEFAULT_TIMEOUT = 20


@dataclass
class ArrHit:
    title: str
    indexer: str | None = None
    size: int | None = None
    seeders: int | None = None
    download_url: str | None = None
    info_url: str | None = None
    protocol: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


def _settings() -> GlobalSettings | None:
    return db.session.execute(
        select(GlobalSettings).order_by(GlobalSettings.id).limit(1),
    ).scalars().first()


def get_arr_config() -> dict[str, Any]:
    row = _settings()
    cfg = getattr(row, 'arr_settings', None) if row else None
    if not isinstance(cfg, dict):
        cfg = {}
    return {
        'prowlarr_url': (cfg.get('prowlarr_url') or current_app.config.get('PROWLARR_URL') or '').rstrip('/'),
        'prowlarr_api_key': cfg.get('prowlarr_api_key') or current_app.config.get('PROWLARR_API_KEY') or '',
        'jackett_url': (cfg.get('jackett_url') or current_app.config.get('JACKETT_URL') or '').rstrip('/'),
        'jackett_api_key': cfg.get('jackett_api_key') or current_app.config.get('JACKETT_API_KEY') or '',
        'qbittorrent_url': (cfg.get('qbittorrent_url') or current_app.config.get('QBITTORRENT_URL') or '').rstrip('/'),
        'qbittorrent_username': cfg.get('qbittorrent_username') or current_app.config.get('QBITTORRENT_USERNAME') or 'admin',
        'qbittorrent_password': cfg.get('qbittorrent_password') or current_app.config.get('QBITTORRENT_PASSWORD') or '',
    }


def save_arr_config(payload: dict[str, Any]) -> dict[str, Any]:
    row = _settings()
    if not row:
        row = GlobalSettings()
        db.session.add(row)
    current = dict(get_arr_config())
    for key in (
        'prowlarr_url', 'prowlarr_api_key',
        'jackett_url', 'jackett_api_key',
        'qbittorrent_url', 'qbittorrent_username', 'qbittorrent_password',
    ):
        if key in payload and payload[key] is not None:
            current[key] = str(payload[key]).strip()
    row.arr_settings = current
    db.session.commit()
    return {**current, 'prowlarr_api_key': '***' if current.get('prowlarr_api_key') else '',
            'jackett_api_key': '***' if current.get('jackett_api_key') else '',
            'qbittorrent_password': '***' if current.get('qbittorrent_password') else ''}


def connector_status() -> list[dict[str, Any]]:
    cfg = get_arr_config()
    return [
        {
            'id': 'prowlarr',
            'configured': bool(cfg['prowlarr_url'] and cfg['prowlarr_api_key']),
            'url': cfg['prowlarr_url'] or None,
        },
        {
            'id': 'jackett',
            'configured': bool(cfg['jackett_url'] and cfg['jackett_api_key']),
            'url': cfg['jackett_url'] or None,
        },
        {
            'id': 'qbittorrent',
            'configured': bool(cfg['qbittorrent_url']),
            'url': cfg['qbittorrent_url'] or None,
        },
    ]


def search_indexers(query: str, *, limit: int = 25) -> list[ArrHit]:
    query = (query or '').strip()
    if not query:
        return []
    cfg = get_arr_config()
    hits: list[ArrHit] = []
    if cfg['prowlarr_url'] and cfg['prowlarr_api_key']:
        hits.extend(_search_prowlarr(cfg, query, limit=limit))
    elif cfg['jackett_url'] and cfg['jackett_api_key']:
        hits.extend(_search_jackett(cfg, query, limit=limit))
    return hits[:limit]


def _search_prowlarr(cfg: dict, query: str, *, limit: int) -> list[ArrHit]:
    url = urljoin(cfg['prowlarr_url'] + '/', 'api/v1/search')
    resp = requests.get(
        url,
        params={'query': query, 'type': 'search', 'limit': limit},
        headers={'X-Api-Key': cfg['prowlarr_api_key']},
        timeout=DEFAULT_TIMEOUT,
    )
    if resp.status_code >= 400:
        raise RuntimeError(f'Prowlarr search failed ({resp.status_code})')
    payload = resp.json()
    if not isinstance(payload, list):
        return []
    hits: list[ArrHit] = []
    for item in payload[:limit]:
        hits.append(ArrHit(
            title=str(item.get('title') or item.get('fileName') or 'Untitled'),
            indexer=item.get('indexer'),
            size=item.get('size'),
            seeders=item.get('seeders'),
            download_url=item.get('downloadUrl') or item.get('guid'),
            info_url=item.get('infoUrl'),
            protocol=item.get('protocol'),
        ))
    return hits


def _search_jackett(cfg: dict, query: str, *, limit: int) -> list[ArrHit]:
    url = urljoin(cfg['jackett_url'] + '/', 'api/v2.0/indexers/all/results')
    resp = requests.get(
        url,
        params={'apikey': cfg['jackett_api_key'], 'Query': query},
        timeout=DEFAULT_TIMEOUT,
    )
    if resp.status_code >= 400:
        raise RuntimeError(f'Jackett search failed ({resp.status_code})')
    payload = resp.json() if resp.content else {}
    results = payload.get('Results') if isinstance(payload, dict) else payload
    if not isinstance(results, list):
        return []
    hits: list[ArrHit] = []
    for item in results[:limit]:
        hits.append(ArrHit(
            title=str(item.get('Title') or 'Untitled'),
            indexer=item.get('Tracker'),
            size=item.get('Size'),
            seeders=item.get('Seeders'),
            download_url=item.get('Link') or item.get('MagnetUri'),
            info_url=item.get('Details'),
            protocol='torrent',
        ))
    return hits


def qbittorrent_add_url(download_url: str) -> dict[str, Any]:
    cfg = get_arr_config()
    if not cfg['qbittorrent_url']:
        raise RuntimeError('qBittorrent URL is not configured')
    if not download_url:
        raise ValueError('download_url is required')

    session = requests.Session()
    login = session.post(
        urljoin(cfg['qbittorrent_url'] + '/', 'api/v2/auth/login'),
        data={
            'username': cfg['qbittorrent_username'],
            'password': cfg['qbittorrent_password'],
        },
        timeout=DEFAULT_TIMEOUT,
    )
    if login.status_code >= 400 or (login.text or '').strip().lower() == 'fails.':
        raise RuntimeError('qBittorrent login failed')

    add = session.post(
        urljoin(cfg['qbittorrent_url'] + '/', 'api/v2/torrents/add'),
        data={'urls': download_url},
        timeout=DEFAULT_TIMEOUT,
    )
    if add.status_code >= 400:
        raise RuntimeError(f'qBittorrent add failed ({add.status_code})')
    return {'status': 'queued', 'download_url': download_url}
