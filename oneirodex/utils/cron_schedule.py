"""Lightweight 5-field cron next-fire helper (no croniter dependency).

Supports ``*``, ``N``, ``N-M``, ``*/N``, and comma lists for minute/hour/
day-of-month/month/day-of-week. Day-of-week uses 0=Sunday … 6=Saturday (also
accepts 7 as Sunday). Enough for admin scan schedules; not a full crontab.
"""

from __future__ import annotations

from calendar import monthrange
from datetime import datetime, timedelta, timezone


def _parse_field(field: str, minimum: int, maximum: int) -> set[int]:
    values: set[int] = set()
    for part in field.split(','):
        part = part.strip()
        if not part:
            continue
        if part == '*':
            values.update(range(minimum, maximum + 1))
            continue
        if part.startswith('*/'):
            step = int(part[2:])
            if step < 1:
                raise ValueError(f'invalid step in {field!r}')
            values.update(range(minimum, maximum + 1, step))
            continue
        if '-' in part:
            start_s, end_s = part.split('-', 1)
            start, end = int(start_s), int(end_s)
            if start > end:
                raise ValueError(f'invalid range in {field!r}')
            values.update(range(start, end + 1))
            continue
        values.add(int(part))
    out = {v for v in values if minimum <= v <= maximum}
    if not out:
        raise ValueError(f'empty cron field {field!r}')
    return out


def parse_cron_expression(expr: str) -> tuple[set[int], set[int], set[int], set[int], set[int]]:
    parts = (expr or '').strip().split()
    if len(parts) != 5:
        raise ValueError('cron must have 5 fields: minute hour dom month dow')
    minute, hour, dom, month, dow = parts
    minutes = _parse_field(minute, 0, 59)
    hours = _parse_field(hour, 0, 23)
    doms = _parse_field(dom, 1, 31)
    months = _parse_field(month, 1, 12)
    dows = _parse_field(dow, 0, 7)
    if 7 in dows:
        dows.add(0)
        dows.discard(7)
    return minutes, hours, doms, months, dows


def next_cron_fire(expr: str, from_time: datetime | None = None) -> datetime:
    """Return the next UTC datetime strictly after ``from_time`` matching ``expr``."""
    minutes, hours, doms, months, dows = parse_cron_expression(expr)
    base = from_time or datetime.now(timezone.utc)
    if base.tzinfo is None:
        base = base.replace(tzinfo=timezone.utc)
    else:
        base = base.astimezone(timezone.utc)
    # Start at the next whole minute
    cursor = (base.replace(second=0, microsecond=0) + timedelta(minutes=1))
    # Bound search to ~2 years to avoid infinite loops on impossible expressions
    limit = cursor + timedelta(days=800)
    while cursor <= limit:
        if (
            cursor.month in months
            and cursor.day in doms
            and cursor.hour in hours
            and cursor.minute in minutes
        ):
            # Convert Python weekday (Mon=0 … Sun=6) to cron (Sun=0 … Sat=6)
            cron_dow = (cursor.weekday() + 1) % 7
            if cron_dow in dows:
                last_day = monthrange(cursor.year, cursor.month)[1]
                if cursor.day <= last_day:
                    return cursor
        cursor += timedelta(minutes=1)
    raise ValueError(f'no next fire for cron {expr!r} within search window')


def validate_cron_expression(expr: str) -> str | None:
    """Return None when valid, otherwise a short error string."""
    try:
        parse_cron_expression(expr)
    except Exception as exc:  # noqa: BLE001 — surface as validation message
        return str(exc)
    return None
