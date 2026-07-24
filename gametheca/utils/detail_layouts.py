"""Game details section layout (order + visibility)."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select

from gametheca import db
from gametheca.models import GlobalSettings

DEFAULT_SECTIONS: list[str] = [
    'hero',
    'actions',
    'summary',
    'metadata',
    'screenshots',
    'videos',
    'downloads',
    'updates',
    'extras',
    'playtime',
    'related',
]


def _default_layout() -> dict[str, Any]:
    return {
        'sections': [{'id': sid, 'visible': True} for sid in DEFAULT_SECTIONS],
    }


def merge_with_defaults(raw: dict | None) -> dict[str, Any]:
    sections: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in (raw or {}).get('sections') or []:
        if not isinstance(item, dict):
            continue
        sid = item.get('id')
        if sid in DEFAULT_SECTIONS and sid not in seen:
            sections.append({'id': sid, 'visible': bool(item.get('visible', True))})
            seen.add(sid)
    for sid in DEFAULT_SECTIONS:
        if sid not in seen:
            sections.append({'id': sid, 'visible': True})
    return {'sections': sections}


def validate_layout_payload(payload: dict | None) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError('Layout payload must be an object')
    raw_sections = payload.get('sections')
    if raw_sections is None or raw_sections == []:
        return _default_layout()
    if not isinstance(raw_sections, list):
        raise ValueError('sections must be a list')
    for item in raw_sections:
        if not isinstance(item, dict) or item.get('id') not in DEFAULT_SECTIONS:
            raise ValueError(f"Unknown or invalid section id: {item!r}")
    return merge_with_defaults(payload)


def get_detail_layout() -> dict[str, Any]:
    row = db.session.execute(
        select(GlobalSettings).order_by(GlobalSettings.id).limit(1),
    ).scalars().first()
    raw = getattr(row, 'detail_layout', None) if row else None
    return merge_with_defaults(raw if isinstance(raw, dict) else None)


def save_detail_layout(payload: dict | None) -> dict[str, Any]:
    validated = validate_layout_payload(payload)
    row = db.session.execute(
        select(GlobalSettings).order_by(GlobalSettings.id).limit(1),
    ).scalars().first()
    if not row:
        row = GlobalSettings()
        db.session.add(row)
    row.detail_layout = validated
    db.session.commit()
    return validated


def layout_helpers(layout: dict[str, Any] | None = None) -> dict[str, Any]:
    """Template helpers: order index and visibility map."""
    data = layout or get_detail_layout()
    order: dict[str, int] = {}
    visible: dict[str, bool] = {}
    for index, item in enumerate(data.get('sections') or []):
        sid = item['id']
        order[sid] = index
        visible[sid] = bool(item.get('visible', True))
    return {'layout_order': order, 'layout_visible': visible, 'detail_layout': data}
