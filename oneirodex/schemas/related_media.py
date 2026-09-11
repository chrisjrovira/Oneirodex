"""Request models for ``oneirodex/routes_apis/related_media.py``."""

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

_RequiredTitle = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class CreateRelatedMediaBody(BaseModel):
    """``POST /api/games/<uuid>/related_media``.

    Replaces blank-title ``400 "A title is required"``. ``media_kind`` /
    ``relation`` membership, URL hygiene, and year parsing stay in the view so
    those refusals keep their existing sentences.
    """

    model_config = ConfigDict(extra='forbid')

    title: _RequiredTitle
    media_kind: str | None = None
    relation: str | None = None
    creator: str | None = None
    year: int | str | None = None
    summary: str | None = None
    external_url: str | None = None
    cover_url: str | None = None
    display_order: int | str | None = None
