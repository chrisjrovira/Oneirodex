"""Request models for ``oneirodex/routes_apis/quality_stats.py``.

Create / PUT / PATCH pass the JSON bag through to the profile helpers, so
those stay unwrapped. ``set_active`` aliases are modelled below.
"""

from __future__ import annotations

from typing import Annotated, Any, Self

from pydantic import BaseModel, ConfigDict, StringConstraints, model_validator

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


class SetActiveQualityProfileBody(BaseModel):
    """``PUT/POST /api/quality-profiles/active``.

    Replaces ``(id or active_id or profile_id or '').strip(); if not: 400``.
    Do not strip the fields themselves — whitespace-only ``id`` does not
    fall through to ``active_id``, matching the hand-rolled ``or``.
    """

    model_config = ConfigDict(extra='forbid')

    id: str | None = None
    active_id: str | None = None
    profile_id: str | None = None

    @model_validator(mode='after')
    def require_id_alias(self) -> Self:
        if not (self.id or self.active_id or self.profile_id or '').strip():
            raise ValueError('id is required')
        return self
