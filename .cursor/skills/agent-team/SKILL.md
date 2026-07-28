---
name: agent-team
description: >-
  Index of GameTheca multi-agent roles and how to run a wave with Task
  dispersion + canvas updates. Use when @agent-team, starting a multi-seat wave,
  or asking which role owns a task.
---

# Agent team (GameTheca)

## Roles

| @ skill | Owns | Does not |
|---|---|---|
| `agent-pm` | Backlog, sequencing, Task briefs, canvas content brief | Product code / Compose / SPA |
| `agent-uiux` | Member SPA + theme UX | Flask/API/Docker/Tauri |
| `agent-backend` | Flask/ASGI/APIs/schema | UI polish / Unraid prose |
| `agent-desktop` | Tauri companion | Member SPA redesign |
| `agent-qa` | Repro, tests, smoke, reports | Speculative refactors |
| `agent-docs` | Docs/help/changelog + **program canvas** (seat 6) | Behavior changes |
| `agent-gamemaster` | Games/systems/formats domain (seat 7) | Scrapes / large feature dumps |
| `agent-ops` | Unraid/Compose health, volumes, ops glance, probes (seat 8) | Member SPA redesign |

## How to run a wave (Task-first)

Default parent chat is **PM**. Do not implement as the parent.

1. `@agent-pm` / parent Brief → backlog + owner seats
2. Consult `@agent-gamemaster` when platforms/ROMs/DAT/metadata
3. Consult `@agent-ops` when Unraid/Compose/volumes/health/monitor
4. **Task tool** → parallel implementers (`uiux` / `backend` / `desktop` / `ops`)
5. Task `@agent-qa` against DoD
6. Task `@agent-docs` — docs-sync **and** program canvas Done/Next/Blocked/Team flow
7. PM synthesizes seat reports for the user

### Program canvas path

`C:\Users\cephyrix_zyth\.cursor\projects\c-Users-cephyrix-zyth-Desktop-gametheca\canvases\gametheca-program.canvas.tsx`

Docs updates it every wave; PM supplies the Done/Next brief in the Docs Task prompt.

## Unraid as test bed

Ops owns Compose + volume sectioning (`DATA_FOLDER_GAMES` → `/storage:ro`,  
`LIBRARY_HOST_PATH` → library uploads RW). Backend owns Ops API honesty while
scans run. QA verifies on Unraid. Docs records Blocked until human deploy.

## Shared locks

See `prompt-brief/defaults.md`. Always:

- OIDC/auth **opt-in** (off by default)
- Dangerous apply gates stay off
- No Discord/webhooks; no romhacking.net scrape
- Commit/push only when user says so
- Parent PM does not land code when Task seats can
