"""Request models for ``oneirodex/routes_apis/library_tools.py``.

Only the JSON-only routes with a real presence/type guard. ``propose_leaf_libraries``
also reads query args, ``import_leaf_libraries/preview`` also reads a file /
form field, rename preview/apply fall through to 404 with no presence 400, and
``backfill_steam_metadata`` is all-optional — those stay hand-rolled.
"""

from __future__ import annotations

from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

_RequiredText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
_NonEmptyList = Annotated[list[Any], Field(min_length=1)]


class ApproveProposalBody(BaseModel):
    """``POST /api/library_tools/proposals/approve``.

    Replaces ``if not path or not igdb_id``. ``igdb_id`` stays ``int | str`` so
    a JSON number still works; an empty string is still refused in the view.
    """

    model_config = ConfigDict(extra='forbid')

    path: _RequiredText
    igdb_id: int | str


class ScanRootsBody(BaseModel):
    """``POST /api/library_tools/proposals/scan_roots``.

    Admin UI posts ``{}``; an omitted ``roots`` stays an empty list. Only the
    ``isinstance(..., list)`` guard moves here.
    """

    model_config = ConfigDict(extra='forbid')

    roots: list[Any] = Field(default_factory=list)


class DoctorDryRunBody(BaseModel):
    """``POST /api/library_tools/doctor/dry_run``.

    Replaces ``if not isinstance(roots, list) or not roots``.
    """

    model_config = ConfigDict(extra='forbid')

    roots: _NonEmptyList
    template: str | None = None
    limit: Any = None


class WriteProposalsBody(BaseModel):
    """``POST /api/library_tools/doctor/write_proposals``.

    Admin UI posts the dry-run row dicts through. Row shape stays unvalidated.
    """

    model_config = ConfigDict(extra='forbid')

    rows: list[Any] = Field(default_factory=list)


class ApplyRenamesBody(BaseModel):
    """``POST /api/library_tools/doctor/apply_renames``.

    Replaces ``if not isinstance(rows, list) or not rows``.
    """

    model_config = ConfigDict(extra='forbid')

    rows: _NonEmptyList
    template: str | None = None


class CheckFreshnessBody(BaseModel):
    """``POST /api/library_tools/check_freshness``.

    Replaces ``library_uuid = (data.get('library_uuid') or '').strip(); if not``.
    ``limit`` stays loosely typed so a non-numeric value still 400 in the view.
    """

    model_config = ConfigDict(extra='forbid')

    library_uuid: _RequiredText
    limit: Any = None
    only_missing: Any = True
