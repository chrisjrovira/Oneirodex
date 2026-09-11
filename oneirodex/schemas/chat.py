"""Request models for ``oneirodex/routes_apis/chat.py``.

Only ``POST .../mute`` has a presence guard. Channel create, DMs, message
post and reactions either accept empty values and raise in the helper, or
(DM) treat a missing peer as opaque 404.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class MuteChannelBody(BaseModel):
    """``POST /api/chat/channels/<id>/mute``.

    Replaces ``if 'muted' not in data``. ``false`` is a real value — the key
    must be present, not truthy.
    """

    model_config = ConfigDict(extra='forbid')

    muted: bool
