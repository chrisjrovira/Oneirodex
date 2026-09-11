"""Request models for ``oneirodex/routes_apis/playtime.py``."""

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

_RequiredUuid = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class StartPlaytimeSessionBody(BaseModel):
    """``POST /api/playtime/sessions``.

    Replaces ``game_uuid = (data.get('game_uuid') or '').strip(); if not``.
    ``client`` stays optional — the view passes it through to ``start_session``.
    """

    model_config = ConfigDict(extra='forbid')

    game_uuid: _RequiredUuid
    client: str | None = None
