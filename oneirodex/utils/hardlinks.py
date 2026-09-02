"""Hardlink preview/apply helpers (same-volume only) + storage status probes."""

from __future__ import annotations

import os
from typing import Any


def probe_games_path(games_path: str | None) -> dict[str, Any]:
    """Honest existence/read/write probes for the configured games root.

    Read-only mounts (common on Unraid ``/storage:ro``) report
    ``games_writable=False`` without raising.
    """
    path = (games_path or '').strip()
    if not path:
        return {
            'games_path': '',
            'games_exists': False,
            'games_readable': False,
            'games_writable': False,
        }
    try:
        exists = os.path.exists(path)
    except OSError:
        exists = False
    readable = False
    writable = False
    if exists:
        try:
            readable = os.access(path, os.R_OK)
        except OSError:
            readable = False
        try:
            writable = os.access(path, os.W_OK)
        except OSError:
            writable = False
    return {
        'games_path': path,
        'games_exists': exists,
        'games_readable': readable,
        'games_writable': writable,
    }


def build_degrade_reason(
    *,
    helpers_enabled: bool,
    allow_apply: bool,
    games_writable: bool,
    games_exists: bool,
) -> str | None:
    """Short reason when helpers are on but apply is useless (gated and/or RO)."""
    if not helpers_enabled:
        return None
    parts: list[str] = []
    if not allow_apply:
        parts.append('Apply disabled (ALLOW_HARDLINK_APPLY=false)')
    if games_exists and not games_writable:
        parts.append('games path is read-only')
    elif not games_exists:
        parts.append('games path missing')
    if not parts:
        return None
    return '; '.join(parts)


def build_storage_status(
    *,
    helpers_enabled: bool,
    allow_apply: bool,
    games_path: str | None,
) -> dict[str, Any]:
    """Payload for ``GET /api/storage/status`` (admin Storage UI honesty)."""
    probe = probe_games_path(games_path)
    degrade = build_degrade_reason(
        helpers_enabled=helpers_enabled,
        allow_apply=allow_apply,
        games_writable=probe['games_writable'],
        games_exists=probe['games_exists'],
    )
    return {
        'helpers_enabled': bool(helpers_enabled),
        'allow_apply': bool(allow_apply),
        'games_path': probe['games_path'],
        'games_exists': probe['games_exists'],
        'games_readable': probe['games_readable'],
        'games_writable': probe['games_writable'],
        'degrade_reason': degrade,
    }


def preview_hardlink(source: str, dest: str) -> dict[str, Any]:
    reasons: list[str] = []
    source_path = os.path.abspath(source or '')
    dest_path = os.path.abspath(dest or '')
    bytes_saved = 0
    same_volume = False

    if not source_path or not dest_path:
        reasons.append('source and dest paths are required')
    if source_path and not os.path.isfile(source_path):
        reasons.append('source file does not exist')
    if dest_path and os.path.exists(dest_path):
        reasons.append('destination already exists')

    dest_parent = os.path.dirname(dest_path) if dest_path else ''
    if dest_parent and not os.path.isdir(dest_parent):
        reasons.append('destination parent directory does not exist')
    elif dest_parent and not os.access(dest_parent, os.W_OK):
        # Surface RO / not-writable dest clearly for admin preview UI.
        reasons.append('destination parent not writable (read-only mount?)')

    if source_path and os.path.isfile(source_path) and dest_parent and os.path.isdir(dest_parent):
        try:
            same_volume = os.stat(source_path).st_dev == os.stat(dest_parent).st_dev
        except OSError as exc:
            reasons.append(f'unable to compare volumes: {exc}')
            same_volume = False
        if not same_volume and 'unable to compare' not in ' '.join(reasons):
            reasons.append('source and destination are not on the same volume')
        try:
            bytes_saved = os.path.getsize(source_path)
        except OSError:
            bytes_saved = 0

    would_succeed = len(reasons) == 0
    return {
        'ok': would_succeed,
        'same_volume': same_volume,
        'would_succeed': would_succeed,
        'bytes_saved_estimate': bytes_saved if would_succeed or same_volume else 0,
        'reasons': reasons,
        'source': source_path,
        'dest': dest_path,
    }


def apply_hardlink(source: str, dest: str) -> dict[str, Any]:
    preview = preview_hardlink(source, dest)
    if not preview['would_succeed']:
        raise ValueError('; '.join(preview['reasons']) or 'hardlink preview failed')
    os.link(preview['source'], preview['dest'])
    return {**preview, 'applied': True}
