"""Hardlink preview/apply helpers (same-volume only)."""

from __future__ import annotations

import os
from typing import Any


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
        reasons.append('destination parent not writable')

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
