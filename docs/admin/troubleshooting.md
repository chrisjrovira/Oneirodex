# Troubleshooting (admins)

## Container / boot

See [container-wont-start.md](../runbooks/container-wont-start.md) for SECRET_KEY, bash, DB.

| Symptom | Check |
|---|---|
| App unhealthy | `curl -f http://localhost:5006/readyz` · `docker compose logs app` · DB healthy? Compose probes **`/readyz`** (not `/`) |
| Liveness only | `curl -f http://localhost:5006/healthz` — process up; does not prove DB |
| Sidecars / queues look wrong | **Admin → Ops** (or Dashboard) observability console — status + two-fold `issues.items` (**Action required** = path/DB/readyz; **Warning** = soft problem signals; **Info** = disk capacity even ≥95% — never Warning/Action) · silent ~15s poll + manual Refresh · load/RSS/db_ping/readyz · LiveKit · malware · library watch (`GT_LIBRARY_WATCH`, default off) · companions by kind · queues · game servers; then `/readyz` — field map: [ops-summary.md](ops-summary.md) |
| Need server logs URL | **`/admin/server_logs`** (alias) or Admin → Server status/logs — [ops-summary.md](ops-summary.md) |
| Ops tiles show **n/a** for load / RSS / db_ping | Expected when OS denies load averages (Windows), psutil unavailable, or DB unreachable — not a broken UI |
| Ops flags `DATA_FOLDER_GAMES` / `BASE_FOLDER_POSIX` / `BASE_FOLDER_WINDOWS` `not writable` | Expected on Unraid `:ro` games mount (and its base folder) only on **older** builds — current Ops treats games + base folder as read-OK; rebuild/restart app if still bad. `UPLOAD_FOLDER` / library must stay RW |
| Scan progress looks stalled / want live counters | **Admin → Ops** **Scans** tile (polls `/admin/api/ops/summary` ~15s) shows processed (`success+failed`) / `total`, plus failed count, `current_processing`, status, elapsed/ETA when present (**ETA blank when stalled/unknown**) — [ops-summary.md](ops-summary.md#scans-key) · **Scan management** for status/library/path filters + Stop/detail |
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

## Security headers / uploads

Baseline headers (`nosniff`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`) are always
sent and need no configuration. The CSP is **report-only** on purpose — see
[security.md](../strategy/security.md#what-phases-04-shipped).

| Symptom | Check |
|---|---|
| Console full of “Content Security Policy … would block” | Expected. `CSP_ENFORCE=false` reports without blocking. Clear the reports first, then set `CSP_ENFORCE=true` |
| Set `CSP_ENFORCE=true` and the newsletter editor / browser play broke | Enforcement blocks the CKEditor CDN and the WebRetro WASM cores unless the policy is widened. Set it back to `false` |
| Site pinned to HTTPS and now unreachable by IP | HSTS. It is only sent when `SESSION_COOKIE_SECURE=true`; set `HSTS_SECONDS=0` and clear the browser's HSTS entry |
| Large firmware upload rejected with 413 | Global ceiling is `MAX_UPLOAD_MB` (default 128). Raise it *and* `EMULATOR_BIOS_MAX_BYTES` together — the per-route firmware limit is the tighter of the two |
| Cover uploads suddenly smaller on disk | Expected. Covers over 1200×1600 are now stored resized; previously the resize ran and the original was saved anyway |
| Companion stopped authenticating after an upgrade | Not expiry — tokens created before `expires_at` existed are NULL, which means never. Check Admin → the token was not revoked |
| Metadata art stopped downloading from one provider | The provider may be answering with a redirect to a private/link-local host, which is now refused. Look for `http_retry blocked` / `download_image blocked` in the log |
| Browser play dead after upgrading; companion Play fine | The libretro cores are no longer shipped in the image — they are fetched on first boot. Give it a minute, then check the log for "Fetched N WebRetro core(s)". If the fetch is off or failed: `./scripts/fetch-webretro-cores.sh --defaults` — [webretro-cores.md](../runbooks/webretro-cores.md) |
| Air-gapped box, browser play never works | Expected. Set `FETCH_WEBRETRO_CORES_ON_BOOT=false` and provision with `--from-dir`; boot logs a warning naming the missing cores rather than failing quietly |
| "Get the source code" link missing from Help / admin footer | `GT_SOURCE_URL` is empty. It renders only when set, because a dead source link is worse than none. **Running a modified build? Point it at your fork** — AGPL §13 obliges you to offer your users your source, not upstream's |

## Integrations

| Integration | Notes |
|---|---|
| SMTP / IGDB / OIDC / SteamGridDB | Admin → Integrations hub |
| Community chat | BYO Stoat/Matrix URL only |
| Discord | **Removed** — use Support inbox + in-app admin alerts |
| LiveKit | [livekit-unraid.md](../runbooks/livekit-unraid.md) · Plugins → `rtc.livekit` |
| SMTP help (?) unclickable after open | Same stacking trap as library delete — help modal is hoisted to `document.body` + inline z-index on Integrations. Hard-refresh; optional **Reset Themes**. |

## Support tickets not on GitHub

Expected if `SUPPORT_GITHUB_TOKEN` unset (`github_sync=skipped`). Ticket + admin notification still work — [support-inbox.md](support-inbox.md).

## Voice

| Symptom | Fix |
|---|---|
| Status disabled | `ENABLE_LIVEKIT=true` + URL/key/secret on **app** |
| Browser can’t connect | `LIVEKIT_URL` must be reachable from the **browser** (not only Docker DNS) |
| Child screenshare 403 | By design |

## Libraries / admin UI

> **"Hard-refresh" in the rows below is no longer the fix for stale theme CSS.** Until 2026-08-16 a
> completed **Reset Themes** could stay invisible for up to an hour — static files were served
> `public, max-age=3600` with no validator, and a reset rewrites theme files *in place at the same
> URL*, so the browser had no reason to re-fetch. Theme URLs are versioned by mtime+size now and
> `/static/library/themes/` serves `no-cache`, so a reset takes effect on a normal reload. Treat a
> hard refresh as a diagnostic, not a step: **if it changes anything, that is a bug worth reporting**,
> not the expected workflow. The rebuild/Reset-Themes halves of these rows still apply —
> [themes-reset.md](themes-reset.md).

| Symptom | Check |
|---|---|
| A theme change or Reset Themes "didn't take" | First confirm it is not the old cache bug — it should not be. Then check the two genuine causes: the **image rebuild** did not include a fresh `frontend/member-app` dist (Reset Themes does not refresh the SPA bundle), or **Reset Themes** was skipped so the library volume still holds old copies. [themes-reset.md](themes-reset.md) has the full asset-by-asset table. |
| Delete library Confirm/Cancel unclickable | Theme CSS under `static/library/themes/` can pin `.modal` under `.modal-backdrop`. Current Libraries page ships **inline** stacking CSS + moves the modal to `document.body` (works after **app rebuild/restart** without Reset Themes). Also run **Admin → Themes → Reset Themes** so library theme CSS/JS match the image. Hard-refresh Admin → Libraries. |
| Any Bootstrap admin modal unclickable (Filters, Extensions, Scans Add Filter, Discovery Zones, Users, Downloads, SMTP help) | Same stacking trap: glass/`backdrop-filter` parents. Admin + member shells load `js/gt_modal_stack.js` which hoists every `.modal.fade` to `document.body` (also on `show.bs.modal`). Rebuild/restart app; hard-refresh; optional Reset Themes. |

## Scans / identify

| Symptom | Check |
|---|---|
| Listing finds many games but each identify takes forever | Fixed: scan identify no longer walks the whole game tree for size before commit; size fills in background. Restart app / re-run scan after upgrade. |
| Size shows `0.00 KB` briefly after scan | Expected until deferred size job finishes (large Unraid trees). |
| Progress stuck at 1 while library keeps growing | Fixed: multithreaded counter races + Stop early-exit. Redeploy app; counters use atomic bumps and Stop drains in-flight work. |
| Stop button looks empty / Cancelled shows `-` | Fixed: Stopping shows “Stopping…”; Cancelled shows `Stopped N/total`. Hard-refresh scan management after upgrade. |
| **Every scan says "queued" and never starts** | Fixed (2026-08-24). A scan orphaned by a restart or a crash stayed `Running` in the database, so `is_scan_busy()` reported busy and new scans queued behind a job no thread was working on — for up to **6 hours**, until the stale sweep aged it out. Scan jobs now record the process that owns them, and a job whose owner is gone is reclaimed on sight: at boot, on the scans-page status poll, and before any new scan is accepted. If you are still on an older build, restarting the app clears it. |
| **A scan says only "Failed" with no reason** | Fixed (2026-08-25). The scan jobs table translated two specific failure messages into friendly statuses and showed every other one as a bare "Failed" — including the message the ownership sweep writes when it reclaims an orphaned job. Any failed job now shows its reason under the status. Needs a restart or **Admin → Themes → Reset Themes**, since the table's JS/CSS ship from the theme volume. |
| Scan progress changes the moment the page refreshes | Fixed (2026-08-25). First paint counted only successful folders; the poll counts successes + failures. A job with any failed folder showed one number on load and another two seconds later. Both now count processed the same way. |
| Stuck jobs / unmatched / freshness | [libraries-and-scans.md](libraries-and-scans.md) |
| Scan unmatched table cramped / no Open path after deploy | Theme CSS/JS under `static/library/themes/` can lag the image. Rebuild/restart, then **Admin → Themes → Reset Themes** so `admin_manage_scanjobs` CSS/JS refresh; hard-refresh Scan management. — [themes-reset.md](themes-reset.md) · [libraries-and-scans.md#unmatched-folders](libraries-and-scans.md#unmatched-folders) |
| Libraries & scans missing unified tabs / multi-select / Force delete after W22-1 deploy | Volume copies of `admin_manage_libs` + `admin_manage_scanjobs` lag the image. Rebuild/restart, then **Admin → Themes → Reset Themes**; hard-refresh `/libraries` and `/scan_management`. — [themes-reset.md](themes-reset.md) · [libraries-and-scans.md](libraries-and-scans.md) |
| Admin pages still look 1100px / nested glass after densify deploy | Theme volume copies lag. **Admin → Themes → Reset Themes**, hard-refresh. See [themes-reset.md](themes-reset.md) P1 densified-admin row. |
| Images stuck "Pending" forever, or covers missing after scan/identify despite `IMAGE_SAVE_PATH` being writable | Fixed: the eager cover/screenshot download run during scan/identify was discarding its result (and, for covers, downloading twice) instead of recording success/failure. Every download path now sets `is_downloaded`/`last_error` on the `Image` row — check Admin → Scan management → **Image Queue**, filter **Failed Only**, hover the red badge for the reason, then **Retry failed**. |
| Matched game shows branded **No cover art** placeholder but screenshots/IGDB summary are present | Cover ref shape bug: expanded IGDB `cover` objects (`{id, url}`) were passed into `where id={dict}` and the cover row was never stored, while screenshot id lists still worked. Identify/match now normalizes int-or-dict refs, reuses embedded URLs, and keeps `download_url` for remote display until the local file lands. If `IMAGE_SAVE_PATH` is not writable, `last_error` records that and the remote URL still resolves. Retry from Image Queue or re-run identify image refresh. |
| Art studio generate/apply returns a blank error or "Unexpected error" | Check the JSON `error` message in the red banner — disk permission/space problems on `IMAGE_SAVE_PATH` or the generated-pack folder are now returned as text instead of a bare 500 page. |

Deep ops still use Jinja admin pages behind the React top bar.
