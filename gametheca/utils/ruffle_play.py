"""Optional Ruffle play URL for Flash titles when ENABLE_RUFFLE is on."""

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
