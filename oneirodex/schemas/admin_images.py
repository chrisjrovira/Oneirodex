"""Request models for ``oneirodex/routes_admin_ext/images.py``."""

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

_RequiredText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class ApplyCoverBody(BaseModel):
    """``POST /admin/api/covers/apply``.

    Replaces empty ``game_uuid`` / ``url`` 400s. Path-writable and apply
    helper errors stay in the view. Search and batch cover routes are not
    modelled (optional bags / partial-success).
    """

    model_config = ConfigDict(extra='forbid')

    game_uuid: _RequiredText
    url: _RequiredText
    provider: str | None = None


class GenerateArtworkBody(BaseModel):
    """``POST /admin/api/artwork/generate``.

    Replaces empty ``game_uuid`` 400. The ``ENABLE_AI_ARTWORK`` flag stays
    in the view; wrapping innermost means ``{}`` is 422 even when the
    feature is off. A well-formed body is still 403.
    """

    model_config = ConfigDict(extra='forbid')

    game_uuid: _RequiredText
    image_type: str | None = None
