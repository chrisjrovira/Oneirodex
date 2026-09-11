"""Request models for ``oneirodex/routes_arr.py``."""

from __future__ import annotations

from typing import Any, Self

from pydantic import BaseModel, ConfigDict, model_validator


class ArrDownloadBody(BaseModel):
    """``POST /api/arr/download``.

    Replaces ``url = (data.get('download_url') or data.get('url') or
    '').strip(); if not url``. ``download_url`` wins when both are
    present and non-empty, matching the hand-rolled ``or``.
    Whitespace-only still fails after strip. The Arr-module 403 stays
    in the view.
    """

    model_config = ConfigDict(extra='forbid')

    download_url: str | None = None
    url: str | None = None

    @model_validator(mode='after')
    def require_download_url_or_url(self) -> Self:
        if not (self.download_url or self.url or '').strip():
            raise ValueError('download_url is required')
        return self


class ArrHardlinkPreviewBody(BaseModel):
    """``POST /api/arr/hardlink/preview``.

    Replaces empty ``library_dest_dir`` / ``dest_dir`` 400. ``limit``
    stays untyped so the view can still fall back to 50 on a bad int.
    Apply (proposals *or* dest) is not modelled. Module / pipeline
    403s stay in the view.
    """

    model_config = ConfigDict(extra='forbid')

    library_dest_dir: str | None = None
    dest_dir: str | None = None
    limit: Any = None

    @model_validator(mode='after')
    def require_dest(self) -> Self:
        if not (self.library_dest_dir or self.dest_dir or '').strip():
            raise ValueError('library_dest_dir is required')
        return self
