"""Unit tests for interval/cron schedules and auto scan-mode detection."""

from __future__ import annotations

import os
import tempfile
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from oneirodex.utils.cron_schedule import next_cron_fire, validate_cron_expression
from oneirodex.utils.scan_queue import (
    apply_schedule_to_job,
    job_next_run_from_row,
    normalize_schedule_fields,
)
from oneirodex.utils.services.scan_orchestration import (
    SCHEDULE_HOURS,
    compute_next_run,
    resolve_scan_mode_for_path,
)


def test_validate_cron_expression_accepts_five_fields():
    assert validate_cron_expression('0 */6 * * *') is None
    assert validate_cron_expression('bad') is not None
    assert validate_cron_expression('* * *') is not None


def test_next_cron_fire_advances_to_next_slot():
    base = datetime(2026, 9, 13, 1, 0, tzinfo=timezone.utc)
    nxt = next_cron_fire('0 */6 * * *', from_time=base)
    assert nxt == datetime(2026, 9, 13, 6, 0, tzinfo=timezone.utc)


def test_compute_next_run_preset_interval_cron():
    base = datetime(2026, 9, 13, 1, 0, tzinfo=timezone.utc)
    assert compute_next_run('8_hours', from_time=base) == base + timedelta(hours=8)
    assert compute_next_run(
        schedule_kind='interval', interval_minutes=45, from_time=base,
    ) == base + timedelta(minutes=45)
    cron_next = compute_next_run(
        schedule_kind='cron', cron_expr='0 3 * * *', from_time=base,
    )
    assert cron_next.hour == 3
    assert '8_hours' in SCHEDULE_HOURS


def test_normalize_schedule_fields_presets_interval_cron():
    preset = normalize_schedule_fields('24_hours')
    assert preset['schedule'] == '24_hours'
    assert preset['schedule_kind'] == 'preset'
    assert preset['next_run'] is not None

    interval = normalize_schedule_fields(
        'interval', interval_value=2, interval_unit='hours',
    )
    assert interval['schedule_kind'] == 'interval'
    assert interval['schedule_interval_minutes'] == 120
    assert interval['schedule'] is None

    cron = normalize_schedule_fields('cron', cron_expr='15 * * * *')
    assert cron['schedule_kind'] == 'cron'
    assert cron['schedule_cron'] == '15 * * * *'

    once = normalize_schedule_fields('')
    assert once['schedule_kind'] == 'once'


def test_apply_schedule_and_job_next_run_from_row():
    fields = normalize_schedule_fields(
        'interval', interval_value=30, interval_unit='minutes',
    )
    job = SimpleNamespace(
        schedule=None,
        schedule_kind=None,
        schedule_interval_minutes=None,
        schedule_cron=None,
        next_run=None,
        status='Completed',
        is_enabled=False,
    )
    apply_schedule_to_job(job, fields)
    assert job.schedule_kind == 'interval'
    assert job.schedule_interval_minutes == 30
    nxt = job_next_run_from_row(job)
    assert nxt is not None


def test_resolve_scan_mode_for_path_auto_heuristic():
    with tempfile.TemporaryDirectory() as folder:
        for name in ('a.zip', 'b.zip', 'c.zip', 'd.chd'):
            open(os.path.join(folder, name), 'w', encoding='utf-8').close()
        assert resolve_scan_mode_for_path(folder, 'auto') == 'files'
        assert resolve_scan_mode_for_path(folder, 'folders') == 'folders'

    with tempfile.TemporaryDirectory() as folder:
        os.mkdir(os.path.join(folder, 'Game A'))
        os.mkdir(os.path.join(folder, 'Game B'))
        assert resolve_scan_mode_for_path(folder, 'auto') == 'folders'
