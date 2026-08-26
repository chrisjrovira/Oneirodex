# GameTheca agent skills and agents

Token-efficient workflows for maintainers. Canonical copies live in **both** trees so Cursor and Claude Code resolve the same seats:

| What | Claude Code | Cursor | Invoked |
|---|---|---|---|
| **Skills** — workflows | `.claude/skills/<name>/SKILL.md` | `.cursor/skills/<name>/SKILL.md` | By name (`/<name>`) or automatically when the description matches |
| **Agents** — domain seats | `.claude/agents/<name>.md` | `.cursor/agents/<name>.md` | Launched deliberately (`Task` / `/agent-*`) when a slice sits in that domain |
| **Rules** — glob-scoped | *(none — dropped 2026-08-20)* | `.cursor/rules/*.mdc` | When matching files are in context |
| **Locks** — product + engineering defaults | [agent-locks.md](agent-locks.md) | same | Always apply; never re-ask |

> **2026-08-25 Cursor recreate.** The 2026-08-20 migration parked the team under `.claude/` and dropped the 19 thin Cursor rules. Cursor still loads `.claude/skills` and `.claude/agents` for compatibility, **and** prefers `.cursor/agents/` when the name collides. Skills are duplicated on purpose so `/docs-sync` works if one tree is missing; if a session lists each skill twice, treat `.cursor/skills/` as canonical and ignore the Claude copy. The new rules are five glob files (envelope · SPA CSRF/tokens · docs-sync · desktop · Compose), not the old 19 pointers.

## Product mission

**GameTheca is the self-hosted household gaming sphere** — one Unraid-friendly service that turns a family's **already-owned** PC and console libraries into a shared, honest catalog: scan and match with real metadata, browse Systems and Discover, play where the platform allows (browser · companion · catalog), stay present with household social, and **BYO acquire** for content they choose to add — not a DRM store client, a Discord clone, or a pirate marketplace.

Full text, the build/don't-build table, and the attainment checklist: [agent-locks.md](agent-locks.md).

## Skills

| Skill | Use when | Does |
|---|---|---|
| **docs-sync** | Every code change, before claiming done | Docs matrix + progress board + README capture; ends with **Docs touched:** |
| **verify-slice** | After a fix, or "verify / test / smoke" | Smallest pytest/vitest + the api-envelope and css-token ratchets |
| **wave-continue** | "keep building", "next wave", "until blocked" | implement → verify → docs, looping until a real fork |
| **ship-ready** | **Only** on explicit commit / ship / push / PR | docs gate, conventional commit, mandatory push |
| **issue-assess** | A pasted user report or GitHub issue | Severity · area · repro · next action. Assess only |
| **issue-fix** | "fix #N" after triage | Smallest fix + focused test; never auto-merges |
| **run-gametheca** | "run it", "does this work in the real app?" | Launches uvicorn against the test DB, logs in, calls the JSON API |

`docs-sync` is mandatory on every code change — the rule lives in `CLAUDE.md`.

## Agents (domain seats)

Each carries a mission, its owned paths, what it refuses, and an end-of-turn format. Launch one when a slice genuinely sits in its domain; otherwise just do the work in the main thread.

| Agent | Owns | Does not |
|---|---|---|
| `agent-uiux` | Member + admin SPA chrome, aurora theme CSS, interaction design | Flask/API/Docker/Tauri logic |
| `agent-backend` | Flask/ASGI, models, APIs, schema, runtime (+ Integrations / Acquire / Play / Social lanes) | SPA visual polish |
| `agent-desktop` | Tauri companion (`clients/desktop`), install/update, social window | Member SPA redesign |
| `agent-qa` | Repro, targeted tests, smoke, DoD evidence | Speculative product refactors |
| `agent-docs` | Docs, changelog, HelpPage, README capture, progress board | Behavior or schema changes |
| `agent-gamemaster` | Systems · regions · dump forms · art kinds · fandom naming taxonomy | Scrapes, large feature dumps |
| `agent-ops` | Unraid, Compose, volumes, probes, ops glance | Member SPA redesign |
| `agent-art` | Brand/logo, cover and theme art direction, loaders, screensaver creative | Flask/Unraid work |
| `agent-creative` | Narrative, discovery zones, screensaver lore, brand voice | Pixel tokens alone |
| `agent-platform` | Cutting-edge runtime/technique ADRs → Backend DoD | Day-to-day route bugs |
| `agent-finance` | Cloud vs Unraid TCO honesty | Billing implementation |
| `agent-hardware` | Controllers, VR, TV/10-foot, Unraid host sizing | Scan matching |
| `agent-a11y` | Accessibility audits + DoD for UI | Large SPA rewrites alone |

### Intent → owner

| Intent | Owner | Also |
|---|---|---|
| Tile/badge/TopNav/Discover/theme/Art Studio UI | uiux | backend if the API is missing |
| Scan/API/schema/ASGI/SSE/flags/ownership APIs | backend | gamemaster for taxonomy |
| Companion EXE / thin / keyring / Friends window | desktop | — |
| Unraid / Compose / mounts / disk / probes | ops | backend for honesty fields |
| "Is it true / smoke / DoD" | qa | — |
| Docs / Help / CHANGELOG / README shots | docs | — |
| Platform/ROM/DAT/IGDB match / Quest taxonomy | gamemaster | backend implements |
| Logo / cover art direction / system theme skins | art | uiux (+ backend Art Studio) |
| Discovery zones story / screensaver narrative / voice | creative | art + uiux |
| Cutting-edge ASGI/WASM/queue technique | platform | backend implements |
| Cloud TCO / run cost | finance | ops + docs |
| Controllers / VR / TV / host sizing | hardware | desktop + ops |
| A11y / focus / contrast / motion-safe | a11y | uiux |
| Meta/Quest/store search / SGDB / providers | backend (Integrations lane) | gamemaster stance |
| *arr / debrid / challenge solver | backend (Acquire lane) | ops profile |

### Lanes (not separate agents)

Route through the owning agent and name the lane in the task title so sphere coverage stays trackable.

| Lane | Route to | Use when |
|---|---|---|
| **Integrations** | backend (+ gamemaster consult) | IGDB, SteamGridDB, store search, ownership CSV/sync, Meta/Quest, provider keys |
| **Acquire** | backend (+ ops) | Prowlarr/Jackett/qBit/NZBGet/debrid, challenge profile |
| **Play** | backend (+ gamemaster + uiux) | WebRetro, ROM delivery, play rooms, BIOS honesty |
| **Social** | backend (+ uiux + desktop) | Chat, presence, LiveKit, Friends companion |
| **Security** | backend (+ qa + docs) | SSRF, malware scan, scrub, path ACL |

Promote a lane to a full agent only when it carries sustained parallel load.

## Wrong-seat rule

Every agent refuses out-of-scope product work: stop, name the correct agent, and return a handoff rather than "just finishing it". Wrong-seat examples: ops redesigns the SPA; backend rewrites Unraid prose alone; uiux invents Flask routes; docs changes schema; gamemaster scrapes external ROM sites.

## Unraid test bed

Ops sections games RO vs library RW; backend keeps Ops/scan honest; QA smokes `/readyz` plus the Ops glance.

## Related

- Locks / defaults: [agent-locks.md](agent-locks.md)
- Support triage: [issue-assess-agent.md](issue-assess-agent.md)
- Docs inventory: [../strategy/docs-map.md](../strategy/docs-map.md)
- UI debt register: [ui-debt-log.md](ui-debt-log.md)
- v1 gate: [../strategy/v1-readiness.md](../strategy/v1-readiness.md)
