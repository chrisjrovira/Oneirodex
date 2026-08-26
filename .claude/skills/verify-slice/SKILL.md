---
name: verify-slice
description: >-
  Runs the smallest GameTheca verification for the current change. Use when the
  user says verify, test, or smoke, or when ship-ready preflight needs evidence.
  Prefers focused pytest/vitest over the full suite and covers the api-envelope,
  css-token, and button-language ratchets.
---

# Verify slice

Smallest check that actually covers the change. Never claim "all green" after a partial run — say what ran.

Postgres: **`gametheca-review-db`**. Start it if down. First-time setup: [docs/runbooks/local-postgres-pytest.md](../../../docs/runbooks/local-postgres-pytest.md). Ratchet *semantics* live in `.cursor/rules/api-envelope.mdc` and `.cursor/rules/spa-csrf-tokens.mdc`.

## Pick checks (minimum)

| Touched | Run |
|---|---|
| `gametheca/utils/*`, route APIs | `python -m pytest tests/test_<area>.py` (or the nearest existing file) |
| Security / ACL / SSRF | `python -m pytest tests/test_security_suite.py tests/test_security_headers.py tests/test_ssrf_hardening.py tests/test_no_inline_scripts.py` |
| LiveKit / support / GitHub helper | `python -m pytest tests/test_livekit_rtc.py tests/test_github_issues.py` |
| Any route's JSON shape | `python scripts/api_envelope_lint.py` |
| `frontend/member-app` | `npm test -- --run` scoped to one file; build if routes/CSS changed |
| `frontend/member-app` CSS | `node scripts/css-token-lint.mjs`, or `npm run lint:css` |
| `frontend/member-app` buttons | `npm test -- --run src/buttonLanguage.test.js` |
| `frontend/member-app/src/api/*` | `npm test -- --run src/api/envelopeContract.test.js` |
| `frontend/admin-app` | `npm test -- --run` |
| Compose / env only | Docs + a dry read of compose; no full stack unless asked |
| Templates / icons | `python -m pytest tests/test_template_icons.py` if icons changed |

`--update` on a ratchet is only for re-recording after a genuine reduction, never to absorb a new violation.

## Frontend runs are slow here

The repo sits on a NAS mapping, so the member-app suite costs roughly 80s for a single file and over half an hour for the whole thing. Always run it in the background and scope to one file where you can. A backgrounded run's exit code is not trustworthy — read the output file, not the summary.

## CI is not the suite

CI gates a core subset listed in [.github/workflows/ci-tests.yml](../../../.github/workflows/ci-tests.yml). Passing CI is not the same as passing `tests/`, which is local/release-only.

## Rules

- Prefer existing tests; add one focused test if the behavior is new and cheap to cover.
- If Postgres is required and down and cannot be started, say so and run the DB-free tests first — do not fake a pass.
- Report blockers as **blocked**, not as a pass.

## Output

```
### Verify
**Ran:** `…`
**Result:** pass | fail | blocked
**Notes:** …
```

Locked defaults: [docs/dev/agent-locks.md](../../../docs/dev/agent-locks.md).
