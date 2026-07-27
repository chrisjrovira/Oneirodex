---
name: issue-fix
description: >-
  Implements a fix for a GameTheca GitHub support issue after triage. Use when
  a maintainer pastes an issue URL/number and asks to fix it, or after
  @issue-assess recommends code work. Do not auto-merge or force-push.
disable-model-invocation: true
---

# GameTheca issue fix

Fix only. Prefer the smallest change that closes the report.

## Input

- GitHub issue URL or number (repo default `chrisjrovira/gametheca`)
- Optional: `@issue-assess` triage output
- Optional: Unraid/Compose/native deploy hint from the ticket

## Do

1. Read the issue (title, body, labels, comments). Confirm sev/area.
2. Reproduce minimally (pytest slice, curl, or local SPA). Stop if blocked — ask ≤2 questions.
3. Implement the smallest fix. Match existing patterns; no drive-by refactors.
4. Add/adjust a focused test when practical.
5. Commit with conventional message (`fix:` / `chore:`) referencing `#<n>` when known.
6. Open a PR if asked; **never** auto-merge; **never** force-push to main.

## Don't

- Poll GitHub from the Flask app or embed paid LLM API keys.
- Expand scope into unrelated waves.
- Skip verification when a cheap check exists.

## Output

```
### Fix
**Issue:** #n · …
**Change:** …
**Verify:** `…`
**PR:** url or "local commit only"
**Follow-up:** none | need-info | docs
```
