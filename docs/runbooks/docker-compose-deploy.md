# Docker Compose deploy — Oneirodex

Concise local/NAS path using the repo `docker-compose.yml` (`gametheca-app` + `gametheca-db` by default; override with `APP_CONTAINER_NAME` / `DB_CONTAINER_NAME`). Preferred Hub image once published: `chrisjrovira/oneirodex` via `APP_IMAGE`.

## Prerequisites

- Docker Compose v2
- Host path to games (mounted read-only at `/storage`)
- Writable host path for library data (covers, themes)

## Setup

```bash
cp .env.docker.example .env          # local/NAS
# Unraid: this checkout IS the stack — cp .env.unraid.example .env
#   Compose Manager: /mnt/user/infernal-data-streams/_projects/Oneirodex
#   (not /mnt/user/isos/gametheca/ — retired). See unraid-deploy.md
# Set SECRET_KEY (required — container refuses the placeholder)
# Set DATA_FOLDER_GAMES = HOST games path
# Set LIBRARY_HOST_PATH = HOST library/appdata path (default ./data/library)
# Optional BIOS: EMULATOR_BIOS_HOST_PATH + uncomment bios bind in compose
#   (appdata only — never games share; never commit firmware binaries)
# Do NOT set DATABASE_URL=@localhost — Compose builds URL with host "db"
docker compose up -d --build
```

App: http://localhost:5006

## Volume sectioning

Do **not** conflate games (scan root) with library/uploads. Compose header has an **UNRAID VOLUMES** comment block; container env hard-sets `DATA_FOLDER_GAMES=/storage` and `UPLOAD_FOLDER=/app/gametheca/static/library` while `.env` supplies **host** bind paths.

