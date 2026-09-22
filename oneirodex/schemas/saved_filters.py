"""Request models for ``oneirodex/routes_apis/saved_filters.py`` (INSP-3).

The tree itself is deliberately *not* modelled as pydantic. Its validity is a
question about a recursive vocabulary — which fields exist, what each one
takes, how deep a member may nest — and that vocabulary already has exactly one
definition in ``utils/filter_tree.py``, beside the clauses it compiles to. A
second pydantic copy of it here would be a copy that drifts. These models check
the envelope; ``parse_filter_tree`` checks the tree and says which part is
wrong.
"""

from __future__ import annotations

from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

_Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]


class SavedFilterCreateBody(BaseModel):
    """``POST /api/filters/saved``."""

    model_config = ConfigDict(extra='forbid')

    name: _Name
    tree: dict[str, Any]
    is_collection: bool = False


class SavedFilterUpdateBody(BaseModel):
    """``PUT /api/filters/saved/<id>``.

    Every field optional: renaming a filter and rewriting its tree are separate
    things a member does, and requiring the tree to rename would mean the UI
    has to send back a document it may not have loaded.
    """

    model_config = ConfigDict(extra='forbid')

    name: _Name | None = None
    tree: dict[str, Any] | None = None
    is_collection: bool | None = None


class FilterPreviewBody(BaseModel):
    """``POST /api/filters/preview`` — how many titles would this match?

    The builder needs an answer per keystroke without navigating, and a count
    is the cheapest honest one.
    """

    model_config = ConfigDict(extra='forbid')

    tree: dict[str, Any]
    limit: int = Field(default=0, ge=0, le=50)
