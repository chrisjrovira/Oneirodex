"""In-process event bus for scan/download realtime updates (SSE + WS)."""

from __future__ import annotations

import asyncio
import json
import threading
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any


@dataclass
class AppEvent:
    type: str
    payload: dict[str, Any] = field(default_factory=dict)
    ts: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        return {'type': self.type, 'payload': self.payload, 'ts': self.ts}


class EventBus:
    """Thread-safe fan-out of JSON events to async subscribers."""

    def __init__(self, history_size: int = 50):
        self._lock = threading.Lock()
        self._subscribers: list[asyncio.Queue] = []
        self._history: list[AppEvent] = []
        self._history_size = history_size
        self._loop: asyncio.AbstractEventLoop | None = None

    def set_loop(self, loop: asyncio.AbstractEventLoop | None) -> None:
        self._loop = loop

    def publish(self, event_type: str, **payload: Any) -> AppEvent:
        event = AppEvent(type=event_type, payload=payload)
        with self._lock:
            self._history.append(event)
            if len(self._history) > self._history_size:
                self._history = self._history[-self._history_size:]
            subscribers = list(self._subscribers)

        for queue in subscribers:
            try:
                queue.put_nowait(event)
            except Exception:
                pass
        return event

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        with self._lock:
            self._subscribers.append(queue)
            history = list(self._history)
        for event in history[-10:]:
            try:
                queue.put_nowait(event)
            except Exception:
                break
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        with self._lock:
            if queue in self._subscribers:
                self._subscribers.remove(queue)


event_bus = EventBus()


def publish_scan_event(job_id: int | str, status: str, **extra: Any) -> None:
    event_bus.publish('scan', job_id=job_id, status=status, **extra)


def publish_download_event(request_id: int | str, status: str, **extra: Any) -> None:
    event_bus.publish('download', request_id=request_id, status=status, **extra)


def encode_sse(event: AppEvent) -> bytes:
    data = json.dumps(event.to_dict(), default=str)
    return f'event: {event.type}\ndata: {data}\n\n'.encode('utf-8')
