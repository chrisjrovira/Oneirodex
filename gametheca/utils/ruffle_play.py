"""Optional Ruffle play URL for Flash titles when ENABLE_RUFFLE is on.

**Not wired to any surface (2026-08-06).** Nothing calls ``ruffle_play_url``:
the Ruffle player is not vendored under ``static/vendor/ruffle/``, and
``LibraryPlatform`` has no Flash entry, so there is nothing to play. The admin
Features toggle was removed rather than left showing a switch that could not
change anything.

This module is kept because it is small, tested, and already encodes the honest
behaviour — it returns ``None`` when the player file is absent rather than
linking to a 404. To finish the feature you need three things: vendor Ruffle,
add a Flash platform to the enum, and call this from the play surface. Until
then, treat it as a stub.
"""

from __future__ import annotations

import os

from flask import current_app


def ruffle_enabled() -> bool:
    return str(current_app.config.get('ENABLE_RUFFLE', 'true')).lower() in (
        '1', 'true', 'yes', 'on',
    )


def ruffle_player_path() -> str:
    return os.path.join(current_app.root_path, 'static', 'vendor', 'ruffle', 'player.html')


def ruffle_play_url(game_uuid: str) -> str | None:
    if not ruffle_enabled() or not game_uuid:
        return None
    if not os.path.isfile(ruffle_player_path()):
        return None
    return f'/static/vendor/ruffle/player.html?guid={game_uuid}'
