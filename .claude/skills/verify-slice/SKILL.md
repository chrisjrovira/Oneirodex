---
name: verify-slice
description: >-
  Runs the smallest GameTheca verification for the current change. Use after
  implementing a feature or fix, before claiming done, or when the user says
  verify, test, or smoke. Prefers focused pytest/vitest over the full suite and
  covers the api-envelope and css-token ratchets.
---

# Verify slice

Smallest check that actually covers the change. Never claim "all green" after a partial run — say what ran.

## Before pytest: is the database up?

Postgres may be down on a fresh session, and pytest stalls rather than failing:

```bash
docker ps -a --format '{{.Names}}\t{{.Status}}'
```

The test database is **`gametheca-review-db`** (postgres:17.6, published on 5432). Start it if it is down:

```bash
docker start gametheca-review-db
```

`TEST_DATABASE_URL` must be set and its database name must contain `test` — `conftest.py` hard-fails otherwise, by design. First-time setup: [docs/runbooks/local-postgres-pytest.md](../../../docs/runbooks/local-postgres-pytest.md).

## Pick checks (minimum)

| Touched | Run |
|---|---|
| `gametheca/utils/*`, route APIs | `python -m pytest tests/test_<area>.py` (or the nearest existing file) |
| Security / ACL / SSRF | `python -m pytest tests/test_security_suite.py` |
| LiveKit / support / GitHub helper | `python -m pytest tests/test_livekit_rtc.py tests/test_github_issues.py` |
| Any route's JSON shape | `python scripts/api_envelope_lint.py` (ratchet — see below) |
| `frontend/member-app` | `npm test -- --run` scoped to one file; build if routes/CSS changed |
| `frontend/member-app` CSS | `node scripts/css-token-lint.mjs` (ratchet), or `npm run lint:css` |
| `frontend/member-app/src/api/*` | `npm test -- --run src/api/envelopeContract.test.js` |
| `frontend/admin-app` | `npm test -- --run` |
| Compose / env only | Docs + a dry read of compose; no full stack unless asked |
| Templates / icons | `python -m pytest tests/test_template_icons.py` if icons changed |

## Frontend runs are slow here

The repo sits on a NAS mapping, so the member-app suite costs roughly 80s for a single file and over half an hour for the whole thing. Always run it in the background and scope to one file where you can. A backgrounded run's exit code is not trustworthy — read the output file, not the summary.

## Ratchets — never regress

Both are baseline-counted per file: a file may never exceed its recorded violation count, and a file with no record must have zero. `--update` is only for re-recording after a genuine reduction, never to absorb a new violation.

```bash
python scripts/api_envelope_lint.py
```

Every route's success/failure JSON goes through `gametheca/utils/api_response.py`. Use `--list` to see every counted site with the reason it counted.

```bash
node scripts/css-token-lint.mjs
```

*Defining* a token may use a literal; *using* a value must go through one.

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
