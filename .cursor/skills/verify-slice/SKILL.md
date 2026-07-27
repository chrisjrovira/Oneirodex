---
name: verify-slice
description: >-
  Runs the smallest GameTheca verification for the current change. Use after
  implementing a feature/fix, before claiming done, or when the user says
  verify/test/smoke. Prefer focused pytest/vitest over full suite.
---

# Verify slice

## Pick checks (minimum)

| Touched | Run |
|---|---|
| `gametheca/utils/*`, routes APIs | `pytest tests/test_<area>.py -q` (or nearest existing) |
| Security / ACL / SSRF | `pytest tests/test_security_suite.py -q` |
| LiveKit / support / GitHub helper | `pytest tests/test_livekit_rtc.py tests/test_github_issues.py -q` |
| `frontend/member-app` | `npm test -- --run` (or path-filtered) + build if routes/CSS |
| `frontend/admin-app` | `npm test -- --run` |
| Compose / env only | Docs + dry-read compose; no full stack unless asked |
| Templates/icons | `pytest tests/test_template_icons.py -q` if icons changed |

## Rules

- Prefer existing tests; add one focused test if behavior is new and cheap.
- If Postgres required and down: note it; run DB-free tests first.
- Do not claim “all green” after a partial slice — say what ran.

## Output

```
### Verify
**Ran:** `…`
**Result:** pass | fail | blocked
**Notes:** …
```
