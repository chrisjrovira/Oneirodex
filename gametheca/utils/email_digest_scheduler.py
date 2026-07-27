"""Background scheduler for batched notification email digests."""

from __future__ import annotations

import threading
import time

_scheduler_started = False


def _is_enabled(app) -> bool:
    return bool(app.config.get('ENABLE_EMAIL_DIGEST', True))


def _poll_seconds(app) -> int:
    try:
        hours = float(app.config.get('EMAIL_DIGEST_INTERVAL_HOURS') or 24)
    except (TypeError, ValueError):
        hours = 24.0
    hours = max(1.0, min(hours, 168.0))
    return int(hours * 3600)


def start_email_digest_scheduler(app):
    """Start a daemon that sends opted-in digests (idempotent)."""
    global _scheduler_started
    if _scheduler_started:
        return
    if not _is_enabled(app):
        print('[EMAIL DIGEST] Disabled (ENABLE_EMAIL_DIGEST=false)')
        return

    _scheduler_started = True
    interval = _poll_seconds(app)

    def _loop():
        time.sleep(60)
        while True:
            try:
                with app.app_context():
                    from gametheca.utils.email_digest import run_email_digest_batch

                    stats = run_email_digest_batch()
                    print(
                        f"[EMAIL DIGEST] considered={stats.get('considered')} "
                        f"sent={stats.get('sent')} skipped={stats.get('skipped')}"
                    )
            except Exception as exc:
                print(f'[EMAIL DIGEST] Error: {exc}')
            time.sleep(interval)

    thread = threading.Thread(target=_loop, name='gametheca-email-digest', daemon=True)
    thread.start()
    print(f'[EMAIL DIGEST] Started (poll every {max(1, interval // 3600)}h)')
