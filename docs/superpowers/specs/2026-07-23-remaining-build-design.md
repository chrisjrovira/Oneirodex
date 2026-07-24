# Remaining build wave — design

**Date:** 2026-07-23  
**Status:** Approved (user: start)  
**Branch:** `feature/roadmap-q1-foundation`

## Tracks

### A — lifecycle_state API
- Emit `lifecycle_state` + `client_connected` on browse, discover, game details.
- Web: `update_available` when game has updates/freshness signal; else `not_downloaded`.
- `client_connected` always false on web until companion heartbeat exists.

### B — Desktop Tauri shell
- Tauri 2 scaffold under `clients/desktop/`.
- Persist base URL + API token (file store; keychain adapter hook).
- Thin UI: auth + library list via `@gametheca/api-client` + lifecycle registry.
- Out of wave: full extract/install/AV signing.

### C — OIDC / Authentik readiness
- ProxyFix / forwarded proto hardening if missing.
- Runbook smoke checklist; unit tests for claim mapping remain green.
- Live Authentik requires operator-supplied issuer/client (not blocked on code).

### D — Ownership sync (register-only)
- Models: store account + owned titles; match to `Game`.
- Steam import first (API key or CSV); set `owned`/`store_owned` on browse.
- Never download/install from stores.

## Non-goals
Heroic DRM downloads, Hydra torrent/debrid, full Tauri install pipeline.
