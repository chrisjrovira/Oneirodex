"""Public product string for Oneirodex (ADR 0003 phase 1).

Package path, Docker image, GitHub repo, ``GT_*`` env, and ``gt-`` CSS stay
``gametheca`` until a later identifier wave. Do not invent ``OD_*`` aliases here.
"""

from __future__ import annotations

# Spelling: one word, capital O. Not OneiroDex, not ONEIRODEX in UI.
PRODUCT_NAME = 'Oneirodex'
PRODUCT_NAME_SAY = 'oh-NY-roh-dex'
PRODUCT_SLUG = 'oneirodex'

LEGACY_NAME = 'GameTheca'
PACKAGE_NAME = 'gametheca'

# Danger-zone confirm. The typed phrase is Oneirodex; the legacy phrase still
# works so existing runbooks and muscle memory cannot lock an operator out.
RESET_CONFIRM_PHRASE = 'RESET ONEIRODEX'
RESET_CONFIRM_LEGACY = 'RESET GAMETHECA'
RESET_CONFIRM_ALIASES = frozenset({RESET_CONFIRM_PHRASE, RESET_CONFIRM_LEGACY})


def is_reset_confirm(value: object) -> bool:
    return isinstance(value, str) and value in RESET_CONFIRM_ALIASES
