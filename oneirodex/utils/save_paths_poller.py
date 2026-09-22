"""Background refresh for the community save-location manifest (INSP-1, H4e).

One daemon, one fetch a day, through :func:`save_paths.refresh_if_stale`,
which also rebuilds the compact index a details request reads.
"""

from __future__ import annotations

import logging
import threading
import time

logger = logging.getLogger(__name__)

_scheduler_started = False
_CHECK_SECONDS = 3600


def start_save_paths_scheduler(app):
    """Start the daemon that keeps the save-path index fresh (idempotent)."""
    global _scheduler_started
    if _scheduler_started:
        return None
    from oneirodex.utils.save_paths import fetch_allowed

    if not fetch_allowed():
        logger.info('[SAVE PATHS] Disabled (ENABLE_SAVE_PATHS=false or testing)')
        return None

    _scheduler_started = True

    def _loop():
        # Short delay so boot is not blocked by a 15 MB download.
        time.sleep(40)
        while True:
            try:
                with app.app_context():
                    from oneirodex.utils.save_paths import refresh_if_stale

                    refresh_if_stale()
            except Exception as exc:  # noqa: BLE001
                logger.warning('[SAVE PATHS] refresh loop error: %s', exc)
            time.sleep(_CHECK_SECONDS)

    thread = threading.Thread(target=_loop, name='oneirodex-save-paths', daemon=True)
    thread.start()
    logger.info('[SAVE PATHS] Started (daily manifest refresh)')
    return None
