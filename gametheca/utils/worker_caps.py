"""Hard caps for scan / image / metadata background work.

Prevents admin misconfiguration or legacy high defaults from pinning the host
CPU. Env overrides are optional; defaults stay conservative for Unraid NAS.

Env knobs (all optional ints). ``ONEIRODEX_*`` wins over ``GT_*`` (ADR 0003 phase 3a):
- ``SCAN_THREAD_CAP`` — hard max scan workers (default 4)
- ``IMAGE_DOWNLOAD_THREAD_CAP`` — hard max turbo image workers (default 4)
- ``IMAGE_DOWNLOAD_BATCH_CAP`` — hard max turbo batch size (default 100)
- ``WORKER_YIELD_MS`` — cooperative sleep between scan completions (default 5)
"""

from __future__ import annotations

import time
from typing import Iterable, Iterator, TypeVar

from product_env import getenv_product_int

T = TypeVar('T')

_DEFAULT_SCAN_CAP = 4
_DEFAULT_IMAGE_THREAD_CAP = 4
_DEFAULT_IMAGE_BATCH_CAP = 100
_DEFAULT_YIELD_MS = 5


def _env_int(suffix: str, default: int, *, minimum: int = 1, maximum: int = 64) -> int:
    return getenv_product_int(suffix, default, minimum=minimum, maximum=maximum)


def scan_thread_cap() -> int:
    return _env_int('SCAN_THREAD_CAP', _DEFAULT_SCAN_CAP, minimum=1, maximum=8)


def image_download_thread_cap() -> int:
    return _env_int(
        'IMAGE_DOWNLOAD_THREAD_CAP',
        _DEFAULT_IMAGE_THREAD_CAP,
        minimum=1,
        maximum=8,
    )


def image_download_batch_cap() -> int:
    return _env_int(
        'IMAGE_DOWNLOAD_BATCH_CAP',
        _DEFAULT_IMAGE_BATCH_CAP,
        minimum=10,
        maximum=500,
    )


def worker_yield_seconds() -> float:
    ms = _env_int('WORKER_YIELD_MS', _DEFAULT_YIELD_MS, minimum=0, maximum=250)
    return ms / 1000.0


def clamp_scan_threads(requested: int | None) -> int:
    """Clamp scan ThreadPool size to [1, scan_thread_cap()]."""
    try:
        value = int(requested) if requested is not None else 1
    except (TypeError, ValueError):
        value = 1
    return max(1, min(value, scan_thread_cap()))


def clamp_image_download_threads(requested: int | None) -> int:
    """Clamp turbo image workers to [1, image_download_thread_cap()]."""
    try:
        value = int(requested) if requested is not None else 1
    except (TypeError, ValueError):
        value = 1
    return max(1, min(value, image_download_thread_cap()))


def clamp_image_download_batch(requested: int | None) -> int:
    try:
        value = int(requested) if requested is not None else 50
    except (TypeError, ValueError):
        value = 50
    return max(10, min(value, image_download_batch_cap()))


def cooperative_yield() -> None:
    """Brief pause so request workers / other jobs can breathe on small hosts."""
    delay = worker_yield_seconds()
    if delay > 0:
        time.sleep(delay)


def iter_chunks(items: Iterable[T], size: int) -> Iterator[list[T]]:
    """Yield fixed-size chunks so we never flood the executor queue."""
    chunk: list[T] = []
    limit = max(1, int(size))
    for item in items:
        chunk.append(item)
        if len(chunk) >= limit:
            yield chunk
            chunk = []
    if chunk:
        yield chunk
