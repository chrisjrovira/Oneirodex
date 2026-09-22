"""Request models for ``oneirodex/routes_apis/reference_sets.py``."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class RepairPreviewBody(BaseModel):
    """``POST /api/reference-sets/repair-preview`` (INSP-24, v11 H1f).

    A platform, optionally one region's set, and a per-bucket row cap. The
    report is a dry run -- nothing on disk or in the catalogue changes.
    """

    model_config = ConfigDict(extra='forbid')

    library_platform: str = Field(min_length=1, max_length=64)
    region: str | None = Field(default=None, max_length=32)
    limit: int | None = Field(default=None, ge=1, le=2000)
