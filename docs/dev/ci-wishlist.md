# CI wishlist

Requests from the modernization tracks for `.github/workflows/**`, which the
backend track does not edit directly. The CI owner applies these.

- [A0.4] Add a step to the `pytest-core` job: `python scripts/print_lint.py`
  (runs alongside `python scripts/api_envelope_lint.py`; no DB needed; fails
  only when a file's `print()` count exceeds its recorded baseline).
- [A0.6] Switch the `pytest-core` job from the hand-listed test files to
  `pytest -m "not integration" --cov=oneirodex --cov-report=term-missing --cov-fail-under=20`.
  `pytest-cov` is pinned in `requirements-dev.txt`. The `integration` marker is
  declared in `pytest.ini`; heavy/thread/live-service modules carry a
  module-level `pytestmark = pytest.mark.integration`. The set of `integration`
  files is deliberately minimal — before flipping, diff `pytest -m "not
  integration" --collect-only -q` against the current hand list so nothing that
  was gated silently stops being gated. `--cov-fail-under` is a low
  current-reality floor, not a target; raise it as coverage climbs.
