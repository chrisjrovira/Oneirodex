"""arr → hardlink pipeline: completed qBittorrent items → library hardlinks."""

from __future__ import annotations

import os
from typing import Any
from urllib.parse import urljoin

import requests
from flask import current_app

from gametheca.utils.arr_connectors import DEFAULT_TIMEOUT, get_arr_config
from gametheca.utils.event_logging import log_system_event
from gametheca.utils.hardlinks import apply_hardlink, preview_hardlink
from gametheca.utils.security import get_allowed_base_directories, is_safe_path


def pipeline_enabled() -> bool:
    return str(current_app.config.get('ENABLE_ARR_HARDLINK_PIPELINE', '')).lower() in (
        '1', 'true', 'yes', 'on',
    )


def hardlink_helpers_enabled() -> bool:
    return str(current_app.config.get('ENABLE_HARDLINK_HELPERS', '')).lower() in (
        '1', 'true', 'yes', 'on',
    )


def hardlink_apply_allowed() -> bool:
    return hardlink_helpers_enabled() and str(
        current_app.config.get('ALLOW_HARDLINK_APPLY', ''),
    ).lower() in ('1', 'true', 'yes', 'on')


def _qb_session() -> tuple[requests.Session, dict[str, Any]]:
    cfg = get_arr_config()
    if not cfg['qbittorrent_url']:
        raise RuntimeError('qBittorrent URL is not configured')
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
    return session, cfg


def list_completed_torrents(*, limit: int = 50) -> list[dict[str, Any]]:
    """Return completed torrents with content paths from qBittorrent."""
    session, cfg = _qb_session()
    resp = session.get(
        urljoin(cfg['qbittorrent_url'] + '/', 'api/v2/torrents/info'),
        params={'filter': 'completed'},
        timeout=DEFAULT_TIMEOUT,
    )
    if resp.status_code >= 400:
        raise RuntimeError(f'qBittorrent torrents/info failed ({resp.status_code})')
    rows = resp.json() if resp.content else []
    if not isinstance(rows, list):
        return []
    out: list[dict[str, Any]] = []
    for item in rows[: max(1, min(limit, 200))]:
        content_path = (item.get('content_path') or item.get('save_path') or '').strip()
        name = (item.get('name') or '').strip() or os.path.basename(content_path) or 'torrent'
        out.append({
            'hash': item.get('hash'),
            'name': name,
            'content_path': content_path,
            'save_path': item.get('save_path'),
            'size': item.get('size') or item.get('total_size'),
            'progress': item.get('progress'),
        })
    return out


def _pick_source_file(content_path: str) -> str | None:
    """If path is a file use it; if directory, pick the largest file (one level deep + walk)."""
    path = os.path.abspath(content_path or '')
    if not path:
        return None
    if os.path.isfile(path):
        return path
    if not os.path.isdir(path):
        return None
    best = None
    best_size = -1
    for root, _dirs, files in os.walk(path):
        for fname in files:
            full = os.path.join(root, fname)
            try:
                size = os.path.getsize(full)
            except OSError:
                continue
            if size > best_size:
                best_size = size
                best = full
        # Prefer shallow large files; still walk fully for correctness
    return best


def propose_hardlinks(
    library_dest_dir: str,
    *,
    limit: int = 50,
    torrents: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Preview hardlinks from completed torrents into a library destination directory."""
    if not pipeline_enabled():
        raise PermissionError('Arr→hardlink pipeline is disabled')
    if not hardlink_helpers_enabled():
        raise PermissionError('Hardlink helpers are disabled')

    dest_dir = os.path.abspath((library_dest_dir or '').strip())
    if not dest_dir or not os.path.isdir(dest_dir):
        raise ValueError('library_dest_dir must be an existing directory')

    bases = get_allowed_base_directories(current_app)
    ok_d, err_d = is_safe_path(dest_dir, bases)
    if not ok_d:
        raise PermissionError(err_d or 'Unsafe destination directory')

    items = torrents if torrents is not None else list_completed_torrents(limit=limit)
    proposals: list[dict[str, Any]] = []
    for item in items:
        source = _pick_source_file(item.get('content_path') or '')
        if not source:
            proposals.append({
                **item,
                'source': None,
                'dest': None,
                'preview': {'ok': False, 'would_succeed': False, 'reasons': ['no source file found']},
            })
            continue
        ok_s, err_s = is_safe_path(source, bases)
        if not ok_s:
            proposals.append({
                **item,
                'source': source,
                'dest': None,
                'preview': {'ok': False, 'would_succeed': False, 'reasons': [err_s or 'Unsafe source']},
            })
            continue
        dest = os.path.join(dest_dir, os.path.basename(source))
        preview = preview_hardlink(source, dest)
        proposals.append({
            **item,
            'source': source,
            'dest': dest,
            'preview': preview,
        })
    return {
        'library_dest_dir': dest_dir,
        'apply_allowed': hardlink_apply_allowed(),
        'count': len(proposals),
        'proposals': proposals,
    }


def apply_proposals(
    proposals: list[dict[str, Any]],
    *,
    only_ok: bool = True,
) -> dict[str, Any]:
    if not pipeline_enabled():
        raise PermissionError('Arr→hardlink pipeline is disabled')
    if not hardlink_apply_allowed():
        raise PermissionError(
            'Hardlink apply is disabled. Set ALLOW_HARDLINK_APPLY=true '
            '(and ENABLE_HARDLINK_HELPERS / ENABLE_ARR_HARDLINK_PIPELINE).',
        )
    applied: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    bases = get_allowed_base_directories(current_app)

    for item in proposals:
        source = (item.get('source') or '').strip()
        dest = (item.get('dest') or '').strip()
        if not source or not dest:
            skipped.append({**item, 'reason': 'missing source/dest'})
            continue
        preview = item.get('preview') or preview_hardlink(source, dest)
        if only_ok and not preview.get('would_succeed'):
            skipped.append({**item, 'reason': 'preview would not succeed', 'preview': preview})
            continue
        ok_s, err_s = is_safe_path(source, bases)
        ok_d, err_d = is_safe_path(dest, bases)
        if not ok_s or not ok_d:
            errors.append({**item, 'error': err_s or err_d or 'Unsafe path'})
            continue
        try:
            result = apply_hardlink(source, dest)
            applied.append(result)
            try:
                log_system_event(
                    f'Arr hardlink: {source} -> {dest}',
                    event_type='audit',
                    event_level='information',
                )
            except Exception:
                pass
        except (ValueError, OSError) as exc:
            errors.append({**item, 'error': str(exc)})

    return {
        'applied_count': len(applied),
        'skipped_count': len(skipped),
        'error_count': len(errors),
        'applied': applied,
        'skipped': skipped,
        'errors': errors,
    }
