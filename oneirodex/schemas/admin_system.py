"""Request models for ``oneirodex/routes_admin_ext/system.py``."""

from __future__ import annotations

from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, StrictBool, StringConstraints

# Hand-rolled create/update did ``str(data.get('name') or '').strip()`` then
# ``if not name``. strip_whitespace reproduces that; the 50-character cap
# stays in the view so its 400 message is unchanged.
_RequiredName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class DiscoveryShelfBody(BaseModel):
    """``POST /admin/api/discovery_sections`` and
    ``PUT /admin/api/discovery_sections/<id>``.

    Replaces the empty-name 400. Mode / UUID / filter checks stay in
    ``validate_shelf_config``. ``game_uuids`` is ``Any`` because the admin
    theme JS posts the textarea string, and the helper already accepts a
    string or a list.
    """

    model_config = ConfigDict(extra='forbid')

    name: _RequiredName
    mode: str | None = None
    game_uuids: Any = None
    filter_type: str | None = None
    filter_value: Any = None


class SectionOrderItem(BaseModel):
    """One ``{id, order}`` row from the discovery Sortable payload."""

    model_config = ConfigDict(extra='forbid')

    id: int
    order: int


class UpdateSectionOrderBody(BaseModel):
    """``POST /admin/api/discovery_sections/order``.

    Replaces ``validate_json_request(..., ['sections'])`` plus the
    ``isinstance(..., list)`` / per-row ``id``+``order`` presence checks.
    Theme JS posts ``id`` as a dataset string; pydantic coerces it. Negative
    ``order`` and unknown ids stay 400/404 in the view.
    """

    model_config = ConfigDict(extra='forbid')

    sections: list[SectionOrderItem]


class UpdateSectionVisibilityBody(BaseModel):
    """``POST /admin/api/discovery_sections/visibility``.

    Replaces required ``section_id`` + ``is_visible`` 400s. Unknown ids
    still 404 from the view.
    """

    model_config = ConfigDict(extra='forbid')

    section_id: int
    is_visible: StrictBool
