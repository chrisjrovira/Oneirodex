"""Request models for ``oneirodex/routes_apis/game_mods_api.py``."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ModRowBody(BaseModel):
    """One tracked mod (``POST`` create, ``PUT``/``PATCH`` update).

    Every field is optional on the wire so a partial update stays partial;
    ``game_mods._normalize_mod_row`` fills the defaults. ``loader`` (INSP-36)
    is an open word -- suggested values in ``game_mods.LOADERS`` -- that the
    companion reads and never installs.
    """

    model_config = ConfigDict(extra='forbid')

    id: str | None = Field(default=None, max_length=128)
    name: str | None = Field(default=None, max_length=256)
    version: str | None = Field(default=None, max_length=64)
    source_url: str | None = Field(default=None, max_length=2048)
    url: str | None = Field(default=None, max_length=2048)
    notes: str | None = Field(default=None, max_length=4000)
    enabled: bool | None = None
    load_order: int | None = Field(default=None, ge=0, le=100000)
    loader: str | None = Field(default=None, max_length=64)
    requires: list[str] | None = Field(default=None, max_length=64)
    latest_seen_version: str | None = Field(default=None, max_length=64)

    def payload(self) -> dict[str, Any]:
        return self.model_dump(exclude_none=True)


class ModPackBulkBody(BaseModel):
    """``PUT /api/games/<uuid>/mods`` -- replace the list; ``default_loader``
    is kept when omitted."""

    model_config = ConfigDict(extra='forbid')

    mods: list[dict[str, Any]] = Field(default_factory=list, max_length=500)
    default_loader: str | None = Field(default=None, max_length=64)


class ModProfileBody(BaseModel):
    """``POST /api/games/<uuid>/mods/profiles`` (INSP-37). ``mod_ids`` omitted
    means "the rows enabled right now"."""

    model_config = ConfigDict(extra='forbid')

    name: str = Field(min_length=1, max_length=120)
    mod_ids: list[str] | None = Field(default=None, max_length=500)


class ModProfileImportBody(BaseModel):
    """``POST /api/games/<uuid>/mods/profiles/import`` -- an ``od-mod:`` code."""

    model_config = ConfigDict(extra='forbid')

    code: str = Field(min_length=8, max_length=70000)
    name: str | None = Field(default=None, max_length=120)


class ModPackBody(BaseModel):
    """``PATCH /api/games/<uuid>/mods/pack`` -- pack-level fields only."""

    model_config = ConfigDict(extra='forbid')

    default_loader: str | None = Field(default=None, max_length=64)
