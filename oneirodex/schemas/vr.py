"""Request models for ``oneirodex/routes_apis/vr.py``."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict


class VrCompatBody(BaseModel):
    """``PATCH /api/games/<uuid>/vr_compat`` (rider R3, v11 H-T).

    One field, a closed vocabulary. ``null`` clears the stored value so the
    derived answer (VR perspective -> ``native_vr``, else unknown) applies
    again. Catalogue data only -- this never installs or points at a shim.
    """

    model_config = ConfigDict(extra='forbid')

    vr_compat: Literal['native_vr', 'injector_profile', 'flat'] | None
