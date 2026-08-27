"""Public product string (ADR 0003 phase 1) — no DB."""

from gametheca.product import (
    LEGACY_NAME,
    PACKAGE_NAME,
    PRODUCT_NAME,
    PRODUCT_NAME_SAY,
    RESET_CONFIRM_LEGACY,
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
    assert PACKAGE_NAME == 'gametheca'


def test_reset_confirm_accepts_new_and_legacy():
    assert is_reset_confirm(RESET_CONFIRM_PHRASE)
    assert is_reset_confirm(RESET_CONFIRM_LEGACY)
    assert not is_reset_confirm('reset oneirodex')
    assert not is_reset_confirm('RESET GAMETHECA ')
    assert not is_reset_confirm('')
    assert not is_reset_confirm(None)
