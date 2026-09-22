"""Request models for ``oneirodex/routes_apis/ownership.py``.

Only the routes with a genuine required-field check are modelled here. The
``connect_gog`` / ``connect_epic`` / ``connect_amazon`` routes take a bag of
optional, aliased fields with no rejection path, and the ``*/csv`` routes read
form-data or a file upload as well as JSON — none of those fit ``@validate_body``
and none are migrated (see docs/dev/pydantic-adoption.md).
"""

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

_RequiredSteamId = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class ConnectSteamBody(BaseModel):
    """``POST /api/ownership/steam``.

    Replaces ``steam_id = (data.get('steam_id') or '').strip(); if not steam_id``.
    ``connect_steam_account`` still raises ``ValueError`` for a malformed id and
    the view still turns that into ``code='bad_request'``.
    """

    model_config = ConfigDict(extra='forbid')

    steam_id: _RequiredSteamId


class XboxConnectBody(BaseModel):
    """``POST /api/ownership/xbox`` (INSP-42). The credential is the JSON the
    unofficial client's own ``xbox-authenticate`` wrote; stored on the member's
    account, never logged. Register-only."""

    model_config = ConfigDict(extra='forbid')

    xuid: str | None = Field(default=None, max_length=64)
    note: str | None = Field(default=None, max_length=120)
    credential: str | dict | None = None


class PsnConnectBody(BaseModel):
    """``POST /api/ownership/psn`` (INSP-42). ``npsso`` is the member's own
    session token; stored on their account, never logged. Register-only."""

    model_config = ConfigDict(extra='forbid')

    online_id: str | None = Field(default=None, max_length=64)
    note: str | None = Field(default=None, max_length=120)
    npsso: str | None = Field(default=None, max_length=256)
