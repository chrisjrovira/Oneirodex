---
name: wave-continue
description: >-
  Continues GameTheca wave/program build loops with minimal interruption. Use
  when the user says keep building, next wave, finish the plan, or build until
  blocked. Chains implement → verify-slice → docs-sync → canvas; stops only for
  real design forks or missing secrets.
---

# Wave continue

## Loop

1. Read `docs/strategy/progress.md` + canvas TodoList for the next **pending** item.
2. Implement the smallest shippable slice (prefer vertical slice over sprawl).
3. Run **verify-slice** for touched areas.
4. Run **docs-sync** (canvas + progress).
5. Brief status (≤8 lines): done · next · blockers.
6. If user said “keep building” / “until blocked” → start next pending item.
7. **Stop** only when: design fork (ask ≤2 options), missing secret/env only user has, or board empty.

## Do not

- Stop to ask “commit?” — wait for ship language
- Re-open closed non-goals (Discord webhooks, bundled marketplace, DRM store queues)
- Start Wave N+2 before N acceptance checks exist

## Output each slice

```
### Slice
**Done:** …
**Verify:** …
**Docs touched:** …
**Next:** … | STOP: <reason>
```
