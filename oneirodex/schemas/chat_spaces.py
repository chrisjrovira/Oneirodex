"""Request models for ``oneirodex/routes_apis/chat_spaces_api.py``.

Only ``POST .../members`` has a required-field guard. Space/channel create
defer empty names to the helper; invite expiry parsing and invite-token
redeem stay in the view.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class AddSpaceMemberBody(BaseModel):
    """``POST /api/chat/spaces/<id>/members``.

    Replaces ``if not user_id``. ``gt=0`` keeps the old ``if not user_id``
    refusal of ``0`` as a 422 naming the field.
    """

    model_config = ConfigDict(extra='forbid')

    user_id: int = Field(gt=0)
    role: str | None = None
