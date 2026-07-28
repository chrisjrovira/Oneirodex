# Cursor agent skills (GameTheca)

Token-efficient workflows for maintainers and teammates. Skills live in `.cursor/skills/`. Always-apply rules in `.cursor/rules/`.

## Auto (every task)

| Skill / rule | Role |
|---|---|
| **prompt-brief** | Middleman — compress user input → Brief → route |
| **docs-sync** | Update docs/canvas before claiming done; Docs refreshes live README screenshots on every commit/ship pass ([CAPTURE.md](../assets/readme/CAPTURE.md)) |
| Rules: `prompt-brief.mdc`, `docs-sync.mdc` | Always on |

## On demand

| Skill | Trigger words | Does |
|---|---|---|
| **wave-continue** | keep building, next wave, finish plan | Slice loop until blocked |
| **verify-slice** | verify, test, smoke | Smallest pytest/vitest |
| **ship-ready** | commit, push, ship, PR | Conventional commit (+ push if asked) |
| **issue-assess** | triage, assess ticket | Severity / area only |
| **issue-fix** | fix #N, implement ticket | Code + PR, no auto-merge |

## Multi-agent team (roles)

Attach with `@` in a chat (skills have `disable-model-invocation: true` — explicit only). Matching rules live in `.cursor/rules/agent-*.mdc`.

| Skill | Owns |
|---|---|
| **agent-team** | Index + how to run a wave |
| **agent-pm** | Backlog, sequencing, briefs (no large code) |
| **agent-uiux** | Member SPA + theme UX only |
| **agent-backend** | Flask/ASGI/APIs/schema |
| **agent-desktop** | Tauri companion (`clients/desktop`) |
| **agent-qa** | Repro, smoke, DoD verification |
| **agent-docs** | Docs/changelog only (seat 6) — **program canvas mandatory every Docs turn** |
| **agent-gamemaster** | Games/systems/formats/DAT/metadata domain (seat 7) |
| **agent-ops** | Unraid/Compose health, ops glance, probes (seat 8) |

Typical wave (Task-first): parent acts as **PM** → optional GM/Ops consult → **Task** implementers in parallel → Task **QA** → Task **Docs** (docs-sync + program canvas Done/Next/Blocked/Team flow). Parent does **not** land product code when seats exist (always-apply `pm-disperse.mdc`).

**Program canvas (mandatory every Docs turn):**  
`C:\Users\cephyrix_zyth\.cursor\projects\c-Users-cephyrix-zyth-Desktop-gametheca\canvases\gametheca-program.canvas.tsx` — Docs rewrites TLDR/Done/Next/Blocked/Team flow every Docs seat turn / docs-sync / wave end (not only when PM says “update canvas”); PM owns the content brief and refuses to close waves without **Canvas: synced**.

**Unraid test bed:** Ops sections games RO vs library RW mounts; Backend keeps Admin → Ops / scan progress honest; QA smokes `/readyz` + Ops glance.

Official **1.0.0** gate board: [../strategy/v1-readiness.md](../strategy/v1-readiness.md).

## Custom Agent paste (middleman)

Use as a Custom Agent system prompt for cheapest first pass:

```
You are GameTheca Prompt Brief. Compress the user message into a Brief; do not implement unless they also say "build" or "fix".

Locked: no Discord webhooks; no bundled torrent/debrid marketplace; no DRM store download/install queues; no auto-merge; docs-sync on code; commit only if they say ship/commit.

Output exactly:
### Brief
**Goal:**
**Mode:** build|fix|triage|docs|ship|verify|ask
**Scope:**
**In:**
**Out:**
**Verify:**
**Docs:** sync|N/A
**Ask:** none|<≤2 Qs>

≤12 lines. If Mode=ask, stop. Else one-line next skill to run.
```

Then open a second Agent chat with the Brief + `@wave-continue` / `@issue-fix` / etc.

## Related

- Support flow: [issue-assess-agent.md](issue-assess-agent.md)
- Defaults: `.cursor/skills/prompt-brief/defaults.md`
- Docs inventory: [../strategy/docs-map.md](../strategy/docs-map.md)
