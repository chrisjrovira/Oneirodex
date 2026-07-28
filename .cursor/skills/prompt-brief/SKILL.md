---
name: prompt-brief
description: >-
  Token-optimizing middleman for GameTheca. Compresses the user's latest message
  into a short structured Brief before exploring or coding. Use at the start of
  every new task message, especially long, vague, multi-wave, or pasted reports.
  Prevents redundant clarifying questions and re-asking locked product defaults.
---

# Prompt brief (input middleman)

**Goal:** Spend tokens on work, not re-parsing intent. Compress once → execute.

## When

On each **new user task** (feature, fix, wave, docs, ship, triage): run this **before** broad codebase exploration. Do not announce “running middleman.”

Skip only for pure yes/no, “commit that,” or single-file typos with zero ambiguity.

## Compress → Brief (≤12 lines, private or shown once)

```
### Brief
**Goal:** <1 line>
**Mode:** build | fix | triage | docs | ship | verify | ask
**Scope:** <paths/areas or "infer">
**In:** <must ship>
**Out:** <explicit non-goals + locked defaults>
**Verify:** <smallest checks>
**Docs:** sync | N/A
**Ask:** <≤2 questions or none — then proceed>
```

Then **execute** the Mode skill (below). Do not wait for confirmation unless Ask is non-empty **and** blocked.

## Mode → skill

| Mode | Follow |
|---|---|
| build | If multi-area / Unraid / team / wave → **act as PM** (`agent-pm` + Task seats); else implement + docs-sync; wave-continue if “keep building / next wave” |
| fix | issue-fix if GitHub/ticket; else smallest fix + verify-slice (or Task `@agent-backend` / `@agent-uiux` when non-trivial) |
| triage | issue-assess only |
| docs | Task `@agent-docs` (docs-sync + **program canvas**) when non-trivial |
| ship | ship-ready |
| verify | Task `@agent-qa` or verify-slice |
| ask | ≤2 questions, then stop |

**PM disperse:** On multi-seat work the parent **must not** land product code — see `agent-team` + always-apply `pm-disperse.mdc`.

## Locked defaults (never re-ask)

Read [defaults.md](defaults.md). Highlights:

- No Discord / webhooks / auto-merge / force-push
- No bundled torrent/debrid marketplace / DRM store download/install queues / always-on paid LLM in Flask
- Docs-sync on every code change
- Commit/push only when user says ship/commit/push
- Prefer Unraid + Compose; GitHub Issues for support
- Author commits as `cephyrix_zyth` via `-c` flags when shipping (never `git config`)

## Input hygiene

- Truncate pasted logs to ≤40 lines / 2KB in the Brief.
- Map slang: “wave N”, “ship it”, “keep going”, “gap review”, “canvas” → Mode.
- Multi-item messages → one Brief with ordered bullets; do not spawn parallel full plans unless asked.

## Anti-patterns

- Re-asking product stance already in defaults.md
- Long restatements of the user message
- Exploring the whole monorepo before Brief
- Planning essays when Mode is build and Scope is clear
