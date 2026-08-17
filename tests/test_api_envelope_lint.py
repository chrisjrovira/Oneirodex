"""The UID-018 ratchet, and the reason it exists.

`utils/api_response.py` landed with two route files migrated and the register
recorded the rest as "incremental". Measured a fortnight later the problem had
*grown* — ~699 `jsonify` call sites across ~72 files became 1194 across 84,
because new routes kept reaching for the old shapes faster than old ones were
converted. Incremental migration against a baseline growing that fast never
converges, which is why counting progress by files-migrated was misleading.

`scripts/api_envelope_lint.py` is the ratchet: existing call sites are recorded
and tolerated, a file may never exceed its recorded count, and a file with no
record may have none. Same model as `css-token-lint.mjs`, which is what took the
CSS violations from 2365 to 1305.

These tests cover the detector rather than the current count — a test asserting
"875" would fail on every genuine improvement, which is the opposite of the
point. No database needed.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))

import api_envelope_lint as lint  # noqa: E402


def _count(tmp_path: Path, source: str) -> int:
    target = tmp_path / 'routes_probe.py'
    target.write_text(source, encoding='utf-8')
    return lint.count_violations(target)


@pytest.mark.parametrize('snippet', [
    "jsonify({'error': 'Admin required'}), 403",
    "jsonify({'message': 'Saved'})",
    "jsonify({'status': 'ok'})",
    "jsonify({'success': True})",
    "jsonify({'ok': False, 'detail': 'x'})",
    "jsonify(error='Admin required')",
])
def test_every_legacy_shape_is_caught(tmp_path, snippet):
    """All five competing shapes the helper exists to replace, plus the kwarg
    spelling of the same thing."""
    assert _count(tmp_path, f'def v():\n    return {snippet}\n') == 1


@pytest.mark.parametrize('snippet', [
    "jsonify(games)",
    "jsonify({'items': [1, 2], 'total': 2})",
    "jsonify({'sync_mode': 'snapshot'})",
])
def test_data_responses_are_not_violations(tmp_path, snippet):
    """The envelope is about how success and failure are reported, not about
    every JSON response. Flagging `jsonify(games)` would make the rule noise and
    guarantee it gets ignored."""
    assert _count(tmp_path, f'def v():\n    return {snippet}\n') == 0


def test_an_envelope_built_into_a_local_name_is_caught(tmp_path):
    """`body = {...}` then `jsonify(body)` is the same response as writing the
    dict inline, and used to count as zero."""
    source = (
        'def v():\n'
        "    body = {'ok': False, 'error': 'nope'}\n"
        '    return jsonify(body), 400\n'
    )
    assert _count(tmp_path, source) == 1


def test_an_envelope_returned_by_a_helper_is_caught(tmp_path):
    """The `patch_catalog` shape: a helper hand-rolls the envelope and the route
    passes it straight to jsonify. Invisible to a dict-literal-only detector,
    which is how that file was recorded as migrated while still doing this."""
    source = (
        'def build():\n'
        "    return {'ok': True, 'extras': 1}\n"
        '\n'
        'def v():\n'
        '    result = build()\n'
        '    return jsonify(result), 201\n'
    )
    assert _count(tmp_path, source) == 1


def test_a_helper_returning_plain_data_is_not_a_violation(tmp_path):
    """Resolution must not turn every helper-backed response into noise."""
    source = (
        'def build():\n'
        "    return {'items': [], 'total': 0}\n"
        '\n'
        'def v():\n'
        '    return jsonify(build())\n'
    )
    assert _count(tmp_path, source) == 0


def test_attribute_calls_are_deliberately_not_resolved(tmp_path):
    """`obj.to_dict()` cannot be tied to one definition — the tree has many —
    and its `status` is usually a real field (a scan's state), not an envelope.
    Guessing here would produce false positives, and a lint that cries wolf gets
    `--update`-ed away, which is the one outcome that breaks the ratchet."""
    source = (
        'def v(job):\n'
        '    return jsonify(job.to_dict())\n'
    )
    assert _count(tmp_path, source) == 0


def test_an_indirect_envelope_counts_once_not_twice(tmp_path):
    """The direct and indirect passes must not both claim the same call site."""
    source = (
        'def v():\n'
        "    body = {'ok': False, 'error': 'x', 'message': 'y'}\n"
        '    return jsonify(body), 400\n'
    )
    assert _count(tmp_path, source) == 1


def test_one_call_with_several_legacy_keys_counts_once():
    """Counting keys rather than call sites would make a single conversion look
    like several, and the baseline would drift against real progress."""
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        target = Path(tmp) / 'p.py'
        target.write_text(
            "def v():\n    return jsonify({'success': False, 'error': 'x', 'message': 'y'})\n",
            encoding='utf-8',
        )
        assert lint.count_violations(target) == 1


def test_a_discarded_envelope_is_caught(tmp_path):
    """`api_error(...)` without a `return` means the handler built a refusal and
    then honoured the request anyway. Never legitimate, so never baselined."""
    import ast

    source = (
        'def v(data):\n'
        '    if not data:\n'
        "        api_error('data required', code='bad_request')\n"
        '    return api_ok({})\n'
    )
    found = lint.find_discarded_envelopes(ast.parse(source))
    assert [name for _, name in found] == ['api_error']


def test_a_returned_envelope_is_not_flagged(tmp_path):
    import ast

    source = (
        'def v(data):\n'
        '    if not data:\n'
        "        return api_error('data required', code='bad_request')\n"
        '    return api_ok({})\n'
    )
    assert lint.find_discarded_envelopes(ast.parse(source)) == []


def test_the_helper_itself_is_exempt():
    """It defines the envelope, including the compatibility keys that keep old
    callers working — flagging it would mean the fix trips its own rule."""
    assert 'gametheca/utils/api_response.py' in lint.EXEMPT


def test_a_syntax_error_does_not_crash_the_lint(tmp_path):
    """A lint that dies on one unparseable file blocks every branch that has
    one, which is how a ratchet gets disabled."""
    assert _count(tmp_path, 'def broken(:\n') == 0


def test_baseline_exists_and_is_sorted():
    """Sorted so a re-record produces a readable diff rather than a reshuffle."""
    raw = (ROOT / 'scripts' / 'api_envelope_lint.baseline.json').read_text(encoding='utf-8')
    data = json.loads(raw)
    assert data, 'baseline is empty — the ratchet would allow anything'
    assert list(data) == sorted(data)
    assert all(isinstance(v, int) and v > 0 for v in data.values())


def test_regression_is_reported_and_improvement_is_not():
    counts = {'a.py': 5}
    regressions, improvements = lint.compare(counts, {'a.py': 4})
    assert regressions and not improvements

    regressions, improvements = lint.compare({'a.py': 3}, {'a.py': 4})
    assert improvements and not regressions

    # A file with no record may have none at all.
    regressions, _ = lint.compare({'new.py': 1}, {})
    assert regressions
