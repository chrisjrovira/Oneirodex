# Roadmap execution progress

**Branch:** `feature/wave2-admin-fixes`  
**Release:** **0.2.0** (in progress)  
**Updated:** 2026-07-26

## Milestone 0.1.0 summary

| Area | Status |
|---|---|
| GameTheca package / rebrand | Done |
| Competitive gaps (*arr, calendar, quality, metadata, share, emu/i18n) | Done |
| Detail layouts · AI · hardlinks · VR | Done |
| Ops follow-ons (AI apply, arr→hardlink, Quest PWA, signing hooks) | Done |
| Docker Compose optional-module env | Done |
| Local-without-Authentik install path | Done |

## Jul 26 status (Waves 4–11)

| Area | Status |
|---|---|
| Member SPA top nav + glass Style B+C | Shipped |
| App version `0.2.0`; accent `#2fd67b`; `GENERATOR_VERSION` **6** | Shipped |
| Systems hub `/systems` + platform skins | Shipped |
| React admin SPA hybrid (top nav + Jinja forms) | Foundations |
| Game details SPA + companion Install | Shipped |
| Updates apply + Wave 7–11 foundations | Foundations (see review) |
| Competitive catalog | **77** products (incl. RetroArr / RomM clients / Hydra Classics) |
| Unraid smoke | Operator — [unraid-deploy.md](../runbooks/unraid-deploy.md) |

Program canvas: Cursor `canvases/gametheca-program.canvas.tsx` (full-app review board).

## Full-app review (Jul 26)

**Fixed:** ASGI ROM ACL · playtime start ACL · trailers ACL · activity viewer filter · health/share ACL · `/play_game` → WebRetro · Ruffle null without assets · honest cloud-save labeling.

**Still open / thin:** real WebRetro IndexedDB save sync · in-browser cheat apply · OpenAPI regen · admin SPA bodies · Acquire UX depth · NZBGet · EmulatorJS eval · RomM-style companion plugins · Badge filter chips · SSE in member UI.

**Suggested Wave 12:** saves/cheats bridge · Acquire depth · admin bodies + OpenAPI · RetroArr-class live scan / NZBGet.

## Flags (see `.env.example`)

`ENABLE_ARR_MODULE`, `ENABLE_DEBRID`, `ENABLE_GAME_ASSISTS`, `ENABLE_MOD_TRACKING`, `ENABLE_ACTIVITY_FEED`, `ENABLE_PCDOS_BROWSER`, `ENABLE_RUFFLE`, `ENABLE_VR_BROWSE`, `OIDC_ENABLED`, …

## Still operator-owned

Live Authentik Client ID/Secret · Windows code-signing · Meta Store Quest APK · Unraid rebuild + Reset Default Themes
