"""Helpers for serving static assets outside the WSGI bridge."""

from __future__ import annotations

from pathlib import Path


def resolve_static_path(static_root: Path, url_path: str) -> Path | None:
    """Resolve a /static/... URL to a file under static_root, or None if invalid."""
    if not url_path.startswith('/static/'):
        return None
    rel = url_path[len('/static/'):].lstrip('/')
    if not rel or '..' in rel.split('/'):
        return None
    root = static_root.resolve()
    candidate = (root / rel).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        return None
    return candidate
