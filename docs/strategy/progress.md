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

## Jul 26 status (Waves 4–13)

| Area | Status |
|---|---|
| Member SPA top nav + glass Style B+C | Shipped |
| App version `0.2.0`; accent `#2fd67b`; `GENERATOR_VERSION` **6** | Shipped |
| Systems hub `/systems` + platform skins | Shipped |
| React admin SPA hybrid (top nav + Jinja forms) | Foundations · users list API added |
| Game details SPA + companion Install | Shipped |
| Waves 7–11 foundations | Foundations |
| **Wave 12** WebRetro save/cheat bridge · NZBGet · Acquire UX · OpenAPI slice | Shipped |
| **Wave 13** friends API + BYO community chat link · Activity poll | Shipped |
| Competitive catalog | **77** products |
| Unraid smoke | Operator — [unraid-deploy.md](../runbooks/unraid-deploy.md) |

Program canvas: Cursor `canvases/gametheca-program.canvas.tsx`.

## Full-app review (Jul 26) — follow-ups closed in Waves 12–13

**Closed:** WebRetro IndexedDB ↔ `cloud-state`/`cloud-sram` · cheat FS write via postMessage · NZBGet + Transmission/SABnzbd in Acquire UI · OpenAPI Wave 12/13 paths · plugin runtime status · EmulatorJS eval doc · friends + community_chat_url.

**Still thin:** full admin SPA body migration · SSE in member UI · Badge filter chips · companion cheat FS write (fetch helper only) · EmulatorJS not adopted.

## Flags (see `.env.example`)

`ENABLE_ARR_MODULE`, `ENABLE_DEBRID`, `ENABLE_GAME_ASSISTS`, `ENABLE_MOD_TRACKING`, `ENABLE_ACTIVITY_FEED`, `ENABLE_PCDOS_BROWSER`, `ENABLE_RUFFLE`, `ENABLE_VR_BROWSE`, `OIDC_ENABLED`, `NZBGET_*`, …

## Still operator-owned

Live Authentik Client ID/Secret · Windows code-signing · Meta Store Quest APK · Unraid rebuild + Reset Default Themes
