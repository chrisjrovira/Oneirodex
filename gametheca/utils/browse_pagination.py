"""Library browse ``per_page`` allowlist for ``/browse_games``."""

from __future__ import annotations

# Explicit allowlist — includes Wave 1 large page sizes for dense grids.
ALLOWED_PAGE_SIZES = frozenset({20, 50, 100, 200, 250, 300, 400, 500, 1000})
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 1000


def normalize_page_size(raw) -> int:
    """Return an allowlisted page size.

    - Missing / invalid → ``DEFAULT_PAGE_SIZE``
    - Exact allowlist hit → that value
    - Above max / absurd → ``MAX_PAGE_SIZE``
    - Otherwise clamp down to the largest allowlisted size ≤ requested
    """
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return DEFAULT_PAGE_SIZE
    if value < 1:
        return DEFAULT_PAGE_SIZE
    if value in ALLOWED_PAGE_SIZES:
        return value
    if value > MAX_PAGE_SIZE:
        return MAX_PAGE_SIZE
    allowed = sorted(ALLOWED_PAGE_SIZES)
    for size in reversed(allowed):
        if size <= value:
            return size
    return DEFAULT_PAGE_SIZE
