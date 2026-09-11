"""Request models for ``oneirodex/routes_apis/quality_stats.py``.

Create / PUT / PATCH pass the JSON bag through to the profile helpers, so
``extra='forbid'`` would break them. ``set_active`` takes ``id`` / ``active_id``
/ ``profile_id`` aliases. Only the score probe has a real required field.
"""

from __future__ import annotations

from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, StringConstraints

_RequiredTitle = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class ScoreReleaseBody(BaseModel):
    """``POST /api/quality-profiles/score``.

    Replaces ``title = (data.get('title') or '').strip(); if not title``.
    ``id`` is the same fallback the view already accepted next to ``profile_id``.
    """

    model_config = ConfigDict(extra='forbid')

    title: _RequiredTitle
    size_bytes: Any = None
    profile_id: str | None = None
    id: str | None = None
