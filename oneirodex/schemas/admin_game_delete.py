"""Request models for ``oneirodex/routes_admin_ext/game_delete.py``."""

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

# Historical check was ``if not game_uuid`` with no strip. A whitespace-only
# uuid was a 404 ("Game not found"), not a missing-field 400.
_RequiredUuid = Annotated[str, StringConstraints(min_length=1)]


class DeleteFullGameBody(BaseModel):
    """``POST /delete_full_game``.

    Replaces ``if not game_uuid: 400 "Game UUID is required."``. Folder
    delete is not modelled: its missing-path 400 carries ``body_status='error'``.
    """

    model_config = ConfigDict(extra='forbid')

    game_uuid: _RequiredUuid