| Role | Host env | Container mount | Mode | Purpose |
|---|---|---|---|---|
| **Games** | `DATA_FOLDER_GAMES` | `/storage` | **ro** | Scan root only — never uploads |
| **Library / uploads** | `LIBRARY_HOST_PATH` | `/app/gametheca/static/library` | **rw** | Covers, themes, uploads |
| **Optional BIOS / firmware** | `EMULATOR_BIOS_HOST_PATH` (uncomment bind in compose) | `/app/gametheca/static/library/bios` | **rw** | Private host firmware under appdata — not games. Public stance remains Admin upload-only — [unraid-deploy.md § Local private BIOS](unraid-deploy.md#local-private-bios-mount-vs-public-upload) |
| Optional WebRetro cores | `WEBRETRO_CORES_HOST_PATH` (uncomment in compose) | `/app/gametheca/static/vendor/webretro/cores` | rw | Operator WASM cores — [webretro-cores.md](webretro-cores.md) |
| Postgres | Compose volume `db_data` | `/var/lib/postgresql/data/pgdata` | rw | DB |
| pg_hba | `./docker/postgres/pg_hba.conf` | `/etc/gametheca/pg_hba.conf` | ro | App↔db TCP without SSL (scram still required) |

If app loops on `no pg_hba.conf entry … no encryption`, recreate `db` with current Compose or use the one-liner in [container-wont-start.md](container-wont-start.md#3b-postgres-up-but-pg_hba-rejects-app-no-encryption).

### Library root watch (optional Wave 3)

`GT_LIBRARY_WATCH` stays **off by default** (`0` / unset). Compose bind-mounts only forward filesystem events the kernel delivers on that mount:

- **Direct host binds** (local disk path → `/storage:ro`) — events may work; still debounce + queue, never assume zero misses.
- **Unraid `/mnt/user` FUSE / network remounts** — host-side renames and many writes **often never reach** inotify inside the container. Prefer scheduled/manual scan; details: [unraid-deploy.md § Library root watch](unraid-deploy.md#library-root-watch-gt_library_watch--unraid-honesty).
- When a watcher (or Admin) enqueues many paths while a scan is busy: use **Queue**, not force-parallel — [libraries-and-scans.md](../admin/libraries-and-scans.md#run-a-scan).

## After first start

1. Complete setup wizard
2. Admin → Themes → **Reset Default Themes** (ensures `#2fd67b` tokens / `GENERATOR_VERSION` 9)
3. Add library under `/storage/...`, run a small scan

## Rebuild after frontend/theme changes

```bash
docker compose build --no-cache && docker compose up -d
```

Then Reset Default Themes if the library volume still has stale CSS.

**Admin SPA build note:** `frontend-build` copies `gametheca/setup/default_theme/js/stageECandidates.js` and `unmatchedTriage.js` into the build tree before `admin-app` `npm run build` so relative SoT re-exports resolve (those files are not under `frontend/admin-app/`).

## Other optional profiles

### LiveKit voice

```bash
# Match keys with Oneirodex app env
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

### Generated cover art (SD.Next)

```bash
export ENABLE_AI_ARTWORK=true
export AI_ARTWORK_URL=http://sdnext:7860
export AI_ARTWORK_ENGINE=a1111
docker compose --profile artwork up -d
```

- **No GPU is requested by default, on purpose.** The sidecar runs on CPU —
  extremely slow, but it runs. An NVIDIA reservation on a host with no loaded
  driver does not degrade, it fails container create with `nvml error: driver
  not loaded` and aborts the whole stack update. See
  [container-wont-start.md](container-wont-start.md) § 7.
- **GPU in this Docker host:** opt in with the overlay, after confirming
  `docker run --rm --gpus all nvidia/cuda:12.4.0-base-ubuntu22.04 nvidia-smi`
  works:

  ```bash
  # in .env (Linux hosts; use ";" as the separator on Windows)
  COMPOSE_FILE=docker-compose.yml:docker-compose.gpu.yml
  ```

- **GPU on another machine** (the usual case for a GPU-less NAS): skip the
  profile entirely. On a Windows box with a card, use
  [`docker-compose.artwork-local.yml`](../../docker-compose.artwork-local.yml)
  — [artwork-gpu-workstation.md](artwork-gpu-workstation.md) — then set
  `ENABLE_AI_ARTWORK` / `AI_ARTWORK_URL` / `AI_ARTWORK_ENGINE` in `.env` and
  recreate **app** (those keys are mapped in `docker-compose.yml`). Turnkey
  pairing for that shape is backlog **GPU-N**,
  [gpu-worker-node.md](../strategy/gpu-worker-node.md).

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
| Ops glance | Admin → Ops (`/admin/ops`) → `/admin/api/ops/summary` ~15s | `host` / `library` OK; games RO not a path issue; **Services** (LiveKit · malware · companions · queues · game_servers) |
| Scan progress | Admin scan jobs **or** Ops `scans.jobs[]` | `folders_success` / `folders_failed` / `total_folders` (+ `current_processing`); aliases `progress` / `errors` OK |
| Container logs | `docker compose logs -f app` (+ `db` / profile sidecars) | No crash loops |

## Smoke

- Health + Ops + scan checks from **Monitor while testing** above
- View Source on Discover/Library: `member-app.css` + `member-app.js` present
- Accent green `#2fd67b`; Systems hub (`/systems`) loads
- Admin uses top bar only (no member LHN)
- Optional: Activity voice lobby when LiveKit enabled

### Observability (optional — not required for 1.0)

Prometheus/Grafana are **not** bundled. Near-realtime ops for operators = Admin → Ops (`/admin/ops`, polls `/admin/api/ops/summary` including **Services**: LiveKit, malware/ClamAV, companions, queues, game_servers) + the probes above. Compose keeps a commented `# profile: observability` stub — see [observability-profile.md](observability-profile.md). Do not block upgrades on scrape.

### Workers

Default `UVICORN_WORKERS=1` (Compose + `startweb-docker.sh`; override in `.env` / Compose env). Schedulers, SSE fan-out, and in-memory rate limits are **per worker** — keep **1** for single-node household ops until a shared cache lands. Set `UVICORN_WORKERS=2` only when you accept split in-process state.

Scan / turbo image thread counts are **not** Compose env vars — set them under Admin → Server Settings. Unraid-safe defaults (scan **1**, turbo off or ≤4 threads during big libraries): [unraid-deploy.md § CPU / scan load](unraid-deploy.md#cpu--scan-load-unraid-safe-defaults). Keep `GT_LIBRARY_WATCH` off unless you accept best-effort events; watcher bursts should **queue**, not force-parallel.

`/api/activity/stream` and `/api/events/stream` are handled **natively in ASGI** (not WsgiToAsgi) so a single open EventSource cannot freeze Discover/Admin on the same worker. Flask WSGI fallbacks return **503** (no sync generator). If pages hang with only static + activity-stream 200s in the logs, rebuild/restart so that ASGI path is live — see [admin troubleshooting](../admin/troubleshooting.md#spa-navigates-but-pagesadmin-hang-discover-stuck-on-loading).

Unraid-specific notes: [unraid-deploy.md](unraid-deploy.md). Break-glass: [container-wont-start.md](container-wont-start.md).
