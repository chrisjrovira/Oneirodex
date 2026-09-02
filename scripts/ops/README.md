# Ops scripts

One-shot **operational** tooling for the live Unraid host — rebuilds, smoke checks,
scan seeding, env patching. These are not part of the app and nothing in the
runtime imports them.

They were previously `scripts/_unraid_*.py`, where an underscore prefix was the
only thing separating them from real repo tooling like `api_envelope_lint.py`.
Several of these touch a live host destructively; that is a poor reason to leave
them looking like scratch files.

## Read before running

Several of these act on the **live NAS**, not a test environment:

| Script | What it does to the host |
|---|---|
| `unraid_rebuild_and_reset.py` | Compose rebuild from the live NAS tree, then resets themes |
| `unraid_reset_themes.py` | Drops and reseeds default + preset themes in `oneirodex-app` |
| `unraid_ship_update_now.py` | Compose rebuild + themes reset + smoke, skipping git pull |
| `unraid_patch_env.py` | Merges product flags and OIDC config into the live `.env` |
| `unraid_scan_leaves*.py` | Creates leaf libraries and queues scans |
| `unraid_requeue_leaves.py` | Queues a `ScanJob` per household leaf |
| `unraid_enable_oidc_db.py` | Flips `GlobalSettings.oidc_enabled` on |

The rest are read-only diagnostics: `unraid_status_snapshot.py`,
`unraid_propose_dump.py`, `unraid_list_spa_dist.py`, `unraid_spa_mtime.py`,
`unraid_git_*.py`, `unraid_rebuild_preflight.py`, `unraid_post_rebuild_smoke.py`.

None of them write git config; the `unraid_git_*` helpers pass
`safe.directory` per invocation instead.

## Convention

If a script here stops matching how the host is actually deployed, delete it
rather than leaving it to rot — git history keeps it. A stale script that still
looks runnable is the failure mode this directory exists to prevent.

Related: [unraid-deploy runbook](../../docs/runbooks/unraid-deploy.md) ·
[themes reset](../../docs/admin/themes-reset.md)
