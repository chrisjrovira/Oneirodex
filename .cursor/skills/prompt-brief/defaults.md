# GameTheca locked defaults

Use these unless the user **explicitly** overrides in the same message.

## Product

| Default | Value |
|---|---|
| Product | Self-hosted household **gaming sphere** (library · systems · ownership/metadata · play · social · admin/ops · BYO acquire) — DRM-free vault, not a DRM store client |
| Social | Native chat/presence; optional LiveKit; BYO Stoat/Matrix link |
| Discord | **Never** — excised; no webhooks |
| Windows code signing | **Never** — unsigned desktop builds only; no cert purchase |
| Auth / OIDC | **Opt-in** — off by default |
| Dangerous apply | AI auto-apply + hardlink apply stay **off** |
| Scrape | No romhacking.net (or similar) scrape |
| Acquire | BYO *arr/debrid only; no bundled pirate indexers |
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

## Reply style (token)

- Lead with the answer / status, not a task restatement
- Prefer tables and bullets; ≤2 clarifying questions
- End code tasks with **Docs touched:** …
