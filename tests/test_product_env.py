"""Dual product env names (ADR 0003 phase 3a)."""

from pathlib import Path

from product_env import LEGACY_PREFIX, NEW_PREFIX, getenv_product, getenv_product_int

REPO = Path(__file__).resolve().parents[1]


def test_prefixes():
    assert NEW_PREFIX == 'ONEIRODEX_'
    assert LEGACY_PREFIX == 'GT_'


def test_new_prefix_wins(monkeypatch):
    monkeypatch.setenv('GT_LIBRARY_ROOTS', '/legacy')
    monkeypatch.setenv('ONEIRODEX_LIBRARY_ROOTS', '/new')
    assert getenv_product('LIBRARY_ROOTS') == '/new'


def test_legacy_still_works(monkeypatch):
    monkeypatch.delenv('ONEIRODEX_LIBRARY_ROOTS', raising=False)
    monkeypatch.setenv('GT_LIBRARY_ROOTS', '/legacy')
    assert getenv_product('LIBRARY_ROOTS') == '/legacy'


def test_empty_new_key_does_not_hide_legacy(monkeypatch):
    monkeypatch.setenv('ONEIRODEX_LIBRARY_ROOTS', '   ')
    monkeypatch.setenv('GT_LIBRARY_ROOTS', '/legacy')
    assert getenv_product('LIBRARY_ROOTS') == '/legacy'


def test_default_when_unset(monkeypatch):
    monkeypatch.delenv('ONEIRODEX_LIBRARY_ROOTS', raising=False)
    monkeypatch.delenv('GT_LIBRARY_ROOTS', raising=False)
    assert getenv_product('LIBRARY_ROOTS', 'fallback') == 'fallback'


def test_int_new_prefix_wins(monkeypatch):
    monkeypatch.setenv('GT_SCAN_THREAD_CAP', '8')
    monkeypatch.setenv('ONEIRODEX_SCAN_THREAD_CAP', '2')
    assert getenv_product_int('SCAN_THREAD_CAP', 4, minimum=1, maximum=8) == 2


def test_compose_interpolates_both_library_roots_prefixes():
    """Compose has no env_file; host-only ONEIRODEX_LIBRARY_ROOTS never reached the container."""
    text = (REPO / 'docker-compose.yml').read_text(encoding='utf-8')
    assert '- ONEIRODEX_LIBRARY_ROOTS=${ONEIRODEX_LIBRARY_ROOTS:-}' in text
    assert '- GT_LIBRARY_ROOTS=${GT_LIBRARY_ROOTS:-}' in text
