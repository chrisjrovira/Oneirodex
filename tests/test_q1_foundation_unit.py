"""Pure unit tests that do not require PostgreSQL."""

from gametheca.utils.event_bus import EventBus, encode_sse
from gametheca.utils.api_tokens import VALID_SCOPES, TOKEN_PREFIX, _hash_secret
from gametheca.utils.playtime import compute_duration_seconds
from datetime import datetime, timezone, timedelta


def test_event_bus_fanout():
    bus = EventBus(history_size=5)
    q1 = bus.subscribe()
    q2 = bus.subscribe()
    bus.publish('scan', job_id=1, status='Running')
    e1 = q1.get_nowait()
    e2 = q2.get_nowait()
    assert e1.type == 'scan'
    assert e2.payload['job_id'] == 1
    bus.unsubscribe(q1)
    bus.unsubscribe(q2)


def test_encode_sse_bytes():
    bus = EventBus()
    event = bus.publish('download', request_id=9)
    raw = encode_sse(event)
    assert raw.startswith(b'event: download\n')
    assert b'request_id' in raw


def test_token_hash_stable():
    assert _hash_secret('abc') == _hash_secret('abc')
    assert _hash_secret('abc') != _hash_secret('xyz')
    assert TOKEN_PREFIX == 'gt_'
    assert 'read:library' in VALID_SCOPES


def test_compute_duration_seconds():
    start = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)
    end = start + timedelta(minutes=5, seconds=12)
    assert compute_duration_seconds(start, end) == 312
    assert compute_duration_seconds(end, start) == 0
