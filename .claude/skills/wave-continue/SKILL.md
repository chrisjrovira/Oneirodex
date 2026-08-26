---
name: wave-continue
description: >-
  Continues GameTheca wave/program build loops with minimal interruption. Use
  when the user says keep building, next wave, finish the plan, or build until
  blocked. Chains implement → verify-slice → docs-sync and stops only for real
  design forks or missing secrets.
---

# Wave continue

Keep the program moving without checking in after every slice.

## Loop

1. Read the **living head** of `docs/strategy/progress.md` (Ship TLDR · Done · Next · Blocked) for the next **pending** item. Do not load the wave-diary archive.
2. Implement the smallest complete slice of it. A slice is done when the whole vertical is done — route + client wrapper + test + CI entry + doc line — not when the happy path compiles.
3. Run **verify-slice** for the touched areas.
4. Run **docs-sync** — progress board plus whatever the change touched.
5. Report the slice briefly (see below).
6. If the user said "keep building" or "until blocked", start the next pending item without asking.
7. **Stop** only when: a design fork needs a decision (ask at most 2 options), a secret or env value only the user has is missing, or the board is empty.

## Do not

- Stop to ask "should I commit?" — wait for explicit ship language, then use **ship-ready**.
- Re-open closed non-goals (Discord webhooks, bundled marketplace, DRM store download queues).
- Start the next wave before the current one has acceptance evidence.
- Report a slice complete when only part of the vertical landed — say what is missing instead.

## Output each slice

```
### Slice
**Done:** …
**Verify:** …
**Docs touched:** …
**Next:** … | STOP: <reason>
```

## Bringing in a specialist

Most slices do not need one. When a slice sits squarely in a domain seat's territory — ROM/DAT taxonomy, Unraid volume layout, accessibility audit, art direction — the matching subagent in `.cursor/agents/` carries that context. Launch one only when the user asks for it; otherwise just do the work.

Locked defaults: [docs/dev/agent-locks.md](../../../docs/dev/agent-locks.md).
