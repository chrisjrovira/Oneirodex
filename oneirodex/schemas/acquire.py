"""Request models for ``oneirodex/routes_apis/acquire.py``."""

from __future__ import annotations

from typing import Self

from pydantic import BaseModel, ConfigDict, model_validator


class AcquireDownloadBody(BaseModel):
    """``POST /api/acquire/download``.

    Replaces ``url = (data.get('url') or data.get('magnet') or '').strip();
    if not url``. Either key may be sent; ``url`` wins when both are present
    and non-empty, matching the hand-rolled ``or``. Whitespace-only still
    fails after strip, same as before.

    ``provider`` stays optional — the view still defaults it to
    ``qbittorrent`` and lowercases it. Feature-flag refusals (Arr / debrid
    off, unknown provider) stay in the view.
    """

    model_config = ConfigDict(extra='forbid')

    url: str | None = None
    magnet: str | None = None
    provider: str | None = None

    @model_validator(mode='after')
    def require_url_or_magnet(self) -> Self:
        if not (self.url or self.magnet or '').strip():
            raise ValueError('url or magnet required')
        return self
