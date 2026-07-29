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
2. **Act as PM** when the slice is multi-area / Unraid / team — **Task** the owning seat(s) per `agent-team` router. Parent does **not** land product code when seats exist (`pm-disperse.mdc`).
3. Single-seat clear ownership: Task that seat (or implement only if human explicitly pinned one seat and said to stay in-parent — rare).
4. After land → **verify-slice** or Task QA for touched areas.
5. Task Docs / **docs-sync** (canvas + progress) — refuse slice-close without **Canvas: synced** on wave ends.
6. Brief status (≤8 lines): done · next · blockers · Dispatched.
7. If user said “keep building” / “until blocked” → start next pending item.
8. **Stop** only when: design fork (ask ≤2 options), missing secret/env only user has, or board empty.

## Do not

- Parent code-dump an entire multi-seat wave
- Stop to ask “commit?” — wait for ship language
- Re-open closed non-goals (Discord webhooks, bundled marketplace, DRM store queues)
- Start Wave N+2 before N acceptance checks exist
- Skip wrong-seat refuse / handoffs

## Output each slice

```
### Slice
**Done:** …
**Dispatched:** …
**Verify:** …
**Docs touched:** …
**Canvas:** synced | pending | n/a
**Next:** … | STOP: <reason>
```
