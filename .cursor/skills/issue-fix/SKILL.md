---
name: issue-fix
description: >-
  Implements a fix for a GameTheca GitHub support issue after triage. Use when
  the user pastes an issue URL or number and asks to fix it, or after
  issue-assess recommends code work. Never auto-merges and never force-pushes.
---

# GameTheca issue fix

Fix only. Prefer the smallest change that closes the report.

## Input

- GitHub issue URL or number (repo `chrisjrovira/gametheca`)
- Optional: `issue-assess` triage output
- Optional: an Unraid/Compose/native deploy hint from the ticket

## Do

1. Read the issue — title, body, labels, comments. Confirm severity and area. Use `gh` for GitHub work.
2. Reproduce minimally (pytest slice, curl, or the local SPA). If blocked, ask at most 2 questions.
3. Implement the smallest fix. Match the surrounding patterns; no drive-by refactors.
4. Add or adjust a focused test when practical.
5. Run **verify-slice** for the touched paths.
6. Run **docs-sync** if behavior, env, or UI moved.
7. Commit only when the user asks to ship — then use **ship-ready**, referencing `#<n>` in the message.

## Don't

- Poll GitHub from the Flask app or embed paid LLM API keys.
- Expand scope into unrelated waves.
- Skip verification when a cheap check exists.
- Auto-merge, or force-push to `main`.

## Output

```
### Fix
**Issue:** #n · …
**Change:** …
**Verify:** `…`
**PR:** url or "local commit only"
**Follow-up:** none | need-info | docs
```

Locked defaults: [docs/dev/agent-locks.md](../../../docs/dev/agent-locks.md).
