"""Quality / release profile preferences (preferred groups, size band, blocklist)."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select

from gametheca import db
from gametheca.models import GlobalSettings

DEFAULT_PROFILE: dict[str, Any] = {
    'preferred_groups': [],
    'blocked_groups': [],
    'min_size_mb': None,
    'max_size_mb': None,
    'prefer_repack': True,
}


def get_quality_profile() -> dict[str, Any]:
    row = db.session.execute(
        select(GlobalSettings).order_by(GlobalSettings.id).limit(1),
    ).scalars().first()
    raw = getattr(row, 'quality_profiles', None) if row else None
    if not isinstance(raw, dict):
        return dict(DEFAULT_PROFILE)
    merged = dict(DEFAULT_PROFILE)
    for key in DEFAULT_PROFILE:
        if key in raw:
            merged[key] = raw[key]
    return merged


def save_quality_profile(payload: dict[str, Any]) -> dict[str, Any]:
    row = db.session.execute(
        select(GlobalSettings).order_by(GlobalSettings.id).limit(1),
    ).scalars().first()
    if not row:
        row = GlobalSettings()
        db.session.add(row)
    current = get_quality_profile()
    if 'preferred_groups' in payload:
        current['preferred_groups'] = [
            str(x).strip() for x in (payload.get('preferred_groups') or []) if str(x).strip()
        ]
    if 'blocked_groups' in payload:
        current['blocked_groups'] = [
            str(x).strip() for x in (payload.get('blocked_groups') or []) if str(x).strip()
        ]
    for key in ('min_size_mb', 'max_size_mb'):
        if key in payload:
            val = payload.get(key)
            if val is None or val == '':
                current[key] = None
            else:
                current[key] = float(val)
    if 'prefer_repack' in payload:
        current['prefer_repack'] = bool(payload['prefer_repack'])
    row.quality_profiles = current
    db.session.commit()
    return current


def score_release_title(title: str, *, size_bytes: int | None = None) -> dict[str, Any]:
    """Heuristic score for an indexer title against the quality profile."""
    profile = get_quality_profile()
    text = (title or '').lower()
    score = 0
    reasons: list[str] = []

    for group in profile.get('preferred_groups') or []:
        if group.lower() in text:
            score += 10
            reasons.append(f'preferred:{group}')
    for group in profile.get('blocked_groups') or []:
        if group.lower() in text:
            score -= 100
            reasons.append(f'blocked:{group}')
    if profile.get('prefer_repack') and ('repack' in text or 'proper' in text):
        score += 3
        reasons.append('repack_or_proper')

    size_mb = (size_bytes / (1024 * 1024)) if size_bytes else None
    min_mb = profile.get('min_size_mb')
    max_mb = profile.get('max_size_mb')
    if size_mb is not None:
        if min_mb is not None and size_mb < float(min_mb):
            score -= 20
            reasons.append('below_min_size')
        if max_mb is not None and size_mb > float(max_mb):
            score -= 20
            reasons.append('above_max_size')

    return {
        'title': title,
        'score': score,
        'reasons': reasons,
        'allowed': score > -50,
    }
