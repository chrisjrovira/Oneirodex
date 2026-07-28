# Admin Ops summary (`services` contract)

**Audience:** Admins / operators reading Admin → Ops  
**Endpoint:** `GET /admin/api/ops/summary` (admin session)  
**UI:** `/admin/ops` polls ~15s

Top-level keys include `as_of`, `host`, `network`, `issues`, `scans`, `library`, **`services`**, `recent_errors` (plus `*_error` when a section fails).

## `scans` key

Built by `gametheca.utils.ops_summary._scan_snapshot`. Poll-friendly (~15s) glance for Unraid library scans — counters come from atomic `bump_scan_job_progress`.

| Field | Meaning |
|---|---|
| `active_count` | Jobs in `Running` or `Stopping` |
| `jobs[]` | Active jobs first, then up to 5 recent `Completed` / `Cancelled` / `Failed` (24h) |
| `jobs[].id` / `id_short` | Full UUID · first 8 chars |
| `jobs[].status` | Enum casing: `Running` / `Stopping` / `Cancelled` / `Completed` / `Failed` |
| `jobs[].folders_success` / `folders_failed` / `total_folders` | Live folder counters |
| `jobs[].current_processing` | Latest label from the scan coordinator (nullable) |
| `jobs[].last_progress_update` | ISO timestamp of last counter bump (nullable) |
| `jobs[].library` | Library name when joined cheaply |
| `jobs[].progress` / `errors` | Compat aliases (`%` of done folders · `folders_failed`) |

**Ops UI (`/admin/ops` Scans tile):** renders processed (`success+failed`) / `total`, with a `· N failed` suffix when failures > 0 (same honesty as Scan Jobs).

## `services` key

Built by `gametheca.utils.ops_summary._services_snapshot`. Brief field map:

| Field | Meaning |
|---|---|
| `livekit` | Flag + config presence + best-effort TCP reachability (`enabled`, `configured`, `url_set`, `keys_set`, `reachable`, `error`, `note`) |
| `malware` | Module on/off, block-on-hit, ClamAV reachability/version/error, heuristics bag |
| `companions` | Heartbeat pulse — `online` / `registered` within `window_minutes` (default 3) |
| `queues` | `scans_active`, `scans_pending` (Scheduled), `scans_failures_24h`, `downloads_open` |
| `game_servers` | Household registry pulse — `count`, `reachable`, per-server `display_name` / TCP or HTTP probe |
| `malware_module_enabled` | Convenience bool mirroring malware module enable |

No Discord / webhook sinks — alerts stay in-app SystemEvents / optional SMTP digest.

**Path issues:** `DATA_FOLDER_GAMES` / `DATA_FOLDER_WAREZ` need **exist + read** only (Compose Unraid often mounts `/storage:ro`). Uploads / image paths still require write — a RO games mount must not appear as `not writable` in `issues`.

## Related

- [troubleshooting.md](troubleshooting.md) — Services tile symptoms  
- [docker-compose-deploy.md](../runbooks/docker-compose-deploy.md) — smoke + workers  
- [challenge-solver-unraid.md](../runbooks/challenge-solver-unraid.md) — TRAWL sidecar (CH-2)  
- [observability-profile.md](../runbooks/observability-profile.md) — in-app vs Prometheus stub  
- [unraid-deploy.md](../runbooks/unraid-deploy.md) — checklist step 0b  
