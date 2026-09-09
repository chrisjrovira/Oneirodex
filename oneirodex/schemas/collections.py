"""Request models for ``oneirodex/routes_apis/collections.py``."""

from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

# A name that is only whitespace is "no name" — the hand-rolled check did
# ``(data.get('name') or '').strip()`` then ``if not name``. strip_whitespace
# reproduces that, and the stripped value is what the view stored anyway.
_RequiredName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
_RequiredUuid = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class CreateCollectionBody(BaseModel):
    """``POST /api/collections``."""

    model_config = ConfigDict(extra='forbid')

    name: _RequiredName
    # The view still does ``(description or '')[:4000] or None``; the model only
    # guarantees the type. Not stripped — the pre-pydantic create path did not
    # strip it either.
    description: str | None = None
    is_public: bool = True


class AddCollectionItemBody(BaseModel):
    """``POST /api/collections/<uuid>/items``.

    Note: the pre-pydantic path let an absent/empty ``game_uuid`` fall through
    to a 404 "Game not found". With the model it is a 422 naming ``game_uuid``
    instead — same rejection, more precise code. No client sends an empty one.
    """

    model_config = ConfigDict(extra='forbid')

    game_uuid: _RequiredUuid


class ReorderCollectionItemsBody(BaseModel):
    """``PUT /api/collections/<uuid>/items/order``.

    Only replaces the ``isinstance(game_uuids, list)`` guard. The "each item
    exactly once / must match the collection" checks stay in the view — they
    need the collection's current rows.
    """

    model_config = ConfigDict(extra='forbid')

    # Left as a bare list (``list[Any]``): the view already normalises each
    # entry with ``str(uuid).strip()`` and drops ``None``, so tightening to
    # ``list[str]`` here would reject inputs the route currently accepts.
    game_uuids: list
