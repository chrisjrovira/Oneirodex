"""Request models for ``oneirodex/routes_apis/storage.py``."""

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

_RequiredPath = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class HardlinkBody(BaseModel):
    """``POST /api/storage/hardlink/preview`` and ``.../apply``.

    Replaces ``if not source or not dest``. Feature-flag 403s stay in the view
    and therefore run after validation.
    """

    model_config = ConfigDict(extra='forbid')

    source: _RequiredPath
    dest: _RequiredPath
