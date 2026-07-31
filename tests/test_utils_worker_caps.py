# tests/test_utils_worker_caps.py
import os

from gametheca.models import GlobalSettings
from gametheca.routes_admin_ext.settings import (
    DEFAULT_BATCH_SIZE,
    DEFAULT_DOWNLOAD_THREADS,
    DEFAULT_SETTINGS,
    MAX_SCAN_THREADS,
)
from gametheca.utils.worker_caps import (
    clamp_image_download_batch,
    clamp_image_download_threads,
    clamp_scan_threads,
    iter_chunks,
)


def test_clamp_scan_threads_respects_cap(monkeypatch):
    monkeypatch.delenv('GT_SCAN_THREAD_CAP', raising=False)
    assert clamp_scan_threads(99) == 4
    assert clamp_scan_threads(1) == 1
    assert clamp_scan_threads(None) == 1


def test_clamp_scan_threads_env_override(monkeypatch):
    monkeypatch.setenv('GT_SCAN_THREAD_CAP', '2')
    assert clamp_scan_threads(8) == 2


def test_clamp_image_threads_and_batch(monkeypatch):
    monkeypatch.delenv('GT_IMAGE_DOWNLOAD_THREAD_CAP', raising=False)
    monkeypatch.delenv('GT_IMAGE_DOWNLOAD_BATCH_CAP', raising=False)
    assert clamp_image_download_threads(20) == 4
    assert clamp_image_download_batch(999) == 100


def test_unraid_safe_stored_defaults():
    """Ops Wave 1: new-row / API defaults stay Unraid-safe; caps remain separate."""
    assert GlobalSettings.scan_thread_count.default.arg == 1
    assert GlobalSettings.turbo_download_threads.default.arg == 4
    assert GlobalSettings.turbo_download_batch_size.default.arg == 100
    assert DEFAULT_SETTINGS['scanThreadCount'] == 1
    assert DEFAULT_DOWNLOAD_THREADS == 4
    assert DEFAULT_BATCH_SIZE == 100
    assert DEFAULT_SETTINGS['turboDownloadThreads'] == 4
    assert DEFAULT_SETTINGS['turboDownloadBatchSize'] == 100
    assert MAX_SCAN_THREADS == 4


def test_iter_chunks():
    assert list(iter_chunks([1, 2, 3, 4, 5], 2)) == [[1, 2], [3, 4], [5]]
