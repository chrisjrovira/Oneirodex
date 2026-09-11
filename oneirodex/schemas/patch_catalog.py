"""Request models for ``oneirodex/routes_apis/patch_catalog.py``."""

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

_RequiredText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class AttachPatchGuideBody(BaseModel):
    """``POST /api/patch-catalog/attach``.

    Replaces empty ``game_uuid`` falling through to 404 and the helper's
    missing ``source_url`` ``ValueError``. The http(s) scheme check stays in
    ``attach_patch_guide``. Search ``q`` is a query argument, not JSON.
    """

    model_config = ConfigDict(extra='forbid')

    game_uuid: _RequiredText
    source_url: _RequiredText
    notes: str | None = None
    target_language: str | None = None
    patch_format: str | None = None
