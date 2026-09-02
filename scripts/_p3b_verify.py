"""In-container P3b assertions. Piped via docker exec -i python -."""
from pathlib import Path

from oneirodex.product import (
    LEGACY_NAME,
    PACKAGE_NAME,
    PRODUCT_NAME,
    RESET_CONFIRM_LEGACY,
    RESET_CONFIRM_PHRASE,
    is_reset_confirm,
)

assert PRODUCT_NAME == 'Oneirodex'
assert PACKAGE_NAME == 'oneirodex'
assert LEGACY_NAME == 'GameTheca'
assert RESET_CONFIRM_PHRASE == 'RESET ONEIRODEX'
assert RESET_CONFIRM_LEGACY == 'RESET GAMETHECA'
assert is_reset_confirm('RESET GAMETHECA')
assert not is_reset_confirm('RESET GAMETHECA ')

base = Path('/app/oneirodex/templates/base.html').read_text(encoding='utf-8')
assert 'js/od_toast.js' in base
assert 'js/gt_toast.js' not in base
assert 'js/od_dom_actions.js' in base

assert Path('/app/oneirodex/static/newstyle/oneirodex_mark.svg').is_file()
assert Path('/app/oneirodex/static/newstyle/oneirodex_glyph.svg').is_file()
print('in-app assertions ok')
