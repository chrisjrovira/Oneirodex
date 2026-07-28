# Unraid deploy — GameTheca

## Prerequisites

- Unraid 6.12+ with Docker / Compose Manager
- A **games** share (read-only mount into the container — scan root only)
- A writable **library** share for covers, themes, uploads (separate from games)
- Postgres (compose `db` service or external)

## Required environment

| Variable | Required | Notes |
|---|---|---|
| `SECRET_KEY` | **Yes** | Must not be the example placeholder. Generate: `python -c "import secrets; print(secrets.token_urlsafe(64))"` |
| `DATABASE_URL` | Yes (Compose builds it) | Host is always `db` — do not use `@localhost` |
| `DATA_FOLDER_GAMES` | Yes | **Host** games path in `.env` (Compose mounts → `/storage:ro`). Container env hard-sets `/storage`. Alias: `DATA_FOLDER_WAREZ` (deprecated) |
| `LIBRARY_HOST_PATH` | Yes | **Host** appdata library path → `/app/gametheca/static/library` RW |
| `POSTGRES_*` | If using bundled db | Match Compose `db` service |

Template: [`.env.unraid.example`](../../.env.unraid.example) (also `.env.nas.example` / `.env.docker.example`).

## Volume sectioning

Do **not** put covers, themes, or uploads on the games mount.

| Role | Host env | Container mount | Mode | Purpose |
|---|---|---|---|---|
| **Games** | `DATA_FOLDER_GAMES` (alias `DATA_FOLDER_WAREZ`) | `/storage` | **ro** | Library scan root only — never uploads |
| **Library / uploads** | `LIBRARY_HOST_PATH` | `/app/gametheca/static/library` | **rw** | Covers, themes, user uploads (`UPLOAD_FOLDER`) |
| Postgres | Compose volume `db_data` | `/var/lib/postgresql/data/pgdata` | rw | DB |
| Optional WebRetro cores | `WEBRETRO_CORES_HOST_PATH` (uncomment in compose) | `/app/gametheca/static/vendor/webretro/cores` | rw | Must include shipped cores — [webretro-cores.md](webretro-cores.md) |

Unraid path examples (edit to match your shares):

```bash
DATA_FOLDER_GAMES=/mnt/user/games
LIBRARY_HOST_PATH=/mnt/user/appdata/gametheca/library
```

App libraries in Admin should point at paths under `/storage/...` (inside the container).

## Image

`chrisjrovira/gametheca:latest` (or build from this repo). The image includes `bash` for `entrypoint.sh`.

## Compose Manager paths

- External ENV File Path: `/mnt/user/isos/gametheca/.env`
- Indirect Compose File: `/mnt/user/isos/gametheca/docker-compose.yml`
- Indirect Path: leave empty

Copy template:

```bash
cp .env.unraid.example /mnt/user/isos/gametheca/.env
# set SECRET_KEY + host volume paths, then Compose Manager → Update Stack
```

## Optional profiles (full-stack test)

Sidecars are **opt-in** — not started with bare `app` + `db`.

| Profile | Enable | App env |
|---|---|---|
| `livekit` | `docker compose --profile livekit up -d` | `ENABLE_LIVEKIT=true` + `LIVEKIT_URL` / keys — [livekit-unraid.md](livekit-unraid.md) |
| `clamav` | `docker compose --profile clamav up -d` | `ENABLE_MALWARE_SCAN=true`, `CLAMAV_HOST=clamav` |
| `challenge` | `docker compose --profile challenge up -d` | `ENABLE_CHALLENGE_SOLVER=true`, `CHALLENGE_SOLVER_URL=http://trawl:8191` — [challenge-solver-unraid.md](challenge-solver-unraid.md) |

Full stack in one shot:

```bash
docker compose --profile livekit --profile clamav --profile challenge up -d --build
```

**Observability / Grafana:** not bundled. Prefer Admin → Ops + probes. Commented Compose stub only — [observability-profile.md](observability-profile.md).

## First boot checklist

1. Set a real `SECRET_KEY` and volume paths in `.env`
2. Start stack; watch logs until Postgres is ready
3. Confirm healthy: `curl -f http://<unraid-ip>:5006/readyz` (Compose healthcheck uses this; `/healthz` is liveness-only)
4. Open `http://<unraid-ip>:5006`
5. Complete setup wizard (admin → SMTP optional → IGDB)
6. Admin → Themes → **Reset Default Themes** (installs presets; regenerates at `GENERATOR_VERSION` 8)
7. Add a library pointing at `/storage/...`
8. Run a small scan before a full library scan

## Monitor while testing

