"""Background refresh for the community anti-cheat list (INSP-35, H1e).

One daemon, one fetch a day, through :func:`anticheat_compat.refresh_if_stale`.
Details pages never wait on the network -- they read whatever this wrote last.
"""

from __future__ import annotations

import logging
import threading
import time

logger = logging.getLogger(__name__)

_scheduler_started = False
# Re-check hourly; the module's own 24 h TTL decides whether a fetch happens.
_CHECK_SECONDS = 3600


def start_anticheat_scheduler(app):
    """Start the daemon that keeps the anti-cheat cache fresh (idempotent)."""
    global _scheduler_started
    if _scheduler_started:
        return None
    from oneirodex.utils.anticheat_compat import fetch_allowed

    if not fetch_allowed():
        logger.info('[ANTICHEAT] Disabled (ENABLE_ANTICHEAT_COMPAT=false or testing)')
        return None

    _scheduler_started = True

    def _loop():
        # Short delay so boot is not blocked by outbound HTTP.
        time.sleep(20)
        while True:
            try:
                with app.app_context():
                    from oneirodex.utils.anticheat_compat import refresh_if_stale

                    refresh_if_stale()
            except Exception as exc:  # noqa: BLE001
                logger.warning('[ANTICHEAT] refresh loop error: %s', exc)
            time.sleep(_CHECK_SECONDS)

    thread = threading.Thread(target=_loop, name='oneirodex-anticheat', daemon=True)
    thread.start()
    logger.info('[ANTICHEAT] Started (daily feed refresh)')
    return None
