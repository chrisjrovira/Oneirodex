"""Request models for ``oneirodex/routes_apis/layouts.py``."""

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

_RequiredName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class CreateLayoutPresetBody(BaseModel):
    """``POST /api/layouts/detail/presets``.

    Replaces the helper's missing/blank-name ``ValueError`` and the
    ``Layout payload must be an object`` type check. Section-id validation and
    the 64-character name cap stay in ``save_layout_preset``.

    The PUT layout routes pass the whole JSON bag through to ``save_*`` and
    are not modelled — ``extra='forbid'`` would reject keys those helpers keep.
    """

    model_config = ConfigDict(extra='forbid')

    name: _RequiredName
    layout: dict
