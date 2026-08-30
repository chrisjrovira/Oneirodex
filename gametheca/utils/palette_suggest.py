"""Empty-state suggestions for the command palette.

Played titles come from this member's progress. Popular titles are the same
on-box favourite counts Discover already uses — household, ACL-filtered, no
community search graph and nothing leaving the box.
"""

from __future__ import annotations

from gametheca.utils.cover_url import resolve_game_cover_url
from gametheca.utils.discover_providers import _continue_playing, _most_favorited

SUGGEST_LIMIT = 8
SUGGEST_LIMIT_MAX = 12


def clamp_suggest_limit(raw) -> int:
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return SUGGEST_LIMIT
    return max(1, min(SUGGEST_LIMIT_MAX, value))


def _tile(game, hint: str) -> dict:
    return {
        'uuid': game.uuid,
        'name': game.name,
        'cover_url': resolve_game_cover_url(game),
        'hint': hint,
    }


def palette_suggest(user, *, limit: int = SUGGEST_LIMIT) -> dict:
    """Recently played + most favourited titles this member may see."""
    cap = clamp_suggest_limit(limit)
    recent_games = list(_continue_playing(user, cap))
    recent_uuids = {game.uuid for game in recent_games}
    popular_games = [
        game
        for game in _most_favorited(user, cap + len(recent_uuids))
        if game.uuid not in recent_uuids
    ][:cap]

    return {
        'recent': [_tile(game, 'Played recently') for game in recent_games],
        'popular': [_tile(game, 'Favorited here') for game in popular_games],
    }
