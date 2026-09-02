# tests/test_utils_browse_pagination.py
from oneirodex.utils.browse_pagination import (
    ALLOWED_PAGE_SIZES,
    normalize_page_size,
)


def test_allowlist_includes_large_sizes():
    for size in (200, 300, 400, 500, 1000):
        assert size in ALLOWED_PAGE_SIZES
        assert normalize_page_size(size) == size


def test_normalize_exact_and_default():
    assert normalize_page_size(20) == 20
    assert normalize_page_size(None) == 20
    assert normalize_page_size('nope') == 20
    assert normalize_page_size(0) == 20


def test_normalize_clamps_absurd():
    assert normalize_page_size(9999) == 1000
    assert normalize_page_size(275) == 250  # largest allowlisted ≤ request
