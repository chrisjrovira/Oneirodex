"""Request models for ``oneirodex/routes_apis/vr.py``."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class VrCompatBody(BaseModel):
    """``PATCH /api/games/<uuid>/vr_compat`` (rider R3, v11 H-T).

    One field, a closed vocabulary. ``null`` clears the stored value so the
    derived answer (VR perspective -> ``native_vr``, else unknown) applies
    again. Catalogue data only -- this never installs or points at a shim.
    """

    model_config = ConfigDict(extra='forbid')

    vr_compat: Literal['native_vr', 'injector_profile', 'flat'] | None


class VrProfileBody(BaseModel):
    """``PUT /api/games/<uuid>/vr_profiles/<kind>`` (INSP-40, v11 H3a).

    The kind is the path. ``profile_url`` is a *page* -- http(s) only, never a
    file path or a download -- and ``runtime`` the OpenXR / OpenVR side when
    known. Librarian-set rows are ``source=librarian``; a row copied from a
    community list says ``community``.
    """

    model_config = ConfigDict(extra='forbid')

    runtime: Literal['openxr', 'openvr'] | None = None
    profile_url: str | None = Field(default=None, max_length=2048)
    notes: str | None = Field(default=None, max_length=2000)
    source: Literal['librarian', 'community'] = 'librarian'

    @field_validator('profile_url')
    @classmethod
    def _http_only(cls, value: str | None) -> str | None:
        text = (value or '').strip()
        if not text:
            return None
        if not text.lower().startswith(('http://', 'https://')):
            raise ValueError('profile_url must be an http(s) page, never a file or a path')
        return text
