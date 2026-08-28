# ADR: Schema migrations before official 1.0

**Date:** 2026-07-27  
**Status:** Accepted for 1.0 — **defer Alembic**; keep `updateschema.py` + `create_all`  
**Owners:** `agent-backend` · `agent-ops` · `maintainer`

## Context

GameTheca applies schema via `db.create_all()` plus incremental raw SQL in
`gametheca/updateschema.py` (`ADD COLUMN IF NOT EXISTS`, etc.) during
`init_manager` Phase 2. There is no Alembic revision table or rollback path.

Official **1.0.0** needs a clear upgrade story for Unraid operators without a
risky mid-release migration rewrite.

## Decision

**Defer Alembic (or Flask-Migrate) until after 1.0.0.**

For 1.0:

1. Keep `updateschema.py` as the upgrade mechanism.
2. Document operator upgrade as: pull image → `compose up` → watch init logs for
   schema phase → `/readyz` green.
3. Treat a full Alembic cutover as **1.1** work with a freeze window and dual-run
   plan (generate baseline from current models, then stop editing `updateschema`).

## Consequences

| Pros | Cons |
|---|---|
| No blocker on 1.0 ship | No automated downgrade |
| Matches what all current installs already run | Drift still possible if someone edits models without updateschema |
| Lower risk than rewriting migrate mid-polish | CI does not yet assert schema drift |

## Follow-ups (post-1.0)

- Baseline Alembic revision matching current Postgres schema
- Stop appending to `updateschema.py`; new columns go through Alembic only
- Optional CI check: model metadata vs live test DB

## Related

- Local strategy notes (v1 readiness)
- `gametheca/updateschema.py`, `gametheca/init_manager.py`
