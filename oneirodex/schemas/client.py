"""Request models for ``oneirodex/routes_apis/client.py``.

Heartbeat mints a device id when omitted. Command enqueue is a bag of optional
fields whose missing ``game_uuid`` is 404. Ack/nack treat a missing ``ids`` as
``[]``. Only lifecycle POST has a type/presence guard.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict


class ClientLifecycleBody(BaseModel):
    """``POST /api/client/lifecycle``.

    Replaces ``if not isinstance(records, list)``. An empty list is valid.
    Companion-token / scope refusals live in the view and therefore run *after*
    validation (same ordering note as collections / Steam).
    """

    model_config = ConfigDict(extra='forbid')

    records: list[Any]
    replace: Any = False
