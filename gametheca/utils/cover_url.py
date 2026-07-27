"""Resolve game cover URLs for browse/favorites/discover JSON payloads."""

import os

from flask import current_app, url_for


DEFAULT_COVER_STATIC = 'newstyle/default_cover.jpg'


def _default_cover_url():
    return url_for('static', filename=DEFAULT_COVER_STATIC)


def _normalize_remote_url(url):
    """Turn IGDB protocol-relative URLs into absolute https URLs."""
    if not url:
        return ''
    url = url.strip()
    if url.startswith('//'):
        return f'https:{url}'
    return url


def _local_cover_path(filename):
    static_folder = current_app.static_folder or ''
    return os.path.join(static_folder, 'library', 'images', filename.lstrip('/\\'))


def _local_cover_exists(filename):
    if not filename:
        return False
    try:
        return os.path.isfile(_local_cover_path(filename))
    except OSError:
        return False


def _resolve_from_parts(url, download_url, is_downloaded):
    """Resolve a browser-usable URL from primary + remote fallback parts."""
    default = _default_cover_url()
    url = _normalize_remote_url(url)
    download_url = _normalize_remote_url(download_url)

    if not url and not download_url:
        return default

    if url.startswith(('http://', 'https://')):
        return url

    if url.startswith('/static/'):
        # Already an app-static path — only trust it if the file exists when
        # it points at library images; otherwise fall back.
        if '/library/images/' in url:
            filename = url.split('/library/images/', 1)[-1]
            if _local_cover_exists(filename):
                return url
            if download_url.startswith(('http://', 'https://')):
                return download_url
            return default
        return url

    # Local library filename (normal Image.url shape)
    if url and is_downloaded and _local_cover_exists(url):
        return url_for('static', filename=f"library/images/{url.lstrip('/')}")

    if download_url.startswith(('http://', 'https://')):
        return download_url

    # Bare IGDB-ish host path without scheme
    if url.startswith('images.igdb.com/') or url.startswith('www.igdb.com/'):
        return f'https://{url}'

    return default


def resolve_cover_url(cover_image):
    """Return a browser-usable cover URL for an Image row, string path, or default.

    Prefer a local static file when it is downloaded *and present on disk*.
    Otherwise prefer the remote download_url / http url. Never point at a
    missing local path (that yields blank tiles with no recoverable image).

    Also accepts a plain string (legacy ``Game.cover`` column / absolute URL).
    Empty ``Image.url`` with a remote ``download_url`` still resolves remotely.
    """
    default = _default_cover_url()

    if isinstance(cover_image, str):
        return _resolve_from_parts(cover_image, '', False)

    if not cover_image:
        return default

    url = getattr(cover_image, 'url', None) or ''
    download_url = getattr(cover_image, 'download_url', None) or ''
    is_downloaded = bool(getattr(cover_image, 'is_downloaded', False))
    return _resolve_from_parts(url, download_url, is_downloaded)


def resolve_game_cover_url(game, cover_image=None):
    """Resolve cover for a game, falling back to legacy ``Game.cover`` string."""
    primary = resolve_cover_url(cover_image)
    default = _default_cover_url()
    if primary != default:
        return primary
    legacy = getattr(game, 'cover', None) if game is not None else None
    if legacy:
        return resolve_cover_url(legacy)
    return default
