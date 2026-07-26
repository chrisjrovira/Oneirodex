"""Acquire result scoring (Gamarr-inspired) and repack watch helpers."""

from __future__ import annotations

import re
from typing import Any


_REPACK_MARKERS = re.compile(
    r'\b(repack|fitgirl|dodi|kaos|gog|proper|repack\d*)\b',
    re.I,
)
_QUALITY_MARKERS = [
    (re.compile(r'\b(remaster|remastered)\b', re.I), 12),
    (re.compile(r'\b(goty|complete|deluxe|gold)\b', re.I), 10),
    (re.compile(r'\b(repack)\b', re.I), 8),
    (re.compile(r'\b(gog|drm[- ]?free)\b', re.I), 15),
    (re.compile(r'\b(multi\d*|lang)\b', re.I), 4),
    (re.compile(r'\b(crack|keygen)\b', re.I), -20),
]


def score_acquire_hit(hit: dict[str, Any], *, query: str = '') -> dict[str, Any]:
    """Return hit dict with score / reasons for Acquire ranking."""
    title = str(hit.get('title') or '')
    seeders = hit.get('seeders')
    size = hit.get('size')
    score = 0
    reasons: list[str] = []

    q = (query or '').strip().lower()
    if q and q in title.lower():
        score += 25
        reasons.append('title_match')

    if isinstance(seeders, int):
        bonus = min(30, max(0, seeders // 2))
        score += bonus
        if bonus:
            reasons.append(f'seeders+{bonus}')

    if isinstance(size, int) and size > 0:
        # Prefer mid-size packs over tiny incomplete dumps
        gib = size / (1024 ** 3)
        if 0.2 <= gib <= 80:
            score += 5
            reasons.append('size_ok')
        elif gib > 120:
            score -= 8
            reasons.append('size_huge')

    for pattern, points in _QUALITY_MARKERS:
        if pattern.search(title):
            score += points
            reasons.append(pattern.pattern.strip('\\b()'))

    out = dict(hit)
    out['score'] = score
    out['score_reasons'] = reasons
    out['is_repack'] = bool(_REPACK_MARKERS.search(title))
    return out


def rank_acquire_hits(hits: list[dict[str, Any]], *, query: str = '') -> list[dict[str, Any]]:
    scored = [score_acquire_hit(h, query=query) for h in hits]
    scored.sort(key=lambda row: (-int(row.get('score') or 0), str(row.get('title') or '')))
    return scored


def title_looks_like_newer_repack(candidate: str, current: str) -> bool:
    """Heuristic: candidate is a repack and differs from current library label."""
    cand = (candidate or '').strip()
    cur = (current or '').strip()
    if not cand or not cur:
        return False
    if cand.lower() == cur.lower():
        return False
    return bool(_REPACK_MARKERS.search(cand))
