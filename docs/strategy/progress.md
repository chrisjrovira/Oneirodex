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

## Jul 26 status (Waves 4–7)

| Area | Status |
|---|---|
| Member SPA top nav + glass Style B+C | Shipped |
| App version `0.2.0`; accent `#2fd67b`; `GENERATOR_VERSION` **6** | Shipped |
| Systems hub `/systems` + Flask route + platform skins | Shipped |
| React admin SPA hybrid (top nav + Jinja forms) | Shipped |
| Game details full SPA + companion Install bridge | Shipped |
| Updates apply loop (local packs + companion kind/version) | Shipped |
| Competitive catalog ≥50 + Wave 7 bets | Shipped — [competitive.md](competitive.md) |
| Emulator cores / cloud saves / `.cht` / assists | Shipped (Wave 7) |
| BYO acquire (arr + debrid) + store-hit bind | Shipped (Wave 7) |
| Big Picture fullscreen + admin SPA bodies | Shipped (Wave 7; hybrid forms remain) |
| Unraid smoke checklist (incl. acquire/emu/assists) | Operator — [unraid-deploy.md](../runbooks/unraid-deploy.md) |

Program canvas: Cursor `canvases/gametheca-program.canvas.tsx` (Wave 7 board).

## Flags (see `.env.example` / `.env.docker.example`)

`ENABLE_ARR_MODULE`, `ENABLE_ARR_HARDLINK_PIPELINE`, `ENABLE_AI_ASSIST`, `ENABLE_AI_AUTO_APPLY`, `ENABLE_HARDLINK_HELPERS`, `ALLOW_HARDLINK_APPLY`, `ENABLE_VR_BROWSE`, `ENABLE_GAME_ASSISTS`, `ENABLE_DEBRID`, `OIDC_ENABLED`, `OLLAMA_*`

## Verification

```bash
pytest tests/test_wave7_helpers.py tests/test_ops_followons.py -q
cd frontend/member-app && npm test -- --run && npm run build
cd frontend/admin-app && npm run build
cd clients/desktop && npm test && npm run build
```

Confirm View Source on Discover/Library includes `member-app.css` and `member-app.js`.

## Still operator-owned

Live Authentik Client ID/Secret · Windows code-signing certificate · Meta Store Quest APK · Unraid rebuild + **Reset Default Themes** after token/CSS ships
