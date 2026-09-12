"""The request.get_json ratchet detector.

``scripts/get_json_lint.py`` stops hand-rolled JSON body reads climbing back
up while ``@validate_body`` / ``@validate_batch_body`` adoption happens file
by file — same model as ``scripts/print_lint.py``.

These tests cover the detector, not the current count: a test asserting a
fixed census would fail on every genuine wrap, which is the opposite of the
point. No database needed.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import get_json_lint as lint  # noqa: E402


def _count(tmp_path: Path, source: str) -> int:
    target = tmp_path / "probe.py"
    target.write_text(source, encoding="utf-8")
    return lint.count_get_json_calls(target)


@pytest.mark.parametrize(
    "source",
    [
        "def v():\n    return request.get_json()\n",
        "def v():\n    data = request.get_json(silent=True) or {}\n",
        "def v():\n    return request.get_json(\n        silent=True,\n    )\n",
    ],
)
def test_real_request_get_json_calls_are_counted(tmp_path, source):
    assert _count(tmp_path, source) == 1


@pytest.mark.parametrize(
    "snippet",
    [
        "return other.get_json()",
        "x = 'request.get_json(' + rest",
        "# request.get_json(silent=True)",
        "return flask.jsonify(payload)",
    ],
)
def test_non_request_get_json_is_not_counted(tmp_path, snippet):
    assert _count(tmp_path, f"def v(other=None, rest='', payload=None):\n    {snippet}\n") == 0


def test_utf8_bom_does_not_hide_calls(tmp_path):
    target = tmp_path / "probe.py"
    target.write_bytes(b"\xef\xbb\xbfdef v():\n    return request.get_json()\n")
    assert lint.count_get_json_calls(target) == 1


def test_a_syntax_error_does_not_crash_the_lint(tmp_path):
    assert _count(tmp_path, "def broken(:\n") == 0


def test_docstring_example_is_not_counted(tmp_path):
    source = '''"""Example::\n\n    data = request.get_json(silent=True) or {}\n"""\n'''
    assert _count(tmp_path, source) == 0


def test_baseline_exists_and_is_sorted():
    raw = (ROOT / "scripts" / "get_json_lint.baseline.json").read_text(encoding="utf-8")
    data = json.loads(raw)
    assert data, "baseline is empty — the ratchet would allow anything"
    assert list(data) == sorted(data)
    assert all(isinstance(v, int) and v > 0 for v in data.values())


def test_regression_is_reported_and_improvement_is_not():
    regressions, improvements = lint.compare({"a.py": 5}, {"a.py": 4})
    assert regressions and not improvements

    regressions, improvements = lint.compare({"a.py": 3}, {"a.py": 4})
    assert improvements and not regressions

    regressions, _ = lint.compare({"new.py": 1}, {})
    assert regressions
