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

## Jul 26 status (Wave 4 — UX polish)

| Area | Status |
|---|---|
| Member SPA top nav + glass Style B+C | Shipped |
| App version `0.2.0`; accent `#2fd67b`; `GENERATOR_VERSION` **6** | Shipped |
| Systems hub `/systems` + Flask route + platform skins | Shipped |
| React admin SPA hybrid (top nav + Jinja forms) | Shipped |
| Announcements composer, news RSS, updates store search | Shipped |
| Companion lifecycle sync + installed-only filter | Shipped |
| Tile slider, badge dismiss, Steam deep links, Play on tiles | Shipped |
| Unraid smoke (`build --no-cache` + Reset Themes v6) | Operator-owned |

Program canvas:  
`C:\Users\cephyrix_zyth\.cursor\projects\c-Users-cephyrix-zyth-Desktop-gametheca\canvases\gametheca-program.canvas.tsx`

## Flags (see `.env.example` / `.env.docker.example`)

`ENABLE_ARR_MODULE`, `ENABLE_ARR_HARDLINK_PIPELINE`, `ENABLE_AI_ASSIST`, `ENABLE_AI_AUTO_APPLY`, `ENABLE_HARDLINK_HELPERS`, `ALLOW_HARDLINK_APPLY`, `ENABLE_VR_BROWSE`, `OIDC_ENABLED`, `OLLAMA_*`

## Verification

```bash
pytest tests/test_ops_followons.py tests/test_hardlinks_ai_vr_layouts.py tests/test_q1_foundation_unit.py -q
cd frontend/member-app && npm test -- --run && npm run build
```

Confirm View Source on Discover/Library includes `member-app.css` and `member-app.js`.

## Still operator-owned

Live Authentik Client ID/Secret · Windows code-signing certificate · Meta Store Quest APK · Unraid rebuild + **Reset Default Themes** after token/CSS ships
