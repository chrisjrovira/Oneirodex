"""Web lifecycle state for browse/discover/game details serializers."""

from __future__ import annotations

from typing import Any

from gametheca.utils.client_presence import user_client_connected

FRESHNESS_BEHIND_STATUSES = frozenset({'behind', 'heuristic_behind'})


def game_has_updates_available(game, *, updates_count: int | None = None) -> bool:
    """True when store freshness or local update files indicate updates."""
    freshness = getattr(game, 'freshness_status', None)
    if freshness in FRESHNESS_BEHIND_STATUSES:
        return True

    if updates_count is not None:
        return updates_count > 0

    updates = getattr(game, 'updates', None)
    if updates is not None:
        try:
            return len(updates) > 0
        except TypeError:
            pass

    return False


def web_lifecycle_state(game, *, updates_count: int | None = None) -> str:
    """Lifecycle for web responses (no companion client)."""
    if game_has_updates_available(game, updates_count=updates_count):
        return 'update_available'
    return 'not_downloaded'


def web_client_connected(*, user_id: int | None = None) -> bool:
    """True when the user has a recent companion client heartbeat."""
    return user_client_connected(user_id)


def web_lifecycle_fields(
    game,
    *,
    updates_count: int | None = None,
    user_id: int | None = None,
    client_connected: bool | None = None,
    client_state: str | None = None,
) -> dict[str, Any]:
    """Shared lifecycle/client fields for GameCard and GameActionBar."""
    connected = (
        client_connected
        if client_connected is not None
        else web_client_connected(user_id=user_id)
    )
    has_updates = game_has_updates_available(game, updates_count=updates_count)
    state = web_lifecycle_state(game, updates_count=updates_count)
    # Companion install state wins when present (except store-behind → update_available).
    if client_state in {'downloaded', 'installed', 'update_available', 'not_downloaded'}:
        if has_updates and client_state in {'downloaded', 'installed'}:
            state = 'update_available'
        else:
            state = client_state
    return {
        'lifecycle_state': state,
        'client_connected': connected,
        'has_updates': has_updates,
        'updates_count': int(updates_count or 0),
    }
