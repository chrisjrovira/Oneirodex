"""Request models for ``oneirodex/routes_apis/assists.py``."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AssistToggle(BaseModel):
    model_config = ConfigDict(extra='ignore')

    id: str = Field(min_length=1, max_length=64)
    label: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=500)


class OverlayLink(BaseModel):
    """One row of the companion overlay (INSP-45): a label and a *page* --
    a map, a guide, a clip, a wiki -- never a file, a memory address or a
    process. ``kind`` is a display hint."""

    model_config = ConfigDict(extra='forbid')

    label: str = Field(min_length=1, max_length=120)
    url: str = Field(min_length=8, max_length=2048)
    kind: Literal['map', 'guide', 'clip', 'wiki', 'other'] = 'other'

    @field_validator('url')
    @classmethod
    def _http_only(cls, value: str) -> str:
        text = value.strip()
        if not text.lower().startswith(('http://', 'https://')):
            raise ValueError('overlay links must be http(s) pages')
        return text


class AssistPackBody(BaseModel):
    """``PUT /api/games/<uuid>/assists`` (admin). ``policy`` is fixed
    server-side: single-player, offline only."""

    model_config = ConfigDict(extra='forbid')

    title: str | None = Field(default=None, max_length=200)
    toggles: list[AssistToggle] = Field(default_factory=list, max_length=64)
    overlay_links: list[OverlayLink] = Field(default_factory=list, max_length=32)
