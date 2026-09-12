"""Background refresh of CheapShark deep discounts.

Discover must not wait on outbound HTTPS. The poller warms
``store_deals.cached_deep_discounts`` shortly after boot and again each TTL.
The request path still fetches on a cold cache so the first member after a
restart is not staring at an empty shelf for 15 seconds.
"""

from __future__ import annotations

import logging
import threading
import time

from oneirodex.utils.store_deals import CACHE_TTL_SEC, refresh_deep_discounts

logger = logging.getLogger(__name__)

_scheduler_started = False


def start_store_deals_scheduler(app):
    """Start a daemon that refreshes CheapShark deals (idempotent)."""
    global _scheduler_started
    if _scheduler_started:
        return
    _scheduler_started = True
    interval = CACHE_TTL_SEC

    def _loop():
        time.sleep(15)
        while True:
            try:
                with app.app_context():
                    count = refresh_deep_discounts()
                    logger.info('CheapShark deep discounts refreshed (%s deals)', count)
            except Exception:
                logger.exception('CheapShark deep-discount refresh failed')
            time.sleep(interval)

    thread = threading.Thread(
        target=_loop,
        name='oneirodex-store-deals',
        daemon=True,
    )
    thread.start()
    logger.info('CheapShark deep-discount poller started (every %ss)', interval)
