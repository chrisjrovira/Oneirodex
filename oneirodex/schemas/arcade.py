"""Request models for the arcade launch profile (INSP-43, v11 H4b)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict


class InputFamilyBody(BaseModel):
    """``PATCH /api/games/<uuid>/input_family``.

    One field, a closed vocabulary; ``null`` clears it back to unknown. It
    describes how the cabinet was driven so the companion can pick a matching
    RetroArch remap -- it never points at a ROM, a set or a file.
    """

    model_config = ConfigDict(extra='forbid')

    input_family: Literal['joystick', 'spinner', 'lightgun', 'trackball'] | None
