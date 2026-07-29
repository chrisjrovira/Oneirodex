---
name: agent-team
description: >-
  Index of GameTheca multi-agent roles and how to run a Task-first wave with
  canvas updates. Use when @agent-team, starting a multi-seat wave, asking which
  seat owns work, or refining team process.
---

# Agent team (GameTheca)

Parent chat defaults to **PM**. Seats are invoked via **Task** (preferred) or `@agent-*`. Skills use `disable-model-invocation: true` — attach explicitly.

## Roles

| Seat | Skill | Owns | Does not |
|---|---|---|---|
| PM | `agent-pm` | Briefs, sequencing, Task dispersion, canvas content brief | Product code / Compose / SPA / docs prose |
| 1 | `agent-uiux` | Member + admin SPA chrome, theme UX | Flask/API/Docker/Tauri product logic |
| 2 | `agent-backend` | Flask/ASGI/APIs/schema/runtime | UI polish / Unraid runbook prose alone |
| 3 | `agent-desktop` | Tauri companion | Member SPA redesign |
| 4 | `agent-qa` | Repro, tests, smoke, DoD evidence | Speculative product refactors |
| 6 | `agent-docs` | Docs/help/changelog + **program canvas** | Behavior / schema changes |
| 7 | `agent-gamemaster` | Games/systems/formats/DAT/metadata domain | Scrapes / large feature dumps |
| 8 | `agent-ops` | Unraid/Compose/volumes/probes/ops glance | Member SPA redesign |

## How to run a wave (Task-first)

1. Brief → backlog rows with **owner seat**
2. Consult GM (platforms/ROMs/DAT) and/or Ops (Unraid/Compose) when needed
3. **Parallel Task** implementers (uiux / backend / desktop / ops)
4. Task QA against DoD
5. Task Docs — docs-sync + **Canvas: synced** (mandatory)
6. PM synthesizes Status · Backlog · Dispatched · Open decisions ≤3

### Program canvas

`C:\Users\cephyrix_zyth\.cursor\projects\c-Users-cephyrix-zyth-Desktop-gametheca\canvases\gametheca-program.canvas.tsx`  
Docs rewrites every Docs turn; PM refuses to close waves without **Canvas: synced**.

## Shared Task prompt skeleton

Every implementer Task from PM must include:

```text
You are GameTheca @agent-<seat>. Follow .cursor/skills/agent-<seat>/SKILL.md.

## Brief
**Goal:** …
**In:** …
**Out:** (locked defaults + non-goals)
**Paths:** …
**DoD:** …
**Verify:** …

## Rules
- Honor prompt-brief/defaults.md
- No Discord/webhooks; OIDC opt-in; no commit unless human said ship/commit
- End with seat End-of-turn format from your SKILL.md
```

## Shared locks

See `prompt-brief/defaults.md`:

- OIDC/auth **opt-in**; dangerous apply gates stay off
- No Discord/webhooks; no romhacking.net scrape; no pirate marketplace
- Commit only when user says ship/commit; **ship-ready always pushes**
- Parent PM does not land product code when Task seats exist (`pm-disperse.mdc`)

## Unraid test bed

Ops: games RO vs library RW. Backend: Ops/scan honesty. QA: `/readyz` + Ops glance. Docs: Blocked until human deploy.
