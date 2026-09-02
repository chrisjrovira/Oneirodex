"""Background poller for free-game offer refresh (Wave 18)."""

from __future__ import annotations

import threading
import time

_scheduler_started = False


def _is_enabled(app) -> bool:
    return bool(app.config.get('ENABLE_FREE_GAMES', True))


def _poll_seconds(app) -> int:
    try:
        hours = float(app.config.get('FREE_GAMES_POLL_HOURS') or 3)
    except (TypeError, ValueError):
        hours = 3.0
    hours = max(1.0, min(hours, 24.0))
    return int(hours * 3600)


def start_free_games_scheduler(app):
    """Start a daemon that refreshes free-game offers (idempotent)."""
    global _scheduler_started
    if _scheduler_started:
        return
    if not _is_enabled(app):
        print('[FREE GAMES] Disabled (ENABLE_FREE_GAMES=false)')
        return

    _scheduler_started = True
    interval = _poll_seconds(app)

    def _loop():
        # Short delay so boot is not blocked by outbound HTTP
        time.sleep(15)
        while True:
            try:
                with app.app_context():
                    from oneirodex.utils.free_games import sync_free_game_offers

                    stats = sync_free_game_offers(notify=True)
                    print(
                        f"[FREE GAMES] Refresh fetched={stats.get('fetched')} "
                        f"inserted={stats.get('inserted')} notified={stats.get('notified')}"
                    )
            except Exception as exc:
                print(f'[FREE GAMES] Error: {exc}')
            time.sleep(interval)

    thread = threading.Thread(target=_loop, name='oneirodex-free-games', daemon=True)
    thread.start()
    print(f'[FREE GAMES] Started (poll every {max(1, interval // 3600)}h)')
