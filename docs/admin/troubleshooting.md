# Troubleshooting (admins)

## Container / boot

See [container-wont-start.md](../runbooks/container-wont-start.md) for SECRET_KEY, bash, DB.

| Symptom | Check |
|---|---|
| App unhealthy | `curl -f http://localhost:5006/readyz` · `docker compose logs app` · DB healthy? Compose probes **`/readyz`** (not `/`) |
| Liveness only | `curl -f http://localhost:5006/healthz` — process up; does not prove DB |
| Sidecars / queues look wrong | **Admin → Ops** (or Dashboard) observability console — status + `issues.items` · load/RSS/db_ping/readyz · LiveKit · malware · companions by kind · queues · game servers; then `/readyz` — field map: [ops-summary.md](ops-summary.md) |
| Ops tiles show **n/a** for load / RSS / db_ping | Expected when OS denies load averages (Windows), psutil unavailable, or DB unreachable — not a broken UI |
| Ops flags `DATA_FOLDER_GAMES` / `BASE_FOLDER_POSIX` / `BASE_FOLDER_WINDOWS` `not writable` | Expected on Unraid `:ro` games mount (and its base folder) only on **older** builds — current Ops treats games + base folder as read-OK; rebuild/restart app if still bad. `UPLOAD_FOLDER` / library must stay RW |
| Scan progress looks stalled / want live counters | **Admin → Ops** **Scans** tile (polls `/admin/api/ops/summary` ~15s) shows processed (`success+failed`) / `total`, plus failed count, `current_processing`, status — [ops-summary.md](ops-summary.md#scans-key) · Scan Jobs page for Stop/detail |
| Schema errors | Startup `updateschema` · [local-postgres-pytest.md](../runbooks/local-postgres-pytest.md) for local tests |
| App loops waiting for DB: `no pg_hba … no encryption` | Postgres rejects non-SSL from Docker bridge — [container-wont-start §3b](../runbooks/container-wont-start.md#3b-postgres-up-but-pg_hba-rejects-app-no-encryption); recreate `db` with current Compose `pg_hba` mount |

## Frontend dist missing

Rebuild so `gametheca/static/dist/member-app` and `admin-app` exist:

```bash
docker compose build --no-cache && docker compose up -d
```

## SPA navigates but pages/admin hang (Discover stuck on Loading)

Default Docker uses **`UVICORN_WORKERS=1`**. A long-lived sync SSE on `/api/activity/stream` used to run through WsgiToAsgi and **starve** Discover, Library APIs, and Jinja admin on that same worker. Symptoms: shell/nav works, CSS/JS 200, `/api/activity/stream` 200, then **no** `/api/discover/sections` (or admin never finishes).

**Fix (current code):** ASGI serves `/api/activity/stream` and `/api/events/stream` natively (non-blocking); Flask WSGI handlers return **503** if reached. The Friends companion only opens activity SSE when the dock is open. Rebuild/restart the app container after pull:

```bash
docker compose build app && docker compose up -d app
```

Confirm in logs that after `/discover` you also see `GET /api/discover/sections` (or Admin HTML) completing. Keep `UVICORN_WORKERS=1` unless you accept split in-process SSE/schedulers — see [docker-compose-deploy.md](../runbooks/docker-compose-deploy.md).

## Features / modules

Product toggles live under **Admin → Features** (and setup → Features). Env flags in `.env` / Compose still win for safety locks. See [settings-modules.md](settings-modules.md).

| Symptom | Check |
|---|---|
| Malware scan never runs | `ENABLE_MALWARE_SCAN` off — check Admin → Features |
| Library scan skips suspicious names | Expected when `MALWARE_SCAN_BLOCK_ON_HIT=true` (heuristic or ClamAV match) |
| ClamAV unreachable | Start `docker compose --profile clamav up -d` or set `CLAMAV_SOCKET` for host clamd — heuristics still apply when scan module is on |
| LiveKit “on” but no voice | Flag alone is not enough — need `LIVEKIT_*` + compose `--profile livekit` |
| OIDC button missing | `OIDC_ENABLED` stays **off** until env + Integrations toggle |

## Integrations

| Integration | Notes |
|---|---|
| SMTP / IGDB / OIDC / SteamGridDB | Admin → Integrations hub |
| Community chat | BYO Stoat/Matrix URL only |
| Discord | **Removed** — use Support inbox + in-app admin alerts |
| LiveKit | [livekit-unraid.md](../runbooks/livekit-unraid.md) · Plugins → `rtc.livekit` |

## Support tickets not on GitHub

Expected if `SUPPORT_GITHUB_TOKEN` unset (`github_sync=skipped`). Ticket + admin notification still work — [support-inbox.md](support-inbox.md).

## Voice

| Symptom | Fix |
|---|---|
| Status disabled | `ENABLE_LIVEKIT=true` + URL/key/secret on **app** |
| Browser can’t connect | `LIVEKIT_URL` must be reachable from the **browser** (not only Docker DNS) |
| Child screenshare 403 | By design |

## Libraries / admin UI

| Symptom | Check |
|---|---|
| Delete library Confirm/Cancel unclickable | Theme CSS under `static/library/themes/` can pin `.modal` under `.modal-backdrop`. Current Libraries page ships **inline** stacking CSS + moves the modal to `document.body` (works after **app rebuild/restart** without Reset Themes). Also run **Admin → Themes → Reset Themes** so library theme CSS/JS match the image. Hard-refresh Admin → Libraries. |

## Scans / identify

| Symptom | Check |
|---|---|
| Listing finds many games but each identify takes forever | Fixed: scan identify no longer walks the whole game tree for size before commit; size fills in background. Restart app / re-run scan after upgrade. |
| Size shows `0.00 KB` briefly after scan | Expected until deferred size job finishes (large Unraid trees). |
| Progress stuck at 1 while library keeps growing | Fixed: multithreaded counter races + Stop early-exit. Redeploy app; counters use atomic bumps and Stop drains in-flight work. |
| Stop button looks empty / Cancelled shows `-` | Fixed: Stopping shows “Stopping…”; Cancelled shows `Stopped N/total`. Hard-refresh scan management after upgrade. |
| Stuck jobs / unmatched / freshness | [libraries-and-scans.md](libraries-and-scans.md) |
| Images stuck "Pending" forever, or covers missing after scan/identify despite `IMAGE_SAVE_PATH` being writable | Fixed: the eager cover/screenshot download run during scan/identify was discarding its result (and, for covers, downloading twice) instead of recording success/failure. Every download path now sets `is_downloaded`/`last_error` on the `Image` row — check Admin → Scan management → **Image Queue**, filter **Failed Only**, hover the red badge for the reason, then **Retry failed**. |
| Art studio generate/apply returns a blank error or "Unexpected error" | Check the JSON `error` message in the red banner — disk permission/space problems on `IMAGE_SAVE_PATH` or the generated-pack folder are now returned as text instead of a bare 500 page. |

Deep ops still use Jinja admin pages behind the React top bar.
