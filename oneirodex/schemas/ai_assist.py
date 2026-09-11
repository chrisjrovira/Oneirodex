"""Request models for ``oneirodex/routes_apis/ai_assist.py``."""

from __future__ import annotations

from typing import Annotated, Self

from pydantic import BaseModel, ConfigDict, StringConstraints, model_validator

_RequiredUuid = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class ApplyTriageBody(BaseModel):
    """``POST /api/ai/apply-triage``.

    Replaces empty ``game_uuid`` / ``title`` (``name`` alias) ``ValueError``
    400s from ``apply_triage_title``. The auto-apply feature flag stays in
    the view. ``GET+PUT /ai/config`` shares one view and is not modelled.
    """

    model_config = ConfigDict(extra='forbid')

    game_uuid: _RequiredUuid
    title: str | None = None
    name: str | None = None

    @model_validator(mode='after')
    def require_title_or_name(self) -> Self:
        if not (self.title or self.name or '').strip():
            raise ValueError('title is required')
        return self
