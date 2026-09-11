"""Request models for ``oneirodex/routes_apis/wishlist.py``."""

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

_RequiredText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class CreateWishlistRequestBody(BaseModel):
    """``POST /api/requests``.

    Replaces ``title = (data.get('title') or '').strip(); if not title``.
    Truncation to ``GameRequest.title`` (255) and notes cap stay in the view.
    """

    model_config = ConfigDict(extra='forbid')

    title: _RequiredText
    notes: str | None = None


class ResolveWishlistRequestBody(BaseModel):
    """``PATCH /api/requests/<id>``.

    Presence of ``status`` only. Membership in ``VALID_RESOLVE_STATUSES`` stays
    in the view so an unknown value keeps the existing 400 sentence.
    """

    model_config = ConfigDict(extra='forbid')

    status: _RequiredText
    linked_game_uuid: str | None = None
    notes: str | None = None
