# Docker Compose deploy — GameTheca

Concise local/NAS path using the repo `docker-compose.yml` (`gametheca-app` + `gametheca-db`).

## Prerequisites

- Docker Compose v2
- Host path to games (mounted read-only at `/storage`)
- Writable host path for library data (covers, themes)

## Setup

```bash
cp .env.docker.example .env
# Set SECRET_KEY (required — container refuses the placeholder)
# Set DATA_FOLDER_GAMES = HOST games path (DATA_FOLDER_WAREZ deprecated alias)
# Set LIBRARY_HOST_PATH = HOST library/appdata path (default ./data/library)
# Do NOT set DATABASE_URL=@localhost — Compose builds URL with host "db"
docker compose up -d --build
```

App: http://localhost:5006

## Volumes

| Env / mount | Container |
|---|---|
| `DATA_FOLDER_GAMES` → `/storage` | Games (**ro**) |
| `LIBRARY_HOST_PATH` → `/app/gametheca/static/library` | Covers / themes (rw) |
| `WEBRETRO_CORES_HOST_PATH` (optional, uncomment in compose) → `/app/gametheca/static/vendor/webretro/cores` | Operator WASM cores — see [webretro-cores.md](webretro-cores.md) |
| `db_data` volume | Postgres |

## After first start

1. Complete setup wizard
2. Admin → Themes → **Reset Default Themes** (ensures `#2fd67b` tokens / `GENERATOR_VERSION` 6)
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

## Smoke

- Health: `curl -f http://localhost:5006/healthz` (liveness) and `/readyz` (DB + init) — Compose `healthcheck` uses **`/readyz`**, not `/`
- Admin → Ops: host + library + scans + **Services** tile (LiveKit · malware/ClamAV · companions · queues) via `/admin/api/ops/summary`
- View Source on Discover/Library: `member-app.css` + `member-app.js` present
- Accent green `#2fd67b`; Systems hub (`/systems`) loads
- Admin uses top bar only (no member LHN)
- Optional: Activity voice lobby when LiveKit enabled

### Observability (optional — not required for 1.0)

Prometheus/Grafana are **not** bundled. Near-realtime ops for operators = Admin → Ops (`/admin/ops`, polls `/admin/api/ops/summary` including **Services**: LiveKit, malware/ClamAV, companions, queues) + the probes above. Compose keeps a commented `# profile: observability` stub — see [observability-profile.md](observability-profile.md). Do not block upgrades on scrape.

### Workers

Default `UVICORN_WORKERS=1` (Compose + `startweb-docker.sh`; override in `.env` / Compose env). Schedulers, SSE fan-out, and in-memory rate limits are **per worker** — keep **1** for single-node household ops until a shared cache lands. Set `UVICORN_WORKERS=2` only when you accept split in-process state.

Unraid-specific notes: [unraid-deploy.md](unraid-deploy.md). Break-glass: [container-wont-start.md](container-wont-start.md).
