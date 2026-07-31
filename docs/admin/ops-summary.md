# Admin Ops summary (`services` contract)

**Audience:** Admins / operators reading Admin → Ops  
**Endpoint:** `GET /admin/api/ops/summary` (admin session)  
**UI:** `/admin/ops` and Dashboard poll ~15s (**silent** auto-refresh — no toast spam). Manual **Refresh** shows brief feedback. Services table scrolls when the list is long. **Grafana-style observability console** (Member UI + Ops wave Pass A–F): status strip + `issues.items` in **two folds** — **Action required** and **Warning / Info** (empty folds hidden). Banner label/tone follows items: any action-fold item → Action required; else soft items only → Warning / Info; else healthy. Dense metric tiles (load / RSS / db_ping / readyz / companions / **library watch** / **library health**), host meters, services/scans/errors tables. Library watch shows **off** + env note when `GT_LIBRARY_WATCH` is unset (default). Library health shows compact score · grade + top factors (honest **n/a** / “not scored yet” when `library.health` absent or thin); the tile border/value tones by `grade` (`good`/`fair`/`poor`, muted **na** when thin/null); when `grade` is **poor**, the factors list gets a light danger-edged cue; when **fair**, a warn-gold left edge (good/na unmarked). Null metrics render as **n/a** (e.g. `load_avg` on Windows). Backend enrichments: `host.load_avg` · `host.process` · `host.db_ping_ms` · `services.readyz` · `services.library_watch` · `library.health` · companions `by_kind` + `last_seen`.

**Server logs:** classic Admin → Server logs is also reachable at **`/admin/server_logs`** (alias of the status/logs surface).

Top-level keys include `as_of`, `host`, `network`, `issues`, `scans`, `library`, **`services`**, `recent_errors` (plus `*_error` when a section fails).

## `library.health` (lightweight Ops pulse)

Cheap SQL counts on every Ops poll — **not** a filesystem re-scan. Also available at `GET /admin/api/library/health` (same payload). Shape: `{ score: 0–100|null, grade: good|fair|poor|null, factors[{id, label, count, weight, ratio, deduction}], games, thin, note?, checked_at }`. Factors: `missing_cover` · `missing_path` (empty `full_disk_path` **or** scan-flagged `Game.path_status` = `missing`/`empty` — no live `path.exists` on poll) · `no_igdb` (null or custom-range ≥ 2000000420) · `stale_freshness` (OUT/~ = `behind` / `heuristic_behind`) · `unmatched`. Scan/identify refreshes `path_status` (`ok`|`missing`|`empty`); library watch / scan-existing-path also clears `missing`→`ok` when a folder is restored (without waiting on a separate full rescan). When `games == 0`, `score`/`grade` are **withheld** (`thin: true`) so an empty library is not shown as healthy. Legacy per-game detail remains at `GET /api/health/library` (sampled; may `path.exists`).

`issues` shape: `{ overall, items[{id, severity, category?, message, href?}] }`.

| Field | Meaning |
|---|---|
| `overall` | Backend worst-of hint in `{good, warn, bad}` (`info` items do not elevate). UI may re-tone the banner from item folds when present. |
| `items[].severity` | `bad` \| `warn` \| `info` |
| `items[].category` | UI bucket — `action` \| `warning` \| `info`. UI prefers `category`; when absent, maps `bad`→Action required, `warn`/`info`→Warning / Info. Disk capacity (`disk_*_high` / `disk_*_critical`) is **`info`** only — not Warning or Action required. |

**Two-fold policy** (UI + Backend)

| Bucket | When |
|---|---|
| **Action required** (`bad` / `action`) | Stability or service breakers — critical path missing/unreadable, DB unreachable, readyz fail |
| **Warning** (`warn` / `warning`) | Soft signals that may indicate a real problem — scan job failures, recent SystemEvents errors |
| **Info** (`info`) | Capacity soft signals (disk % even ≥95% / near-full) and companions stale |

Disk pressure alone never forces `overall: bad`/`warn` or `category: action`/`warning`.

## `host` key (Grafana-style enrichments)

