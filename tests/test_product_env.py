"""Product env names (ADR 0003).

The dual-prefix era is over: ``ONEIRODEX_*`` is the only accepted prefix and
the ``GT_*`` fallback was deleted in the clean-break rename. These tests pin
that, so a well-meaning re-introduction of the legacy prefix fails here first.
"""

from pathlib import Path

from product_env import PREFIX, getenv_product, getenv_product_int

REPO = Path(__file__).resolve().parents[1]


def test_prefix():
    assert PREFIX == 'ONEIRODEX_'


def test_reads_the_product_prefix(monkeypatch):
    monkeypatch.setenv('ONEIRODEX_LIBRARY_ROOTS', '/new')
    assert getenv_product('LIBRARY_ROOTS') == '/new'


def test_legacy_gt_prefix_is_ignored(monkeypatch):
    """The whole point of the clean break — GT_* must no longer be consulted."""
    monkeypatch.delenv('ONEIRODEX_LIBRARY_ROOTS', raising=False)
    monkeypatch.setenv('GT_LIBRARY_ROOTS', '/legacy')
    assert getenv_product('LIBRARY_ROOTS') is None
    assert getenv_product('LIBRARY_ROOTS', 'fallback') == 'fallback'


def test_blank_value_falls_through_to_default(monkeypatch):
    monkeypatch.setenv('ONEIRODEX_LIBRARY_ROOTS', '   ')
    assert getenv_product('LIBRARY_ROOTS', 'fallback') == 'fallback'


def test_default_when_unset(monkeypatch):
    monkeypatch.delenv('ONEIRODEX_LIBRARY_ROOTS', raising=False)
    assert getenv_product('LIBRARY_ROOTS', 'fallback') == 'fallback'


def test_int_reads_and_clamps(monkeypatch):
    monkeypatch.setenv('ONEIRODEX_SCAN_THREAD_CAP', '2')
    assert getenv_product_int('SCAN_THREAD_CAP', 4, minimum=1, maximum=8) == 2
    monkeypatch.setenv('ONEIRODEX_SCAN_THREAD_CAP', '999')
    assert getenv_product_int('SCAN_THREAD_CAP', 4, minimum=1, maximum=8) == 8
    monkeypatch.setenv('ONEIRODEX_SCAN_THREAD_CAP', 'not-a-number')
    assert getenv_product_int('SCAN_THREAD_CAP', 4, minimum=1, maximum=8) == 4


def test_int_ignores_legacy_gt_prefix(monkeypatch):
    monkeypatch.delenv('ONEIRODEX_SCAN_THREAD_CAP', raising=False)
    monkeypatch.setenv('GT_SCAN_THREAD_CAP', '2')
    assert getenv_product_int('SCAN_THREAD_CAP', 4, minimum=1, maximum=8) == 4


def test_compose_passes_library_roots_into_the_container():
    """Compose has no env_file, so a host-only value never reaches the app."""
    text = (REPO / 'docker-compose.yml').read_text(encoding='utf-8')
    assert '- ONEIRODEX_LIBRARY_ROOTS=${ONEIRODEX_LIBRARY_ROOTS:-}' in text
    # The legacy key must not linger as a second, duplicate entry.
    assert 'GT_LIBRARY_ROOTS' not in text
