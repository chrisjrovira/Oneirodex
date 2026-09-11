"""Request models for ``oneirodex/routes_apis/wanted.py``."""

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

_RequiredUuid = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class AddWantedBody(BaseModel):
    """``POST /api/updates/wanted``.

    Replaces the empty-uuid fall-through to ``404 Game not found``.
    """

    model_config = ConfigDict(extra='forbid')

    game_uuid: _RequiredUuid
    kind: str | None = None
    label: str | None = None
    store: str | None = None
    store_id: str | None = None


class FulfillWantedBody(BaseModel):
    """``POST /api/updates/wanted/fulfill``.

    Replaces ``if not game_uuid: 400 "game_uuid is required"``.
    """

    model_config = ConfigDict(extra='forbid')

    game_uuid: _RequiredUuid
    kind: str | None = None
