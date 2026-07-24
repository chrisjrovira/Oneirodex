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


def resolve_cover_url(cover_image):
    """Return a browser-usable cover URL for an Image row (or default).

    Prefer a local static file when it is downloaded *and present on disk*.
    Otherwise prefer the remote download_url / http url. Never point at a
    missing local path (that yields blank tiles with no recoverable image).
    """
    default = _default_cover_url()
    if not cover_image or not getattr(cover_image, 'url', None):
        return default

    url = _normalize_remote_url(cover_image.url)
    download_url = _normalize_remote_url(getattr(cover_image, 'download_url', None) or '')
    is_downloaded = bool(getattr(cover_image, 'is_downloaded', False))

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
    if is_downloaded and _local_cover_exists(url):
        return url_for('static', filename=f"library/images/{url.lstrip('/')}")

    if download_url.startswith(('http://', 'https://')):
        return download_url

    return default
