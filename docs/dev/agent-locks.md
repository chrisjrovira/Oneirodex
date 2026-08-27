# Oneirodex agent locks

Canonical product and engineering defaults. Apply them unless the user **explicitly** overrides in the same message — never re-ask what is settled here.

This file replaces the old `.cursor/skills/prompt-brief/defaults.md` and the duplicate "Shared locks" list that used to live in `agent-team`. It is the single source; skills and agents link here rather than restating it.

## Product mission

**Oneirodex is the self-hosted household gaming sphere** — one Unraid-friendly service that turns a family's **already-owned** PC and console libraries into a shared, honest catalog: scan and match with real metadata, browse Systems and Discover, play where the platform allows (browser · companion · catalog), stay present with household social, and **BYO acquire** for content they choose to add.

It is **not** a DRM store client, a Discord clone, or a pirate marketplace.

**North-star surfaces:** library · systems · ownership/metadata · play · social · admin/ops · BYO acquire.

### Why this exists

| We are building… | We are not building… |
|---|---|
| A **multi-user home library** for DRM-free / dumped / owned games on NAS + Compose | A Steam/Epic/PSN download or install client |
| **Honest match + metadata** (IGDB + Class D stores; propose-only when unsure) | Fuzzy auto-import that invents wrong IDs |
| **Play honesty** — Browser / Companion / Catalog badges that match capability | Fake "Play in browser" for Switch / Arcade / Neo Geo AES |
| **Native household social** (chat · presence · optional LiveKit) | Discord bots, webhooks, or Discord-as-product |
| **Operator-owned acquire** (Torznab/Newznab · Prowlarr/Jackett · debrid hubs) | Bundled torrent/debrid marketplace or magnet scrapers past Torznab |
| **Ownership registers** for DRM stores (CSV / sync marks only) | Store download queues or DRM circumvention |
| Scrubbed public surface (no Class A / warez-adjacent brands) | Peer teardown catalogs in tracked docs |

### Attainment checklist

Prioritize against this — every backlog item should advance at least one row, or be explicitly hygiene/process.

1. **Library truth** — leaf libraries, scan depth, skip-dir, Unmatched triage → matched catalog over time
2. **Systems coverage** — correct platform enums + leaves (PC + consoles); tiles appear when Ops creates leaves
3. **Metadata quality** — Stage A–E / DAT / Identify chips; no poisoned App IDs
4. **Play paths** — WebRetro where real; companion/thin where needed; catalog-only when honest
5. **Household multi-user** — invites, ACL, social without Discord
6. **Ops reliability** — Unraid deploy, volumes, themes reset, readiness, ship gates
7. **Acquire BYO** — indexer registry + hubs; never DRM install queues

## Product name (Phase 1 landed 2026-08-26)

**Public name: Oneirodex** (oh-NY-roh-dex) · slug `oneirodex` · [ADR 0003](../adr/0003-product-name-oneirodex.md).

Write **Oneirodex** in UI, Help, README, and operator docs. Package path stays `gametheca/`. Docker, Compose, Unraid, GitHub, `GT_*`, and `--gt-*` / `.gt-*` stay as they are until an identifier wave. Do not mix OneiroDex / ONEIRODEX into copy.

| Default | Value |
|---|---|
| Spelling | Oneirodex — one word, capital O. Not OneiroDex, not ONEIRODEX in UI |
| Phase 1 | Oneirodex everywhere user-facing |
| Identifiers | `gametheca/` · `chrisjrovira/gametheca` · `GT_*` · `gt-` until phase 2/3 |
| Danger zone | `RESET ONEIRODEX` (legacy `RESET GAMETHECA` still accepted) |
| Env / CSS | Keep `GT_*` and `gt-`. No `OD_*` aliases yet |

## Product locks

| Default | Value |
|---|---|
| Social | Native chat/presence; optional LiveKit; BYO Stoat/Matrix link |
| Discord | **Never** — excised; no webhooks |
| Windows code signing | **Never** — unsigned desktop builds only; no cert purchase |
| Auth / OIDC | **Opt-in** — off by default |
| Dangerous apply | AI auto-apply + hardlink apply stay **off** |
| Scrape | No romhacking.net (or similar) scrape |
| Acquire | Native Torznab/Newznab registry (add one / bulk) + optional admin preset pack + BYO Prowlarr/Jackett/debrid hubs; no DRM store download queues; no magnet scrapers that bypass Torznab |
| DRM stores | Ownership register-only; no download queues |
| Support | In-app Report → GitHub Issues + admin inbox |
| LLM | On-demand agent skills; no paid keys in Flask |
| Auto-merge | Never |

## Engineering locks

| Default | Value |
|---|---|
| Docs | Docs-sync on every code change; live README screenshots on every commit/ship pass that touched UI |
| Commit | Only when the user says commit / ship / push |
| Push | **Always** after ship/commit (`ship-ready` pushes to origin); PR only when asked |
| Tests | Smallest relevant pytest/vitest slice — never claim "all green" after a partial run |
| Admin UI | Hybrid React shell + Jinja forms OK until migrated |
| Branch | Stay on the current feature branch unless asked |
| Secrets | Never commit `.env` / tokens; never stage `docs/_private/` |
| Force-push | Never to `main`; no `--no-verify` unless the user demands it |
| Commit author | Set via `git -c` flags only, never `git config` — `cephyrix_zyth` / `cephyrix_zyth@users.noreply.github.com` |

## External-facing scrub (always)

Before committing or writing docs/UI copy:

1. **Never** commit `docs/_private/` or peer competitive catalogs to public remotes.
2. **Never** introduce Class A / warez-adjacent brand names in code, docs, Help, README, CHANGELOG, or CI artifacts.
3. **Never** add "steal from Product X" / peer teardown matrices in tracked files — use Oneirodex capability language for non-goals.
4. **Allowed (Class D):** real integrations — Playnite import, ES-DE/Pegasus export, Prowlarr/Jackett/qBit, LiveKit, OIDC/Authentik, store ownership register-only.

Policy: [../strategy/external-facing-scrub.md](../strategy/external-facing-scrub.md). Private vault: `docs/_private/` (gitignored).

## Deploy assumptions

| Default | Value |
|---|---|
| Primary ops | Unraid + Docker Compose |
| DB | Postgres (`db` service or local Docker) |
| App port | 5006 |
| Support repo | `chrisjrovira/gametheca` |

## This host (Windows)

| Fact | Value |
|---|---|
| Repo | `Z:\_projects\Gametheca` — a NAS mapping, so filesystem work is slow |
| Test database | `gametheca-review-db` (postgres:17.6, published on 5432) |
| Local dev port | `GT_PORT=6120` — Windows reserves 5041–5140, so 5099 will not bind |

Because the repo sits on a slow network mapping, prefer scoped test runs, run long suites in the background, and read the output file rather than trusting a backgrounded run's exit code.

> Historical note: an earlier `Y:` mapping held the repo and agents were told never to touch `Z:`. That mapping no longer exists — `Z:` **is** the repo drive now. Ignore any leftover guidance that says otherwise.

## Reply style

- Lead with the answer or status, not a restatement of the task.
- Prefer tables and bullets; at most 2 clarifying questions.
- End code tasks with a one-line **Docs touched:** list.
