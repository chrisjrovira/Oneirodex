# Emulation coverage — Wave 19

**Date:** 2026-07-26 · **Status:** **19a–g shipped** + operator WASM scaffold (disk discovery + runbook; binaries still not vendored)  
**Bar:** Catalog + play path for systems **below PS5** and **below Xbox Series X|S**. Those two stay catalog-only.

## Play modes

| Mode | Meaning |
|---|---|
| **Browser** | WebRetro WASM (or future EmulatorJS) |
| **Companion** | Desktop RetroArch / system emulator CLI |
| **Catalog** | Library organize + download only |

## Scaffolding shipped

- Enum: `WII`, `N3DS`, `SEGA_DC`, `PSVITA` (+ Postgres `libraryplatform` ALTER)
- Console leaf enums (LOCKED): `NEOGEO` · `PSP` · `SWITCH` · `ARCADE` — catalog/companion honesty; never `NEOGEO`→`neocd`
- `play_mode_for_platform()` · `CATALOG_ONLY_PLATFORMS` · `COMPANION_PREFERRED_PLATFORMS`
- `browse_play_fields` returns `play_mode` / `play_blocker` / `companion_hint`
- Systems hub shows Browser / Companion / Catalog badges
- VICE_X64SC label fixed to “Commodore 64”

## Already browser-covered

NES · SNES · N64 · GB/GBC/GBA · NDS · VB · PS1 · Genesis family (MD / MS / CD / 32X / GG / **SG-1000**) · Saturn · Atari line · Lynx · Jaguar · WonderSwan · NGP / **NGPC** · Coleco · Vectrex · 3DO · Neo Geo CD · Intellivision · Channel F · Odyssey 2

## Wave 19 slices

| Slice | Scope | Mode | Status |
|---|---|---|---|
| **scaffold** | Enums + play_mode honesty | — | **Done** |
| **19a** | PCE + Commodore — companion cores; browser when WASM vendored | Companion → browser | **Done** |
| **19b** | PC DOS — companion; browser with `ENABLE_PCDOS_BROWSER` + WASM | Companion default | **Done** |
| **19c** | GameCube + Wii — Dolphin companion + hints | Companion | **Done** |
| **19d** | Dreamcast + 3DS — Flycast / Citra companion cores + hints | Companion | **Done** |
| **19e** | PS2 + Vita — PCSX2 / Vita3K companion cores + hints | Companion | **Done** |
| **19f** | Xbox / 360 / One · PS3 / PS4 — catalog + BYO companion hints; PS5/XSX catalog-only | Catalog / companion | **Done** |
| **19g** | Systems hub `play_mode` badges + matrix docs | Docs + UI | **Done** |

## Explicit out of Wave 19 play targets

- **PS5** · **Xbox Series X|S** — catalog only  
- Switch / Wii U — **`SWITCH` enum shipped (catalog)**; Wii U deferred; no play CTA — [console-gaming-libraries.md](console-gaming-libraries.md)  
- Arcade · Neo Geo AES · Amiga · MSX — **`ARCADE` + `NEOGEO` enums shipped (catalog)**; Amiga/MSX still backlog; no browser Play — same doc  
- PSP — **`PSP` enum shipped (companion / PPSSPP BYO)**; no WebRetro  
- Shipping large WASM cores (PCE/VICE/DOSBox/Dolphin) — operator places files; see [webretro-cores.md](../runbooks/webretro-cores.md) (`scripts/fetch-webretro-cores`); Python discovers `*_libretro.wasm` on disk; JS allowlist via `/api/emulator/installed-cores.js`

## Sample free ROMs

Legal homebrew / test ROMs for operator smoke tests: [samples/free-roms/](../../samples/free-roms/README.md) + `scripts/fetch-free-roms.py`. Only freely licensed / public-domain / author-redistributable titles with verified GitHub URLs; binaries gitignored. Fetched today: NES, SNES, GB, GBC, GBA, Genesis, Atari 2600. Master System / N64 and BIOS-gated systems stay skipped until a clear licensed URL exists.

## Acceptance

1. Every system **below PS5 / Series** that we claim in Systems has a documented mode (browser | companion | catalog).  
2. No Play-in-browser CTA for cores we do not ship.  
3. PCE + Commodore either play in browser or honest companion.  
4. GC/Wii/Dreamcast/3DS/PS2/Vita have companion clarity.

## Code anchors

- `gametheca/platform.py` — enum, mapping, `play_mode_for_platform`, `WEBRETR_INSTALLED_CORES`  
- `gametheca/utils/webretro_cores.py` — disk discovery + `deferred_cores`  
- `gametheca/utils/play_url.py` — `WEBRETRO_PLATFORMS`, `COMPANION_HINTS`, `browse_play_fields`  
- `gametheca/routes_apis/filters.py` — `play_mode` on `/api/library_platforms`  
- `gametheca/routes_apis/wave8_11.py` — `/api/emulator/health`  
- `frontend/member-app/src/pages/SystemsPage.jsx` — mode badges  
- `clients/desktop/src/retroarch.ts` — companion  
- `clients/desktop/src/apply_patch.ts` — Flips IPS/BPS apply (gated)  
- `clients/desktop/src/retroarch.ts` — companion + AI Service setup note  
- [webretro-cores.md](../runbooks/webretro-cores.md) — operator drop-in steps  
- [translation-patches.md](../user/translation-patches.md) — ROM language chips + patch catalog / Flips  
- [retroarch-ai-service.md](../runbooks/retroarch-ai-service.md) · [rom-auto-translate.md](rom-auto-translate.md)
