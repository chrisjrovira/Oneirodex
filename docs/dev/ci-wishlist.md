# CI wishlist

Requests from the modernization tracks for `.github/workflows/**`, which the
backend track does not edit directly. The CI owner applies these.

- [A0.4] Add a step to the `pytest-core` job: `python scripts/print_lint.py`
  (runs alongside `python scripts/api_envelope_lint.py`; no DB needed; fails
  only when a file's `print()` count exceeds its recorded baseline).
