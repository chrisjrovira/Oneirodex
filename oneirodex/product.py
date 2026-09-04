"""Public product string for Oneirodex (ADR 0003).

``ONEIRODEX_*`` env wins over ``GT_*``. CSS tokens and classes are ``--od-*`` /
``.od-*`` (P3b). Package path is ``oneirodex/``. Do not invent ``OD_*`` env
aliases — that prefix was reserved against.
"""

from __future__ import annotations

# Spelling: one word, capital O. Not OneiroDex, not ONEIRODEX in UI.
PRODUCT_NAME = 'Oneirodex'
PRODUCT_NAME_SAY = 'oh-NY-roh-dex'
PRODUCT_SLUG = 'oneirodex'

# Not branding — a value written into theme files by older versions. Stock
# themes are recognised by author (see utils/preset_themes.py), so dropping
# this would reclassify already-installed stock themes as user themes. It is
# read, never written.
LEGACY_NAME = 'GameTheca'
PACKAGE_NAME = 'oneirodex'

# Danger-zone confirm. One phrase, no legacy alias: the old "RESET GAMETHECA"
# was retired with the rest of the legacy naming.
RESET_CONFIRM_PHRASE = 'RESET ONEIRODEX'


def is_reset_confirm(value: object) -> bool:
    return isinstance(value, str) and value == RESET_CONFIRM_PHRASE
