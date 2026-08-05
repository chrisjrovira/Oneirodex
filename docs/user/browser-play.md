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

Admin: upload BIOS via `/api/emulator-bios` (Settings / storage path), or on household Unraid optionally mount a private appdata BIOS folder — see [BIOS / firmware](#bios--firmware-filenames-only). Browse API returns `bios` + `n64_note` on playable titles. Systems hub badges show **Browser** / **Companion** / **Catalog** per platform. Operator core drops: [webretro-cores.md](../runbooks/webretro-cores.md) · health: `GET /api/emulator/health` (`deferred_cores`) · JS allowlist: `GET /api/emulator/installed-cores.js`.

## BIOS / firmware (filenames only)

GameTheca **does not ship** copyrighted BIOS binaries in git, CI artifacts, or the public Docker image. Operators supply legally obtained firmware they already own.

| How | When | Notes |
|---|---|---|
| **Admin upload** (public / default) | Always available | `POST /api/emulator-bios` → container `…/static/library/bios/` (WebRetro `biosCdn`) |
| **Local private mount** (household Unraid) | Optional | Bind host `/mnt/user/appdata/gametheca/bios` → `/app/gametheca/static/library/bios` — [unraid-deploy.md](../runbooks/unraid-deploy.md#local-private-bios-mount-vs-public-upload). Not the games share. |

**Expected filenames** (checklist — no download links):

| Core / family | Filenames |
|---|---|
| PS1 (`mednafen_psx_hw`) | `scph5500.bin` · `scph5501.bin` · `scph5502.bin` |
| Sega CD (`genesis_plus_gx`) | `bios_CD_U.bin` · `bios_CD_E.bin` · `bios_CD_J.bin` |
| Saturn (`yabause`) | `saturn_bios.bin` |
| 3DO (`opera`) | `panafz1.bin` · `panafz10.bin` |
| Neo Geo CD (`neocd`) | `neocd_f.rom` · `neocd_sf.rom` · `neocd_st.rom` · `neocd_z.rom` · `front-sp1.bin` |

Admin → emulator BIOS shows which required names are present. Missing BIOS surfaces on browse play hints.

## Play shell (WebRetro room)

Browser play opens `webretro.html` with a per-system **artistic room** — multi-layer wallpaper, floor plane, ambient lamp, bezel material sheen, bar typography hierarchy (brand eyebrow + system label), and light motion (wall drift · lamp breathe · bezel specular) — not just an accent color. Pass `platform=` (or rely on `core=` mapping) so the skin applies immediately; the bar shows the system name as the hero label.

- **← Library** on the play bar returns via `history.back()` when the referrer is same-origin, else falls back to `/library`.
- Distinct rooms include NES den, SNES living room, Genesis arcade corner, PS1 CRT night, Dreamcast swirl, Arcade cabinet, GB/GBA handheld slabs, PC desk, and more — distinguishable at a glance without reading docs.
- The emulator screen is **aspect-locked to the core's native shape** (SNES/NES/Genesis ~4:3, GBA 3:2, GB/GBC ~10:9, NDS portrait dual-screen, PSP/Vita ~16:9, etc.) instead of stretching to fill the bezel, so you no longer get big empty black bars around the picture.
- Motion respects `prefers-reduced-motion`.
- After deploy, hard-refresh the play tab (Ctrl+F5) so cached `play-skins.css` / `.js` drop. Smoke: `node gametheca/static/vendor/webretro/play-skins.assert.mjs`.

## Audio/video tuning + WASM limits (SNES and friends)

Browser Play runs RetroArch compiled to WebAssembly inside the tab — there's no native audio thread or GPU passthrough, so a few defaults are tuned to reduce common WASM artifacts:

- **Audio is clocked to the emulated system, not the browser's refresh.** `audio_sync` and `audio_rate_control` are on, with a small `audio_rate_control_delta` (0.005) that nudges the resampler by fractions of a percent, and `audio_max_timing_skew` left at the standard `0.05`. A larger buffer (`audio_latency = 96`) absorbs brief main-thread hiccups so they resample instead of crackling.
  - *If you played before this changed:* audio that ran slightly **fast and glitchy** was the known cause — skew was set three times the usual value with no `audio_sync`, so audio chased the browser's 60Hz vsync against NTSC's actual 60.098Hz and got yanked back. Rebuild/redeploy to pick up the fix, and hard-refresh so the cached player reloads.
- **`video_vsync`** is explicit so WASM frame delivery paces to the browser's `requestAnimationFrame` instead of free-running.
- **SNES "Reduce Slowdown (Overclock)"** — a pre-start core option (gear icon before you press Start) enables `snes9x_overclock_cycles = balanced`, which fixes the slowdown-driven audio pitch/crackle some demanding SNES titles (Star Fox, Kirby's Dream Land 3, some Konami games) hit under WASM CPU pressure.
- **Browser autoplay policy**: audio stays muted/suspended until you interact with the page (the **Start** click/keypress inside the emulator). If you don't hear anything, click into the play screen once before pressing Start.

Residual limits that tuning can't fully fix in-browser: WASM is single-threaded on the main thread, so heavy cores (N64, PS1 HW renderer, Saturn) can still stutter under load on lower-end hardware, and audio scheduling jitter can't reach native-app smoothness. If a title is still choppy after the overclock option, prefer the **desktop companion** (native RetroArch) for that system.

## Compressed ROMs (extract-on-play)

Browser Play streams via `GET /api/downloadrom/<uuid>` (ASGI). Server extracts a playable member into `static/library/rom_cache/<uuid>/` for:

| Format | Notes |
|---|---|
| `.zip` | Nested folders + zip-in-zip (depth ≤ 3). Multi-ROM: prefers platform extension, then larger files; `.cue` (+ sibling `.bin`) for disc sets |
| `.7z` | Requires `py7zr` |
| `.rar` | Requires `rarfile` + a host `unrar`/`bsdtar`/`7z` binary — the Docker image ships `libarchive-tools` (`bsdtar`) + `p7zip-full` (`7z`) so this works out of the box in Compose/Unraid |
| `.gz` | Single ROM wrappers only (`Adventure.nes.gz`). `.tar.gz` is **not** browser-playable (`play_blocker=unsupported_archive`) |

Failures return JSON: `{"error": "…", "code": "…", "hint": "…"}` (`error` always present). The play shell (`webretro.html`) surfaces non-2xx `/api/downloadrom/` responses in an accessible `#gt-play-alert` region (`error` plus optional `hint`) instead of a silent `.catch` — including `missing_extractor` (prefer `.zip` / host tools). Browse may set `play_blocker=unsupported_archive`; GameCard / Game Details show a disabled Play control with tooltip when that blocker is present.

When `firmware_missing` is true, browse/details also return `bios_required`, `bios.message`, and `bios.hint`. Member SPA blocks Play (quiet honesty + Help / Admin → Emulators for librarians) — **never** a Download BIOS CTA. Version Download uses `POST /api/downloads/games/<uuid>` and toasts Backend `hint` on **410** `path_missing`.

### PS1 (and other disc/`.cue`) downloads are bundled as a zip

`.cue` sheets need their sibling `.bin`/`.img`/`.iso`/`.raw`/`.wav` track files to boot — a plain HTTP GET can only stream one file. `GET /api/downloadrom/<uuid>` detects this and streams a single **stored (uncompressed) `play.zip`** containing the `.cue` (with `FILE` lines rewritten to plain basenames) plus every disc-track companion sitting next to it. WebRetro's own client-side unzip (`unzipFileMulti`) splits the bundle back into files for disc cores (PS1, Saturn, Sega CD, etc.) — no server round-trip changes were needed on the WebRetro side beyond reading the real filename off the response.

Single-file discs (`.iso`, `.chd`, a lone `.bin`) stream unchanged — no zip wrapping. The play shell reads the actual filename from the response's `Content-Disposition` header (not the request URL, which is just `/api/downloadrom/<uuid>`) and uses a long fetch timeout for ROM downloads, since PS1-sized discs can take well past the old 8-second default.

## Cloud saves (WebRetro bridge)

The play bar **Sync cloud saves** uses `gt-bridge.js` postMessage (`gt-export-saves` / `gt-import-saves`):

- Export retries briefly so slow cores can flush `.state` / battery SRAM.
- SRAM pick prefers `.srm`, then memory-card `.mcr`, then `.sav` (helps PS1-style cores).
- Import writes IndexedDB + FS and calls `_cmd_load_state` when the core exposes it; otherwise use RetroArch **Load State**.
- CSRF for upload comes from the `csrf_token` cookie (meta tag is filled from the cookie when present).

If a deferred core is still warming, status may say to sync again after **Start**.

## Cheats (`.cht`)

Browse/details payloads include **`cheat_surface`**: `retroarch` | `pc_wand` | `none`. Only `retroarch` exposes the `.cht` library (`GET/POST/DELETE /api/games/{uuid}/cheats`); create/upload/download/delete return **403** otherwise. Create with name + code rows + dialect hint (Raw / GG-style / AR-style / GS-style — capability labels only), or upload a prebuilt `.cht`. The WebRetro play bar loads the same list for **Apply cheat**; companion stages files under `app_data/cheats/{uuid}/` before RetroArch. Quick Menu may still be required to enable codes. PC / native (`PCWIN` / `PCDOS` / `MAC` / `OTHER`) report `pc_wand` — RetroArch `.cht` tooling stays hidden there; no memory injection.

**PC cheat notes.** Rather than a trainer, PC titles get **notes**: what to change and how. Each entry records a `method` — `console` (an in-game console command), `config` (an ini/cfg edit), `save` (a save-editor field), `launch_flag` (a startup argument), or a plain `note` — plus the value and any caveat. GameTheca never writes to a game binary and never injects into a running process, which keeps this on the right side of the anti-cheat line and matches the operator-owned patch-catalog stance (nothing scraped from trainer sites). Librarians and admins author entries; members read them. API: `GET`/`POST /api/games/<uuid>/pc_cheats` · `DELETE /api/games/<uuid>/pc_cheats/<id>`.

Stance: [cheats.md](../strategy/cheats.md) · companion: [desktop-companion.md](desktop-companion.md).

Full plan: [emulation-coverage.md](../strategy/emulation-coverage.md).

## Sample free ROMs (legal only)

For smoke-testing browser/companion play without commercial dumps, operators can fetch author-licensed homebrew and test ROMs via `python scripts/fetch-free-roms.py` (manifest + notes in [samples/free-roms/](../../samples/free-roms/README.md)). Binaries are gitignored; never commit pirated ROMs.
