---
name: agent-team
description: >-
  Index of GameTheca multi-agent team roles and how to run them together. Use
  when @agent-team, starting a wave with multiple agents, or asking which role
  owns a task.
disable-model-invocation: true
---

# Agent team (GameTheca)

## Roles

| @ skill | Owns | Does not |
|---|---|---|
| `agent-pm` | Backlog, sequencing, briefs | Large code dumps |
| `agent-uiux` | Member SPA + theme UX | Flask/API/Docker/Tauri |
| `agent-backend` | Flask/ASGI/APIs/schema | UI polish |
| `agent-desktop` | Tauri companion | Member SPA redesign |
| `agent-qa` | Repro, tests, smoke, reports | Speculative refactors |
| `agent-docs` | Docs/help/changelog (seat 6) | Behavior changes |
| `agent-gamemaster` | Games/systems/formats domain (seat 7) | Scrapes / large feature dumps |
| `agent-ops` | Unraid/Compose health, ops glance, probes (seat 8) | Member SPA redesign |

## How to run a wave

1. Open a chat → `@agent-pm` → ask for backlog + ready prompts
2. Consult `@agent-gamemaster` when the ticket touches platforms, ROMs, DAT, naming, or metadata quality
3. Consult `@agent-ops` when the ticket touches Unraid, Compose profiles, health probes, or operator monitoring
4. Spawn chats → paste DoD + `@agent-uiux` / `@agent-backend` / `@agent-desktop` / `@agent-ops`
5. After land → `@agent-qa` against DoD
6. `@agent-docs` or docs-sync if implementers skipped docs
7. Feed QA results back to `@agent-pm`

## Shared locks

See `prompt-brief/defaults.md`. Always:

- OIDC/auth **opt-in** (off by default)
- Dangerous apply gates stay off
- No Discord/webhooks; no romhacking.net scrape
- Commit/push only when user says so
