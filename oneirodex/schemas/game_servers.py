"""Request models for ``oneirodex/routes_apis/game_servers.py``.

Update/PATCH only refuses an empty ``display_name`` when that key is present,
so it stays hand-rolled.
"""

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

_RequiredText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class CreateGameServerBody(BaseModel):
    """``POST /api/game-servers``.

    Replaces ``if not display_name or not connect_string``. Admin check is
    in-view, so it runs after validation.
    """

    model_config = ConfigDict(extra='forbid')

    display_name: _RequiredText
    connect_string: _RequiredText
    game_uuid: str | None = None
    health_url: str | None = None
    compose_project: str | None = None
    container_id: str | None = None
    invite_note: str | None = None