Use this loop while Unraid-testing so the team can report status **without Discord / webhooks** — Ops glance + scan progress + container logs.

| Check | How | Pass signal |
|---|---|---|
| Readiness | `curl -f http://<unraid-ip>:5006/readyz` | HTTP 200 (DB + init) |
| Liveness | `curl -f http://<unraid-ip>:5006/healthz` | HTTP 200 (process up) |
| Ops glance | Admin → Ops (`/admin/ops`) — polls `/admin/api/ops/summary` ~15s | Host/library OK; **Services** shows LiveKit · malware/ClamAV · companions · queues as expected |
| Scan progress | Admin → Scan jobs **or** Ops `scans.jobs[]` (`progress`, `status`, `errors`) | Active job advances; failures visible |
| Container logs | `docker compose logs -f app` (and `db` / profile sidecars) | No crash loops; theme sync / `[OK]` lines |

**Team feedback:** paste Ops summary highlights (issues, active scans, services reachability) + last ~40 log lines — not chat webhooks.

## Theme / JS not updating?

Library volume persists old theme files. After every code deploy:

1. `docker compose build --no-cache && docker compose up -d`
2. Watch logs for theme sync / `[OK] Default theme` / token presence
3. Admin → Themes → **Reset Default Themes** (or delete `themes/default` under the library volume and restart)

Also confirm `member-app.css` loads in the browser (View Source on Discover/Library). Missing CSS means a rebuild is required — the SPA chrome will look unstyled without it.

## Smoke checklist (Style B+C + Systems + Wave 5/6)

0. `curl -f http://<host>:5006/healthz` and `/readyz` both succeed (Unraid Docker health should track `/readyz`)
0a. After Jul 27 SSE/pg_hba fixes: `docker compose up -d --force-recreate db` then rebuild/restart **app** from a tree that includes `docker/postgres/pg_hba.conf` + ASGI activity SSE — [container-wont-start §3b](container-wont-start.md#3b-postgres-up-but-pg_hba-rejects-app-no-encryption) · [admin Discover hang](../admin/troubleshooting.md#spa-navigates-but-pagesadmin-hang-discover-stuck-on-loading)
0b. Admin → Ops (`/admin/ops`): **Services** tile shows LiveKit · malware/ClamAV · companions · queues (via `/admin/api/ops/summary`)
1. First-boot logs show theme tokens OK (or Reset Default Themes after `GENERATOR_VERSION` 8)
2. Discover/Library: View Source includes **`member-app.css`** and `member-app.js`
3. Admin pages: View Source includes **`admin-app.css`** and `admin-app.js` (React admin SPA)
4. Default accent reads **green `#2fd67b`** (not teal/orange); Ocean/Forest still recolour — hard refresh
5. Top nav only on member pages (Discover, Library, **Systems**, Downloads, Favorites, More)
6. **Systems** (`/systems`): family groups load; click a console → library filtered with platform skin
7. Preferences swatch grid responds; page reloads after save; tile size changes grid density
8. Covers show for games with downloaded images (fallback only when truly missing)
9. Admin: React top bar — no member left sidebar; Dashboard / Libraries / Settings work
10. `/admin/settings` card grid; Themes → Reset Default Themes after rebuild
11. Collections: create, search-add, reorder, edit, delete
12. **Game details SPA** (`/game_details/<uuid>`): TopNav present; summary/versions/screenshots load; Check stores works
13. **Updates** (`/updates`): freshness inbox; store search binds to library games; Want pack; Download / Apply
14. **Acquire** (`/acquire`, optional): ENABLE_ARR_MODULE / ENABLE_DEBRID — indexer search + librarian send
15. **Big Picture** (`/big-picture`): fullscreen shell (no TopNav); Open / Download / Install; Exit → Library
16. **Emulator play**: WebRetro cores for mapped platforms; cloud save button; .cht select when uploaded
17. Companion (optional): Install/Apply; assist packs when ENABLE_GAME_ASSISTS
18. **Social**: `/activity`, `/chat`, `/notifications`, `/report` load; admin `/admin/support` inbox
19. **LiveKit** (optional): `ENABLE_LIVEKIT` + `--profile livekit` — Activity voice lobby mints token ([livekit-unraid.md](livekit-unraid.md))

Operator sign-off: tick the list above after `build --no-cache` + Reset Default Themes, then mark Unraid smoke done in `docs/strategy/progress.md`.

See also [docker-compose-deploy.md](docker-compose-deploy.md) · [observability-profile.md](observability-profile.md) · [themes-reset.md](../admin/themes-reset.md) · [support-inbox.md](../admin/support-inbox.md).
