"""Optional Ruffle play URL for Flash titles when ENABLE_RUFFLE is on."""

from __future__ import annotations

from flask import current_app


def ruffle_enabled() -> bool:
    return str(current_app.config.get('ENABLE_RUFFLE', 'false')).lower() in (
        '1', 'true', 'yes', 'on',
    )


def ruffle_play_url(game_uuid: str) -> str | None:
    if not ruffle_enabled() or not game_uuid:
        return None
    # Operators host Ruffle player under static; GameTheca only exposes the hook.
    return f'/static/vendor/ruffle/player.html?guid={game_uuid}'