| Field | Meaning |
|---|---|
| `cpu` / `memory` / `disk_*` / uptimes | Existing host pulse |
| `load_avg` | `{1, 5, 15}` load averages when OS exposes them; **`null` on Windows / denied hosts** |
| `process` | App process `{pid, rss_bytes}` via psutil; **`null` when unavailable** |
| `db_ping_ms` | Cheap `SELECT 1` latency (ms); **`null` when DB unreachable** |

## `scans` key

Built by `gametheca.utils.ops_summary._scan_snapshot`. Poll-friendly (~15s) glance for Unraid library scans — counters come from atomic `bump_scan_job_progress`.

| Field | Meaning |
|---|---|
| `active_count` | Jobs in `Running` or `Stopping` |
| `queued_count` | Jobs in `Queued` (FIFO waiting for Running to finish) |
| `jobs[]` | Active jobs first, then Queued (with `queue_position`), then up to 5 recent `Completed` / `Cancelled` / `Failed` (24h) |
| `jobs[].id` / `id_short` | Full UUID · first 8 chars |
| `jobs[].status` | Enum casing: `Running` / `Stopping` / `Queued` / `Cancelled` / `Completed` / `Failed` |
| `jobs[].queue_position` | 1-based FIFO position when `status=Queued` |
| `jobs[].folders_success` / `folders_failed` / `total_folders` | Live folder counters |
| `jobs[].current_processing` | Latest label from the scan coordinator (nullable) |
| `jobs[].last_progress_update` | ISO timestamp of last counter bump (nullable) |
| `jobs[].library` | Library name when joined cheaply |
| `jobs[].progress` / `errors` | Compat aliases (`%` of done folders · `folders_failed`) |

**Ops UI (`/admin/ops` Scans table):** renders processed (`success+failed`) / `total`, with a `· N failed` suffix when failures > 0 (same honesty as Scan Jobs).

## `services` key

Built by `gametheca.utils.ops_summary._services_snapshot`. Brief field map:

| Field | Meaning |
|---|---|
| `livekit` | Flag + config presence + best-effort TCP reachability (`enabled`, `configured`, `url_set`, `keys_set`, `reachable`, `error`, `note`) |
| `malware` | Module on/off, block-on-hit, ClamAV reachability/version/error, heuristics bag |
| `companions` | Heartbeat pulse — `online` / `registered` within `window_minutes` (default 3) |
| `companions.by_kind` | Per-`device_kind` `{registered, online}` map |
| `companions.last_seen` | Breakdown — `newest` (ISO), `within_1h`, `within_24h`, `stale` (`registered − online`) |
| `queues` | `scans_active`, `scans_queued` (FIFO Queued), `scans_scheduled` (recurring), `scans_pending` (= queued + scheduled), `scans_failures_24h`, `downloads_open` — honest depths from ScanJob / DownloadRequest |
| `game_servers` | Household registry pulse — `count`, `reachable`, per-server `display_name` / TCP or HTTP probe |
| `readyz` | In-process readiness snippet — `status`, `http_status`, `checks` (same shape as `/readyz`), `check_ms`; **`null` when probe fails** |
| `malware_module_enabled` | Convenience bool mirroring malware module enable |
| `library_watch` | Optional root-folder incremental watch (`GT_LIBRARY_WATCH`, default off) — `enabled`, `running`, `roots`, `pending_libraries`, `debounce_seconds`, `last_event_at`, `last_enqueue_at`, `note` |

No Discord / webhook sinks — alerts stay in-app SystemEvents / optional SMTP digest.

**Path issues:** `DATA_FOLDER_GAMES` / `DATA_FOLDER_WAREZ` / `BASE_FOLDER_POSIX` / `BASE_FOLDER_WINDOWS` need **exist + read** only (Compose Unraid often mounts `/storage:ro`, and the base folder that contains it inherits the same RO mount). Uploads / image paths still require write — a RO games/base mount must not appear as `not writable` in `issues`.

## Related

- [troubleshooting.md](troubleshooting.md) — Services tile symptoms  
- [docker-compose-deploy.md](../runbooks/docker-compose-deploy.md) — smoke + workers  
- [challenge-solver-unraid.md](../runbooks/challenge-solver-unraid.md) — TRAWL sidecar (CH-2)  
- [observability-profile.md](../runbooks/observability-profile.md) — in-app vs Prometheus stub  
- [unraid-deploy.md](../runbooks/unraid-deploy.md) — checklist step 0b  
