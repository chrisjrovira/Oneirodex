"""Request models for ``oneirodex/routes_admin_ext/images.py``."""

from __future__ import annotations

from typing import Annotated, Any, Self

from pydantic import BaseModel, ConfigDict, StringConstraints, model_validator

_RequiredText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class ApplyCoverBody(BaseModel):
    """``POST /admin/api/covers/apply``.

    Replaces empty ``game_uuid`` / ``url`` 400s. Path-writable and apply
    helper errors stay in the view. Batch cover routes stay unwrapped
    (optional bags / partial-success).
    """

    model_config = ConfigDict(extra='forbid')

    game_uuid: _RequiredText
    url: _RequiredText
    provider: str | None = None


class CoverSearchBody(BaseModel):
    """``POST /admin/api/covers/search``.

    Replaces ``if not query: 400 "query or game_uuid is required"``. Either
    ``query`` (or ``q`` / ``name``) or ``game_uuid`` is enough; the view still
    looks up the title from the uuid when query is empty. Whitespace-only
    ``query`` does **not** fall through to ``q`` — same as
    ``(data.get('query') or data.get('q') or ...)``.
    """

    model_config = ConfigDict(extra='forbid')

    game_uuid: str | None = None
    query: str | None = None
    q: str | None = None
    name: str | None = None
    providers: Any = None
    limit: Any = None
    limit_per_provider: Any = None

    @model_validator(mode='after')
    def require_query_or_game_uuid(self) -> Self:
        query = (self.query or self.q or self.name or '').strip()
        game_uuid = (self.game_uuid or '').strip()
        if not query and not game_uuid:
            raise ValueError('query or game_uuid is required')
        return self


class GenerateArtworkBody(BaseModel):
    """``POST /admin/api/artwork/generate``.

    Replaces empty ``game_uuid`` 400. The ``ENABLE_AI_ARTWORK`` flag stays
    in the view; wrapping innermost means ``{}`` is 422 even when the
    feature is off. A well-formed body is still 403.
    """

    model_config = ConfigDict(extra='forbid')

    game_uuid: _RequiredText
    image_type: str | None = None
