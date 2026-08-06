# Upgrade notes — toward 0.2.0 / 1.0.0

**Audience:** Unraid / Compose operators  
**Date:** 2026-07-27

## From any 0.1.x / early 0.2 WIP

1. Pull or rebuild image (`docker compose build --no-cache && docker compose up -d`).
2. Confirm Compose `healthcheck` targets **`/readyz`** (repo `docker-compose.yml` already does).
3. Smoke: `curl -f http://<host>:5006/healthz` and `/readyz`.
4. Admin → Ops — expect **Services** (LiveKit · malware · companions · queues).
5. Admin → Themes → **Reset Default Themes** if chrome looks stale.
6. Optional profiles unchanged: `--profile livekit`, `--profile clamav`. Observability (Prometheus) stays a **commented stub** — [observability-profile.md](../runbooks/observability-profile.md).

## Schema

Still applied by startup `updateschema.py` (Alembic deferred — [ADR 0001](../adr/0001-schema-migrations-defer-alembic.md)). Watch init logs; do not roll back by dropping columns manually.

## Desktop companion

API tokens move to the OS credential store on next successful load; plaintext `token` is scrubbed from `config.json`. Re-pair if the store write failed once.

## Admin UI

Hybrid React + Jinja is **supported** for 1.0 — [admin-hybrid.md](../strategy/admin-hybrid.md).

## Emulation honesty

Release claims must match [v1-gamemaster-signoff.md](v1-gamemaster-signoff.md):

- **Browser vs companion** — WebRetro Play only where cores are present; GC/Wii/Dreamcast/3DS/PS2/Vita stay companion-preferred (no fake in-browser Play).
- **Deferred WASM** — PCE / Commodore / DOS browser paths unlock only when operator-vendored cores are on disk ([webretro-cores.md](../runbooks/webretro-cores.md)).
- **Sources** — DAT uploads and PC store ownership sync are the shipped paths today. Automated fetching of DATs/firmware/patches is unscheduled rather than refused; see the private scope doc.

## Related

- [v1-readiness.md](v1-readiness.md)  
- [v1-gamemaster-signoff.md](v1-gamemaster-signoff.md)  
- [docker-compose-deploy.md](../runbooks/docker-compose-deploy.md)  
- [unraid-deploy.md](../runbooks/unraid-deploy.md)  
- [observability-profile.md](../runbooks/observability-profile.md)
