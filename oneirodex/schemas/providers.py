"""Request models for ``oneirodex/routes_apis/providers.py``."""

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

_RequiredUrl = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class ApplyArtworkBody(BaseModel):
    """``POST /api/games/<uuid>/artwork/steamgriddb``.

    Replaces ``image_url = (data.get('url') or '').strip()`` with a required
    non-empty ``url``. The http(s) scheme check, provider allow-list, and
    ``image_type`` taxonomy stay in the view / ``apply_cover_from_url``.
    ``kind`` is the documented alias for ``image_type``.
    """

    model_config = ConfigDict(extra='forbid')

    url: _RequiredUrl
    provider: str | None = None
    image_type: str | None = None
    kind: str | None = None
