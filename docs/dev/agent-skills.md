# Cursor agent skills (GameTheca)

Token-efficient workflows for maintainers and teammates. Skills live in `.cursor/skills/`. Always-apply rules in `.cursor/rules/`.

**North star:** household **gaming sphere** — library · systems · ownership/metadata · play · social · admin/ops · BYO acquire.

## Auto (every task)

| Skill / rule | Role |
|---|---|
| **prompt-brief** | Middleman — compress user input → Brief → route |
| **docs-sync** | Docs + canvas before claiming done; README live screenshots on UI ship ([CAPTURE.md](../assets/readme/CAPTURE.md)) |
| Rules: `prompt-brief.mdc`, `docs-sync.mdc`, `pm-disperse.mdc` | Always on — parent chat **is** PM; Task-disperse; **relevant agent only** |

## On demand

| Skill | Trigger words | Does |
|---|---|---|
| **wave-continue** | keep building, next wave, finish plan | PM Task loop until blocked (not parent code dump) |
| **verify-slice** | verify, test, smoke | Smallest pytest/vitest |
| **ship-ready** | commit, push, ship, PR | Conventional commit + **always push**; PM ship helper + wave-close **Canvas: synced** gate |
| **issue-assess** | triage, assess ticket | Severity / area only |
| **issue-fix** | fix #N, implement ticket | Code + PR, no auto-merge |

## Multi-agent team (roles)

Attach with `@` (skills have `disable-model-invocation: true`). Matching rules: `.cursor/rules/agent-*.mdc`. Each seat SKILL includes **When to invoke**, **Wrong-seat refuse**, **Task prompt**, and **End of turn**.

| Seat | Skill | Owns |
|---|---|---|
| PM | **agent-pm** | Backlog, sequencing, Task briefs (no product code); this parent chat is the PM monitor |
| 1 | **agent-uiux** | Member + admin SPA chrome, aurora theme |
| 2 | **agent-backend** | Flask/ASGI/APIs/schema/runtime (+ Integrations / Acquire / Play / Social **lanes**) |
| 3 | **agent-desktop** | Tauri companion (`clients/desktop`) |
| 4 | **agent-qa** | Repro, smoke, DoD evidence |
| 6 | **agent-docs** | Docs/changelog + **program canvas every turn** |
| 7 | **agent-gamemaster** | Games/systems/formats/DAT/metadata |
| 8 | **agent-ops** | Unraid/Compose/volumes/probes/ops glance |
| — | **agent-team** | Index · sphere map · seat router · lanes · human drive shortcuts · ship helpers |

Typical wave: parent **PM** → optional GM/Ops consult → **Task** implementers parallel → Task **QA** → Task **Docs** (docs-sync + **Canvas: synced**). Parent does **not** land product code when seats exist (`pm-disperse.mdc`). Seats **refuse** wrong-seat work and hand off.

**Lanes (not full seats yet):** Integrations · Acquire · Play · Social · Security — named in Task titles; routed via Backend (+ consults). Promote when standing parallel load justifies a seat.

**Program canvas:**  
`C:\Users\cephyrix_zyth\.cursor\projects\c-Users-cephyrix-zyth-Desktop-gametheca\canvases\gametheca-program.canvas.tsx`

**Unraid test bed:** Ops sections games RO vs library RW; Backend keeps Ops/scan honest; QA smokes `/readyz` + Ops glance.

**Human shortcuts:** `@agent-team` · “who owns X?” · “status” · “ship it” · “keep building” · “PM this chat” — see agent-team.

Official **1.0.0** gate: [../strategy/v1-readiness.md](../strategy/v1-readiness.md).

## Custom Agent paste (middleman)

```
You are GameTheca Prompt Brief. Compress the user message into a Brief; do not implement unless they also say "build" or "fix".

Locked: no Discord webhooks; no bundled torrent/debrid marketplace; no DRM store download/install queues; no auto-merge; docs-sync on code; commit when they say ship/commit — ship-ready always pushes; relevant agent only (Task-disperse).

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

## Related

- Support: [issue-assess-agent.md](issue-assess-agent.md)
- Defaults: `.cursor/skills/prompt-brief/defaults.md`
- Docs inventory: [../strategy/docs-map.md](../strategy/docs-map.md)
- Team index: `.cursor/skills/agent-team/SKILL.md`
- Ship: `.cursor/skills/ship-ready/SKILL.md`
