# Ops follow-ons design — Authentik · signing · Quest · AI apply · arr→hardlink

**Date:** 2026-07-24  
**Status:** Approved via user directive to finish the whole wave without further checkpoints.

## Goals

1. Local installs never require Authentik; SSO remains optional dual-flag.
2. Authentik LAN/HTTP wiring documented for `192.168.50.116:9000`.
3. AI triage can apply a chosen title to a game (gated); never silent background writes.
4. Completed qBittorrent downloads can preview/apply hardlinks into the library (double-gated).
5. Desktop Windows signing documented + CI/Tauri hooks (cert optional).
6. Quest MVP = installable PWA around `/vr` (native APK deferred).

## Non-goals

Heroic DRM · Hydra torrents · purchasing code-signing certs · full Capacitator Quest store app · AI rewriting disk folder trees.

## Flags

| Flag | Default | Effect |
|---|---|---|
| `OIDC_ENABLED` | false | Env half of SSO |
| `ENABLE_AI_AUTO_APPLY` | false | Allows `POST /api/ai/apply-triage` |
| `ENABLE_ARR_HARDLINK_PIPELINE` | false | Enables arr→hardlink APIs |
| `ALLOW_HARDLINK_APPLY` | false | Still required for any hardlink write |
| `ENABLE_VR_BROWSE` | false | VR page + PWA assets |

## Success

Unit tests cover flags/path safety; docs updated; unsigned desktop build still works; `/vr` installable as PWA when VR enabled.
