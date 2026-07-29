# Browser & companion play — platform matrix

GameTheca play modes for systems **below PS5 / Xbox Series**. Those two stay **catalog + download only**.

| Platform | Browser (WebRetro) | Companion | Notes |
|---|---|---|---|
| NES · SNES · N64 | Yes | Yes | N64: try alternate core if a title fails |
| GB · GBC · GBA · NDS · VB | Yes | Yes | |
| PS1 | Yes | Yes | Needs SCPH BIOS files |
| Genesis / MS / CD / 32X / GG | Yes | Yes | CD needs region BIOS |
| Saturn | Yes | Yes | Needs `saturn_bios.bin` |
| Atari · Lynx · Jaguar · WS · NGP · Coleco · Vectrex · 3DO · Neo Geo CD · INTV · CHAF · O2 | Yes | Yes | BIOS where listed in Admin → emulator BIOS |
| PC Engine · Commodore | Companion now (browser when WASM vendored) | Yes (RetroArch cores) | Drop cores via [webretro-cores.md](../runbooks/webretro-cores.md) (`fetch-webretro-cores --from-dir`); auto-unlocks from disk |
| PC DOS | When flag + WASM | Preferred | Companion default; `ENABLE_PCDOS_BROWSER` (default on) still needs vendored `dosbox_pure` WASM — see runbook |
| GameCube · Wii | No (WASM) | Preferred | Dolphin mapped; companion_hint on browse; no browser Play |
| Dreamcast · 3DS · PS Vita · PS2 | No | Preferred | flycast / citra / vita3k / pcsx2 companion cores + hints |
| Xbox · 360 · One · PS3 · PS4 | Catalog | Optional BYO | `play_mode=companion` + hints; no fake Play |
| PS5 · Xbox Series | Catalog only | — | `play_mode=catalog` |

Admin: upload BIOS via `/api/emulator-bios` (Settings / storage path). Browse API returns `bios` + `n64_note` on playable titles. Systems hub badges show **Browser** / **Companion** / **Catalog** per platform. Operator core drops: [webretro-cores.md](../runbooks/webretro-cores.md) · health: `GET /api/emulator/health` (`deferred_cores`) · JS allowlist: `GET /api/emulator/installed-cores.js`.

## Play shell (WebRetro room)

Browser play opens `webretro.html` with a per-system **room** skin (wallpaper, bezel chrome, bar typography, ambient light) — not just an accent color. Pass `platform=` (or rely on `core=` mapping) so the skin applies immediately; the bar shows the system name.

- **← Library** on the play bar returns via `history.back()` when the referrer is same-origin, else falls back to `/library`.
- Distinct rooms include NES den, SNES living room, Genesis arcade corner, PS1 CRT night, Dreamcast swirl, Arcade cabinet, GB/GBA handheld slabs, PC desk, and more.

## Compressed ROMs (extract-on-play)

Browser Play streams via `GET /api/downloadrom/<uuid>` (ASGI). Server extracts a playable member into `static/library/rom_cache/<uuid>/` for:

| Format | Notes |
|---|---|
| `.zip` | Nested folders + zip-in-zip (depth ≤ 3). Multi-ROM: prefers platform extension, then larger files; `.cue` (+ sibling `.bin`) for disc sets |
| `.7z` | Requires `py7zr` |
| `.rar` | Requires `rarfile` + host `unrar`/`bsdtar` |
| `.gz` | Single ROM wrappers only (`Adventure.nes.gz`). `.tar.gz` is **not** browser-playable (`play_blocker=unsupported_archive`) |

Failures return JSON: `{"error": "…", "code": "…", "hint": "…"}` (`error` always present). The play shell (`webretro.html`) surfaces non-2xx `/api/downloadrom/` responses in an accessible `#gt-play-alert` region (`error` plus optional `hint`) instead of a silent `.catch`. Browse may set `play_blocker=unsupported_archive`; GameCard / Game Details show a disabled Play control with tooltip when that blocker is present.

## Cloud saves (WebRetro bridge)

The play bar **Sync cloud saves** uses `gt-bridge.js` postMessage (`gt-export-saves` / `gt-import-saves`):

- Export retries briefly so slow cores can flush `.state` / battery SRAM.
- SRAM pick prefers `.srm`, then memory-card `.mcr`, then `.sav` (helps PS1-style cores).
- Import writes IndexedDB + FS and calls `_cmd_load_state` when the core exposes it; otherwise use RetroArch **Load State**.
- CSRF for upload comes from the `csrf_token` cookie (meta tag is filled from the cookie when present).

If a deferred core is still warming, status may say to sync again after **Start**.

Full plan: [emulation-coverage.md](../strategy/emulation-coverage.md).

## Sample free ROMs (legal only)

For smoke-testing browser/companion play without commercial dumps, operators can fetch author-licensed homebrew and test ROMs via `python scripts/fetch-free-roms.py` (manifest + notes in [samples/free-roms/](../../samples/free-roms/README.md)). Binaries are gitignored; never commit pirated ROMs.
