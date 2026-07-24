# Roadmap execution progress

**Branch:** `feature/roadmap-q1-foundation`  
**Release:** **0.1.0** (2026-07-24)  
**Updated:** 2026-07-24 (version bump + docs + Docker optional-module env)

## Milestone 0.1.0 summary

| Area | Status |
|---|---|
| GameTheca package / rebrand | Done |
| Competitive gaps (*arr, calendar, quality, metadata, share, emu/i18n) | Done |
| Detail layouts · AI · hardlinks · VR | Done |
| Ops follow-ons (AI apply, arr→hardlink, Quest PWA, signing hooks) | Done |
| Docker Compose optional module env | Done |
| Local-without-Authentik install path | Done |

## Flags (see `.env.example` / `.env.docker.example`)

`ENABLE_ARR_MODULE`, `ENABLE_ARR_HARDLINK_PIPELINE`, `ENABLE_AI_ASSIST`, `ENABLE_AI_AUTO_APPLY`, `ENABLE_HARDLINK_HELPERS`, `ALLOW_HARDLINK_APPLY`, `ENABLE_VR_BROWSE`, `OIDC_ENABLED`, `OLLAMA_*`

## Verification

```bash
pytest tests/test_ops_followons.py tests/test_hardlinks_ai_vr_layouts.py tests/test_q1_foundation_unit.py -q
```

## Still operator-owned

Live Authentik Client ID/Secret · Windows code-signing certificate · Meta Store Quest APK  
