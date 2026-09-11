"""Request models for ``oneirodex/routes_apis/tokens.py``."""

from __future__ import annotations

from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, StringConstraints

_RequiredName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class CreateApiTokenBody(BaseModel):
    """``POST /api/tokens``.

    Replaces ``name = (data.get('name') or '').strip(); if not name``.
    Unknown ``preset`` and role/scope denials stay in the view (400 / 403).
    ``scopes`` is a bare list so the view can still normalise entries.
    """

    model_config = ConfigDict(extra='forbid')

    name: _RequiredName
    preset: str | None = None
    scopes: list[Any] | None = None
