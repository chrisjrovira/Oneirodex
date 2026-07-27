# EmulatorJS evaluation (Wave 12d)

**Date:** 2026-07-26 · **Status:** eval notes (not adopted)

## Context

Competitive review flagged [Gaseous](https://github.com/gaseous-project/gaseous-server) and RetroArr for EmulatorJS-based in-browser play with stronger save UX. GameTheca already ships **WebRetro** (libretro WASM) with system skins and a Wave 12 IndexedDB ↔ cloud save bridge.

## Recommendation

| Option | Pros | Cons |
|---|---|---|
| Stay on WebRetro | Shared libretro cores with RetroArch companion; bridge now real | Upstream UI quirks; cheat auto-apply still needs Quick Menu on some cores |
| Add EmulatorJS path | Polished save UI in some forks; alternate cores | Dual-maintain; different save formats; license/CDN surface |
| Hybrid | Feature-flag EmulatorJS for 1–2 systems | Highest complexity |

**Decision:** Keep WebRetro as primary. Treat EmulatorJS as a **plugin registry entry** (`emu.emulatorjs`, status `eval`) until cloud-save + cheat bridges prove insufficient for a system family. Revisit after Wave 12 Unraid smoke if a specific core class (e.g. N64) remains broken in WebRetro.

## Exit criteria to adopt EmulatorJS

1. Documented core gap WebRetro cannot close for a household-critical platform.
2. Save slot format mapping to existing `/api/games/{uuid}/saves`.
3. Feature flag `ENABLE_EMULATORJS` default off; no CDN dependency in offline Unraid installs.
