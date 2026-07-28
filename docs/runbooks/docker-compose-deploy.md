# Docker Compose deploy — GameTheca

Concise local/NAS path using the repo `docker-compose.yml` (`gametheca-app` + `gametheca-db`).

## Prerequisites

- Docker Compose v2
- Host path to games (mounted read-only at `/storage`)
- Writable host path for library data (covers, themes)

## Setup

```bash
cp .env.docker.example .env          # local/NAS
# Unraid: prefer cp .env.unraid.example .env  (Compose Manager paths in that file)
# Set SECRET_KEY (required — container refuses the placeholder)
# Set DATA_FOLDER_GAMES = HOST games path (DATA_FOLDER_WAREZ deprecated alias)
# Set LIBRARY_HOST_PATH = HOST library/appdata path (default ./data/library)
# Do NOT set DATABASE_URL=@localhost — Compose builds URL with host "db"
docker compose up -d --build
```

App: http://localhost:5006

## Volume sectioning

Do **not** conflate games (scan root) with library/uploads. Compose header has an **UNRAID VOLUMES** comment block; container env hard-sets `DATA_FOLDER_GAMES=/storage` and `UPLOAD_FOLDER=/app/gametheca/static/library` while `.env` supplies **host** bind paths.

| Role | Host env | Container mount | Mode | Purpose |
|---|---|---|---|---|
| **Games** | `DATA_FOLDER_GAMES` (alias `DATA_FOLDER_WAREZ`) | `/storage` | **ro** | Scan root only — never uploads |
| **Library / uploads** | `LIBRARY_HOST_PATH` | `/app/gametheca/static/library` | **rw** | Covers, themes, uploads |
| Optional WebRetro cores | `WEBRETRO_CORES_HOST_PATH` (uncomment in compose) | `/app/gametheca/static/vendor/webretro/cores` | rw | Operator WASM cores — [webretro-cores.md](webretro-cores.md) |
| Postgres | Compose volume `db_data` | `/var/lib/postgresql/data/pgdata` | rw | DB |
| pg_hba | `./docker/postgres/pg_hba.conf` | `/etc/gametheca/pg_hba.conf` | ro | App↔db TCP without SSL (scram still required) |

If app loops on `no pg_hba.conf entry … no encryption`, recreate `db` with current Compose or use the one-liner in [container-wont-start.md](container-wont-start.md#3b-postgres-up-but-pg_hba-rejects-app-no-encryption).

## After first start

1. Complete setup wizard
2. Admin → Themes → **Reset Default Themes** (ensures `#2fd67b` tokens / `GENERATOR_VERSION` 8)
3. Add library under `/storage/...`, run a small scan

## Rebuild after frontend/theme changes

```bash
docker compose build --no-cache && docker compose up -d
```

Then Reset Default Themes if the library volume still has stale CSS.

## Other optional profiles

### LiveKit voice

```bash
# Match keys with GameTheca app env
export ENABLE_LIVEKIT=true
export LIVEKIT_URL=ws://127.0.0.1:7880   # LAN hostname for real browsers
export LIVEKIT_API_KEY=devkey
export LIVEKIT_API_SECRET=secret
docker compose --profile livekit up -d
```

Full notes: [livekit-unraid.md](livekit-unraid.md).

### ClamAV malware scan

```bash
export ENABLE_MALWARE_SCAN=true
export MALWARE_SCAN_BLOCK_ON_HIT=true   # skip library adds on heuristic/ClamAV match
export CLAMAV_HOST=clamav
export CLAMAV_PORT=3310
docker compose --profile clamav up -d
```

- Compose profile starts `clamav/clamav` with a persistent `clamav_db` volume (first start may take several minutes while definitions download).
- **Unraid / host clamd:** bind-mount the host socket into the app container and set `CLAMAV_SOCKET=/run/clamav/clamd.sock` instead of TCP.
- Status: `GET /api/admin/malware-scan/status` (admin) or Admin → Features → Malware scanner section.

### Challenge / captcha solver (TRAWL)

```bash
export ENABLE_CHALLENGE_SOLVER=true
export CHALLENGE_SOLVER_URL=http://trawl:8191
export CHALLENGE_SOLVER_MAX_TIER=5
export ALLOW_PRIVATE_LAN_URLS=true   # Unraid / RFC1918 solver URL
docker compose --profile challenge up -d
docker compose up -d app   # reload app env
```

- Profile **`challenge`** starts Redis + `ghcr.io/germondai/trawl` — **no host ports** (Docker network only).
- Default remains off: `ENABLE_CHALLENGE_SOLVER=false` in `.env.example`.
- Old NAS CPUs: `TRAWL_IMAGE=ghcr.io/germondai/trawl:baseline` in `.env`.
- Full Unraid steps + MITM CA warning: [challenge-solver-unraid.md](challenge-solver-unraid.md).

## Monitor while testing

Feedback loop for local/Unraid tests — use Ops glance + scan progress + logs (**no Discord / webhooks**).

| Check | How | Pass signal |
|---|---|---|
| Readiness | `curl -f http://localhost:5006/readyz` | HTTP 200 (DB + init); Compose `healthcheck` uses this |
| Liveness | `curl -f http://localhost:5006/healthz` | HTTP 200 |
| Ops glance | Admin → Ops (`/admin/ops`) → `/admin/api/ops/summary` ~15s | Host/library OK; **Services** (LiveKit · malware/ClamAV · companions · queues) |
| Scan progress | Admin scan jobs **or** Ops `scans.jobs[]` | `progress` / `status` / `errors` advance |
| Container logs | `docker compose logs -f app` (+ `db` / profile sidecars) | No crash loops |

## Smoke

- Health + Ops + scan checks from **Monitor while testing** above
- View Source on Discover/Library: `member-app.css` + `member-app.js` present
- Accent green `#2fd67b`; Systems hub (`/systems`) loads
- Admin uses top bar only (no member LHN)
- Optional: Activity voice lobby when LiveKit enabled

### Observability (optional — not required for 1.0)

Prometheus/Grafana are **not** bundled. Near-realtime ops for operators = Admin → Ops (`/admin/ops`, polls `/admin/api/ops/summary` including **Services**: LiveKit, malware/ClamAV, companions, queues) + the probes above. Compose keeps a commented `# profile: observability` stub — see [observability-profile.md](observability-profile.md). Do not block upgrades on scrape.

### Workers

Default `UVICORN_WORKERS=1` (Compose + `startweb-docker.sh`; override in `.env` / Compose env). Schedulers, SSE fan-out, and in-memory rate limits are **per worker** — keep **1** for single-node household ops until a shared cache lands. Set `UVICORN_WORKERS=2` only when you accept split in-process state.

`/api/activity/stream` and `/api/events/stream` are handled **natively in ASGI** (not WsgiToAsgi) so a single open EventSource cannot freeze Discover/Admin on the same worker. Flask WSGI fallbacks return **503** (no sync generator). If pages hang with only static + activity-stream 200s in the logs, rebuild/restart so that ASGI path is live — see [admin troubleshooting](../admin/troubleshooting.md#spa-navigates-but-pagesadmin-hang-discover-stuck-on-loading).

Unraid-specific notes: [unraid-deploy.md](unraid-deploy.md). Break-glass: [container-wont-start.md](container-wont-start.md).
