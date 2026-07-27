# Ops Glance (`/admin/ops`) — Design

**Date:** 2026-07-22  
**Status:** Approved for planning (Track 2)  
**Product sequence (locked):** 1 pagination ✓ → **2 ops glance** → 3 rename → 4 find/add → 5 settings

## Problem

Admin ops data is fragmented: Dashboard is a link grid, Statistics is download charts, Server Info is a feature-gated one-shot host snapshot, and scans / logs / downloads live on separate pages. There is no single “at a glance” surface for host health, network, issues, and actionable alerts.

## Goals

- One admin page that answers “is the server OK?” without hunting.
- Live-updating tiles via auto-poll.
- Surface host, network, derived issues, scan status, library pulse, and recent errors.
- Deep links into existing detailed admin pages.
- Hybrid stack: Jinja chrome + React island (same delivery pattern as Library grid).

## Non-goals (v1)

- Replacing Statistics charts or System Logs table.
- Prometheus / Grafana / long-term metric history.
- Changing Server Info feature flag behavior (those pages remain).
- User-facing (non-admin) health page.
- Real-time WebSockets (HTTP poll is enough).

## Decisions locked

| Topic | Choice |
|-------|--------|
| Home | New `/admin/ops` |
| Refresh | Auto-poll ~15s |
| Content | Everything useful (host, network, issues, scans, library pulse, recent errors, deep links) |
| Stack | Hybrid: Jinja shell + React tile board |
| API | Single aggregate `GET /admin/api/ops/summary` |
| Access | Admin-only; **not** gated by `enableServerStatusFeature` |

## Architecture

```
Admin Dashboard ──link──► GET /admin/ops (Jinja)
                              │
                              ├── #ops-glance-root
                              │       └── React OpsApp (poll 15s)
                              │               └── GET /admin/api/ops/summary
                              │
                              └── Deep links → Statistics / Logs / Scan / Downloads / Server Info
```

### Backend

- New route module or extend `routes_info.py` / admin blueprint with:
  - `GET /admin/ops` → `admin/admin_ops.html`
  - `GET /admin/api/ops/summary` → JSON snapshot
- New aggregator helper (e.g. `gametheca/utils/ops_summary.py`) composing:
  - Existing: `system_stats`, `status`, `uptime`, scan job queries, library/game counts, unmatched folders, download request counts, `SystemEvents`
  - New: network counters via `psutil.net_io_counters()` + connection count (best-effort; `null` on failure)
- CPU: **one** `psutil.cpu_percent` call per summary request (do not stack multiple `interval=1` waits).
- Issues derived server-side (see Rules below); overall severity = worst item.

### Frontend

- New Vite app `frontend/ops-glance/` → `gametheca/static/dist/ops-glance/ops-glance.js`
- Docker multi-stage Node build extended to build **both** `library-grid` and `ops-glance`
- Poll with `AbortController`; ignore aborted/stale responses; expose manual Refresh

## API contract

`GET /admin/api/ops/summary` (admin login required)

```json
{
  "as_of": "2026-07-22T23:00:00+00:00",
  "host": {
    "os": "string",
    "hostname": "string",
    "ip": "string",
    "python": "string",
    "cpu": { "percent": 0, "cores_physical": 0, "cores_logical": 0 },
    "memory": { "total": 0, "used": 0, "available": 0, "percent": 0 },
    "disk_base": { "total": 0, "used": 0, "free": 0, "percent": 0 },
    "disk_games": { "total": 0, "used": 0, "free": 0, "percent": 0 },
    "uptime_system": "string",
    "uptime_app": "string"
  },
  "network": {
    "bytes_sent": 0,
    "bytes_recv": 0,
    "packets_sent": 0,
    "packets_recv": 0,
    "errin": 0,
    "errout": 0,
    "dropin": 0,
    "dropout": 0,
    "connections": 0
  },
  "issues": {
    "overall": "good|warn|bad",
    "items": [
      { "id": "disk_games_high", "severity": "warn", "message": "Games disk 87% used", "href": "/admin/ops" }
    ]
  },
  "scans": {
    "active_count": 0,
    "jobs": [
      { "id": "…", "library": "PC", "status": "running", "progress": 42, "errors": 0 }
    ]
  },
  "library": {
    "libraries": 0,
    "games": 0,
    "unmatched_folders": 0,
    "download_requests_open": 0
  },
  "recent_errors": [
    { "id": 1, "timestamp": "…", "event_type": "error", "text": "…" }
  ]
}
```

Partial failures: nested sections may be `null` with optional `*_error` string; HTTP 200 preferred when some sections succeed. Hard failure: `503` `{ "error": "…" }`.

### Issue rules (v1)

| Condition | Severity |
|-----------|----------|
| Disk base or games ≥ 95% | bad |
| Disk base or games ≥ 85% | warn |
| Config path missing or not writable | bad |
| Active scan with errors / failed job | warn or bad |
| ≥1 error-type `SystemEvents` in last 24h | warn |
| None of the above | good (empty items OK) |

## UI

- Template: `gametheca/templates/admin/admin_ops.html`
- Mount: `#ops-glance-root` with `data-poll-ms="15000"`
- Sections: StatusBanner · HostPanel · NetworkPanel · IssuesList · ScansPanel · LibraryPulse · RecentErrors · DeepLinks
- Desktop: banner; 2×2 Host|Network / Issues|Scans; Library + Errors; footer links
- Mobile: single column
- Style: reuse admin glass/panel tokens; severity colors only for status
- First load: loading message; later polls update in place
- Poll error: keep last good snapshot + Retry

### Dashboard entry

Add **Ops** button under Server Management on `admin_dashboard.html` pointing to `/admin/ops`.

## Testing

- Unit: issue severity rules; network helper null-on-failure; summary serializer with mocks
- Vitest: OpsApp poll abort/stale; severity banner; empty states
- Route smoke: `/admin/ops` 200 for admin; summary JSON shape for admin; 401/403 for non-admin
- Postgres-backed tests may be blocked in this environment — record and prefer pure-unit where possible

## Delivery notes

- Build assets in Docker alongside library-grid
- Theme asset copies: prefer `/static/dist/ops-glance/` (not theme-copied) like library-grid
- No secrets in summary JSON (no DB passwords, webhook URLs, tokens)

## Open follow-ups (out of v1)

- Rate deltas (MB/s) from successive polls
- Per-library disk mounts
- Wire Statistics page with a “see Ops” banner
