# GameTheca locked defaults

Use these unless the user **explicitly** overrides in the same message.

## Product

| Default | Value |
|---|---|
| Product | **Mission:** self-hosted household **gaming sphere** — already-owned PC/console libraries → shared honest catalog (library · systems · ownership/metadata · play · social · admin/ops · BYO acquire). DRM-free vault / Unraid+Compose home hub — **not** a DRM store client, Discord clone, or pirate marketplace. Full text: `agent-pm` Product mission |
| Social | Native chat/presence; optional LiveKit; BYO Stoat/Matrix link |
| Discord | **Never** — excised; no webhooks |
| Windows code signing | **Never** — unsigned desktop builds only; no cert purchase |
| Auth / OIDC | **Opt-in** — off by default |
| Dangerous apply | AI auto-apply + hardlink apply stay **off** |
| Scrape | No romhacking.net (or similar) scrape |
| Acquire | Native Torznab/Newznab registry (add one / bulk) + optional admin preset pack + BYO Prowlarr/Jackett/debrid hubs; no DRM store download queues; no magnet scrapers that bypass Torznab |
| DRM stores | Ownership register-only; no download queues |
| Support | In-app Report → GitHub Issues + admin inbox |
| LLM | Cursor skills on demand; no paid keys in Flask |
| Auto-merge | Never |
| Agent team | `@agent-team` / `@agent-pm` / seats — parent chat **is** the PM monitor; **Task-disperse** (not silent broadcast); **relevant agent only** (wrong-seat refuse); no product code when seats exist; Docs owns program canvas **every Docs turn / every wave end / every commit pass**; lanes Integrations/Acquire/Play/Social/Security route via Backend (+ consults) until promoted |

## Engineering

| Default | Value |
|---|---|
| Docs | Always docs-sync; Docs rewrites program canvas to current truth **every Docs turn / every wave end / every commit pass**; live README screenshots on every commit/ship pass |
| Commit | Only when user says commit / ship / push |
| Push | **Always** after ship/commit (ship-ready pushes to origin); PR only when asked |
| Tests | Smallest relevant pytest/vitest slice |
| Admin UI | Hybrid React shell + Jinja forms OK until migrated |
| Branch | Stay on current feature branch unless asked |
| Secrets | Never commit `.env` / tokens |

## Deploy assumptions

| Default | Value |
|---|---|
| Primary ops | Unraid + Docker Compose |
| DB | Postgres (`db` service or local Docker) |
| Port | 5006 |
| Support repo | `chrisjrovira/gametheca` |

## Windows drive letters (this host — locked)

| Letter | Meaning | Agent rule |
|---|---|---|
| **Y:** | GameTheca repo / ISO share (`…\isos\gametheca`) | Prefer `Y:\` or UNC `\\192.168.50.116\isos\gametheca` for repo cwd |
| **Z:** | NAS games/storage mapping | **Never** `net use` / `subst` / remap **Z:** for agent tests |

If UNC breaks npm/vitest: copy to `%TEMP%\gametheca-…` or use **existing Y:** — do **not** steal Z:. Prefer `pushd` UNC when it works.

## Reply style (token)

- Lead with the answer / status, not a task restatement
- Prefer tables and bullets; ≤2 clarifying questions
- End code tasks with **Docs touched:** …
