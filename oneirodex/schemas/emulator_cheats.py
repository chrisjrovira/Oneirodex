"""Request models for ``oneirodex/routes_apis/emulator_cheats.py``.

``.cht`` create also accepts a file upload, and firmware import falls back to
``BIOS_IMPORT_SOURCE``, so those stay hand-rolled. Only the PC-cheat note
create has a JSON presence guard.
"""

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

_RequiredLabel = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class CreatePcCheatBody(BaseModel):
    """``POST /api/games/<uuid>/pc_cheats``.

    Replaces ``label = (data.get('label') or '').strip(); if not label``.
    ``method`` membership stays in the view so an unknown value keeps its
    existing 400 sentence.
    """

    model_config = ConfigDict(extra='forbid')

    label: _RequiredLabel
    method: str | None = None
    payload: str | None = None
    notes: str | None = None
    single_player_only: bool = True
