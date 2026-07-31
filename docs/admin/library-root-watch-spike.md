# Library root-folder incremental watch (Wave 3)

**Status:** Implemented (optional; **default off**).  
**Owner:** Backend (+ Ops for Unraid mount-event honesty)

## Today

When `GT_LIBRARY_WATCH=1`, GameTheca starts a watchdog Observer over each library’s `last_scan_folder`. Events are scan-depth–aware (game-leaf + one immediate child only — not deep arcade ROM trees), debounced (2–5s, default 3), and **only enqueue** FIFO `ScanJob`s via `scan_queue` (cooperative with `worker_caps`; watcher never runs scan threads itself).

Unset / `0` → no watcher (scan-driven discovery only: manual / scheduled / refresh-all).

## Env

| Var | Default | Meaning |
|---|---|---|
| `GT_LIBRARY_WATCH` | off | `1` / `true` / `yes` / `on` enables the watcher |
| `GT_LIBRARY_WATCH_DEBOUNCE_SEC` | `3` | Debounce window; clamped to **2–5** |

Also documented in `.env.example` and [unraid-deploy.md](../runbooks/unraid-deploy.md#library-root-watch-gt_library_watch--unraid-honesty).

## Behavior

1. Roots = libraries with a readable `last_scan_folder`.
2. Depth filter uses the same letter-bucket rules as scan (`scan_depth=2` → `_a…_z` / `_#`).
3. Events:
   - **add** (new game-leaf folder) → enqueue folders scan for that library root; if a library game was scan-flagged `path_status=missing` and the folder exists again, clear **missing→ok** immediately (no wait on scan-end refresh)
   - **change** (leaf or immediate child) → enqueue with `force_updates_extras_scan` so updates/extras refresh; same missing→ok clear when the leaf path matches
   - **delete** (game-leaf removed) → enqueue with `remove_missing` **only when** the library’s most recent ScanJob had `setting_remove=True` (Admin remove-missing policy)
4. Coalesce per library across the debounce window; skip enqueue when a Running/Stopping/Queued job already covers the same `scan_folder` (no unbounded full-tree overlap). Restore `path_status` clear still runs even when enqueue is skipped.

## Ops field map

`GET /admin/api/ops/summary` → `services.library_watch`:

| Field | Meaning |
|---|---|---|
| `enabled` | Env flag on |
| `running` | Observer started |
| `roots` | Watched library root count |
| `pending_libraries` | Libraries waiting on debounce flush |
| `debounce_seconds` | Active debounce |
| `last_event_at` / `last_enqueue_at` | ISO timestamps (nullable) |
| `note` | Human hint when disabled / not started |

**Admin UI:** Ops Services row + strip tile render `enabled` / `running` / `roots` / `pending_libraries` (honest **off** when disabled).

## Unraid note

Docker volume / FUSE mounts may miss host-side renames unless the watch runs where the mount is visible. Prefer bind-mount honesty notes in the Unraid runbook — Ops.

## Non-goals (still)

- Full product redesign of scan jobs UI
- Watching every nested ROM file on arcade sets
- Auto-enable on new installs

## Code

- `gametheca/utils/library_watch.py` — controller + classify + ops pulse
- Started from `create_app` alongside the scan scheduler
- Tests: `tests/test_library_watch.py`
