"""Request models for ``oneirodex/routes_admin_ext/game_images.py``."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict


class DeleteGameImageBody(BaseModel):
    """``POST /delete_image``.

    Replaces ``if not data or 'image_id' not in data``. ``image_id`` is
    untyped because the admin theme JS may post a number or a string, and
    ``db.session.get(Image, ...)`` already accepted both. ``is_cover`` stays
    optional; a missing key still defaults false.
    """

    model_config = ConfigDict(extra='forbid')

    image_id: Any
    is_cover: Any = False
