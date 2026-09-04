"""Public product string (ADR 0003 phase 1) — no DB."""

from oneirodex.product import (
    LEGACY_NAME,
    PACKAGE_NAME,
    PRODUCT_NAME,
    PRODUCT_NAME_SAY,
    RESET_CONFIRM_PHRASE,
    is_reset_confirm,
)


def test_product_name_spelling():
    assert PRODUCT_NAME == 'Oneirodex'
    assert PRODUCT_NAME_SAY == 'oh-NY-roh-dex'
    assert PRODUCT_NAME.lower() == 'oneirodex'
    assert 'Dex' not in PRODUCT_NAME
    assert PRODUCT_NAME != PRODUCT_NAME.upper()
    assert LEGACY_NAME == 'GameTheca'
    assert PACKAGE_NAME == 'oneirodex'


def test_reset_confirm_accepts_only_the_current_phrase():
    """The legacy "RESET GAMETHECA" alias was retired with the rest of the
    legacy naming — a clean break, so it must now be rejected."""
    assert is_reset_confirm(RESET_CONFIRM_PHRASE)
    assert is_reset_confirm('RESET ONEIRODEX')
    assert not is_reset_confirm('RESET GAMETHECA')
    assert not is_reset_confirm('reset oneirodex')
    assert not is_reset_confirm('RESET ONEIRODEX ')
    assert not is_reset_confirm('')
    assert not is_reset_confirm(None)
