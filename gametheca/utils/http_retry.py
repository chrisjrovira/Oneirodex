import time
import random
import threading
import requests

_last_request_at = {}
_lock = threading.Lock()
_MIN_INTERVAL_SEC = {
    'steam': 1.0,
    'rawg': 1.0,
    'gog': 1.0,
    'epic': 1.0,
    'itch': 1.0,
    'giantbomb': 1.0,
    # MobyGames non-commercial: max ~1 req/sec (720/hr).
    'mobygames': 1.0,
    # TheGamesDB free tier is monthly-quota limited — keep polite spacing.
    'thegamesdb': 1.0,
}


def request_with_backoff(url, *, host_key, params=None, timeout=5, max_retries=3, headers=None):
    """GET with per-host min interval and exponential backoff on 429/5xx/timeout."""
    min_interval = _MIN_INTERVAL_SEC.get(host_key, 0.5)
    last_exc = None

    for attempt in range(max_retries):
        with _lock:
            now = time.monotonic()
            last = _last_request_at.get(host_key, 0.0)
            wait = min_interval - (now - last)
            if wait > 0:
                time.sleep(wait)
            _last_request_at[host_key] = time.monotonic()

        try:
            resp = requests.get(url, params=params, timeout=timeout, headers=headers)
        except requests.RequestException as exc:
            last_exc = exc
            time.sleep((2 ** attempt) + random.uniform(0, 0.25))
            continue

        if resp.status_code == 200:
            return resp
        if resp.status_code == 429 or resp.status_code >= 500:
            time.sleep((2 ** attempt) + random.uniform(0, 0.25))
            continue
        return None

    if last_exc:
        print(f"http_retry exhausted for {host_key}: {last_exc}")
    return None
