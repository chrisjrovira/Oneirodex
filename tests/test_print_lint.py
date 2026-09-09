"""The print() ratchet detector, and the reason it exists.

The backend shipped with no logging config and ~900 ``print()`` call sites.
``scripts/print_lint.py`` is the ratchet that stops that number climbing back
up while the migration to ``logging`` happens file by file — same model as
``scripts/api_envelope_lint.py``.

These tests cover the detector, not the current count: a test asserting "644"
would fail on every genuine improvement, which is the opposite of the point.
No database needed.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import print_lint as lint  # noqa: E402


def _count(tmp_path: Path, source: str) -> int:
    target = tmp_path / "probe.py"
    target.write_text(source, encoding="utf-8")
    return lint.count_print_calls(target)


@pytest.mark.parametrize(
    "source",
    [
        "def v():\n    print('hi')\n",
        "def v(x=1):\n    print(f'value {x}')\n",
        "def v():\n    print('a', 'b', 'c')\n",
        "def v():\n    print(\n        'multi',\n        'line',\n    )\n",
    ],
)
def test_real_print_calls_are_counted(tmp_path, source):
    assert _count(tmp_path, source) == 1


@pytest.mark.parametrize(
    "snippet",
    [
        "logger.info('hi')",
        "pprint(obj)",
        "obj.print('hi')",
        "x = 'print(' + rest",
        "# print('commented out')",
    ],
)
def test_non_builtin_print_is_not_counted(tmp_path, snippet):
    assert _count(tmp_path, f"def v(obj=None, rest=''):\n    {snippet}\n") == 0


def test_utf8_bom_does_not_hide_calls(tmp_path):
    target = tmp_path / "probe.py"
    target.write_bytes(b"\xef\xbb\xbfdef v():\n    print('x')\n")
    assert lint.count_print_calls(target) == 1


def test_a_syntax_error_does_not_crash_the_lint(tmp_path):
    assert _count(tmp_path, "def broken(:\n") == 0


def test_updateschema_is_exempt():
    """An operator-run migration script whose progress print is its interface."""
    assert "oneirodex/updateschema.py" in lint.EXEMPT


def test_baseline_exists_and_is_sorted():
    raw = (ROOT / "scripts" / "print_lint.baseline.json").read_text(encoding="utf-8")
    data = json.loads(raw)
    assert data, "baseline is empty — the ratchet would allow anything"
    assert list(data) == sorted(data)
    assert all(isinstance(v, int) and v > 0 for v in data.values())


def test_migrated_hot_files_stay_off_the_baseline():
    """utilities.py / game_core.py / __init__.py were migrated to logging in
    A0.4; a regression there should trip the ratchet, so they must not carry a
    recorded allowance."""
    data = json.loads(
        (ROOT / "scripts" / "print_lint.baseline.json").read_text(encoding="utf-8")
    )
    for migrated in (
        "oneirodex/utilities.py",
        "oneirodex/utils/game_core.py",
        "oneirodex/__init__.py",
    ):
        assert migrated not in data


def test_regression_is_reported_and_improvement_is_not():
    regressions, improvements = lint.compare({"a.py": 5}, {"a.py": 4})
    assert regressions and not improvements

    regressions, improvements = lint.compare({"a.py": 3}, {"a.py": 4})
    assert improvements and not regressions

    regressions, _ = lint.compare({"new.py": 1}, {})
    assert regressions
