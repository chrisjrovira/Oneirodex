"""Request models for ``oneirodex/routes_apis/user.py``."""

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

# The hand-rolled check was ``if not username`` with no strip, so a
# whitespace-only name was accepted (and looked up as-is). Do not strip here.
_RequiredUsername = Annotated[str, StringConstraints(min_length=1)]


class CheckUsernameBody(BaseModel):
    """``POST /api/check_username``.

    Replaces ``if not username: return api_error('Missing username parameter')``.
    ``set_game_status`` is not modelled: empty ``status`` is a valid "clear"
    and unknown values stay a 400 in the view.
    """

    model_config = ConfigDict(extra='forbid')

    username: _RequiredUsername
