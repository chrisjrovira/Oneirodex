# Game Master domain sign-off — official 1.0

**Date:** 2026-07-27  
**Seat:** `@agent-gamemaster` (team seat 7)  
**Gate:** [v1-readiness.md](v1-readiness.md) § gate 7  
**Sources:** [emulation-coverage.md](emulation-coverage.md) · [library-and-systems.md](../user/library-and-systems.md) · [browser-play.md](../user/browser-play.md)

## Verdict

**Ready with caveats.** Library taxonomy, Systems play-mode badges, and the browser/companion/catalog matrix are honest enough for a 1.0 claim, provided release notes and marketing do **not** oversell browser Play for deferred WASM cores or companion-preferred systems, and do **not** imply acquisition scrapes or DRM store queues.

Caveats that stay operator-facing (not release blockers if documented): WASM cores are discover-on-disk, not vendored; PCE/Commodore/DOS browser paths unlock only when cores are present; GC/Wii/Dreamcast/3DS/PS2/Vita are companion-preferred with no fake Play-in-browser CTA; PS5 / Xbox Series stay catalog-only.

## Taxonomy / facts

Operators and release authors must know:

- **Three play modes:** Browser (WebRetro WASM) · Companion (desktop RetroArch / system CLI) · Catalog (organize + download only).
- **Ceiling:** Systems **below PS5 / Xbox Series X|S** may claim a documented mode; those two are **catalog-only**.
- **Browser-covered today (shipped cores path):** NES · SNES · N64 · GB/GBC/GBA · NDS · VB · PS1 · Genesis family · Saturn · Atari line · Lynx · Jaguar · WonderSwan · NGP · Coleco · Vectrex · 3DO · Neo Geo CD · Intellivision · Channel F · Odyssey 2 — still subject to BIOS where Admin lists them.
- **Companion now / browser when WASM vendored:** PC Engine · Commodore; PC DOS companion-default (`ENABLE_PCDOS_BROWSER` still needs vendored `dosbox_pure`).
- **Companion preferred (no browser Play):** GameCube · Wii · Dreamcast · 3DS · PS Vita · PS2.
- **Catalog / optional BYO companion:** Xbox · 360 · One · PS3 · PS4 (`play_mode=companion` + hints — no fake Play).
- **Reference sets:** No-Intro / Redump DATs are **operator-uploaded**; matching prefers CRC/MD5/SHA1 when hashed. Not a scraped pirate index.
- **PC storefronts:** ownership **register-only** — no DRM download/install queues in product claims.
- **Systems hub:** family grouping + **Browser / Companion / Catalog** badges; `/api/library_platforms` exposes `play_mode`.
- **Out of 1.0 play targets (backlog, do not claim):** Switch / Wii U play path; Arcade/MAME · Amiga · MSX · Neo Geo AES as first-class play modes.

## Product implications

| Area | Recommendation |
|---|---|
| Scan / file types | Keep allowed/ignored types aligned with platform enum; do not widen scan marketing to “every dump format ever.” Multi-disc / CHD / RVZ / archive awareness stays as implemented filters, not completeness guarantees. |
| UI labels / filters | Systems hub badges and browse `play_mode` / `play_blocker` / `companion_hint` are the source of truth — never show Play-in-browser for cores we do not ship or have not discovered on disk. |
| Metadata | IGDB (and similar) covers/platforms/genres OK; DAT completeness is optional admin upload. Region/language chips and LANG/PATCH badges must not imply we scraped or sold dumps. |
| Emulation / launch | Browser = WebRetro when core present; Companion = desktop RetroArch / Dolphin / Flycast / Citra / PCSX2 / Vita3K mapped paths; Catalog-only for PS5/XSX. Operator WASM drop-in via [webretro-cores.md](../runbooks/webretro-cores.md). |

## Handoffs

- `@agent-docs`: Keep release notes / FAQ / troubleshooting aligned with this matrix; scrub any “play everything in browser” language.
- `@agent-uiux`: Preserve Systems badges + no Play CTA when `play_mode` is companion/catalog or core deferred.
- `@agent-backend`: `play_mode_for_platform` / disk discovery / `deferred_cores` remain authoritative; do not invent scrape or DRM-queue endpoints for 1.0.
- `@agent-desktop`: Companion launch + hints stay the honest path for GC/Wii/DC/3DS/PS2/Vita and deferred WASM systems.
- `@agent-qa`: Gate assertions that browser Play is absent where matrix says No / Companion / Catalog.

## Do not (1.0 release notes)

Explicit **do-not claims** for official 1.0.0 notes and external copy:

1. **No scrape** — do not claim romhacking.net (or similar) scrape, pirate indexes, or auto-fetched DAT torrents.
2. **No DRM store queues** — do not claim Steam/Epic/etc. download or install queues; ownership register only.
3. **No bundled torrent/debrid marketplace** — BYO *arr only; not a GameTheca storefront.
4. **Honesty on browser vs companion** — do not claim browser Play for GameCube/Wii/Dreamcast/3DS/PS2/Vita, or for PCE/Commodore/DOS until WASM is actually present; do not claim PS5 / Xbox Series play.
5. **No “we ship all WASM cores”** — cores are operator-placed / discover-on-disk; Python discovers `*_libretro.wasm`; JS allowlist follows installed cores.
6. **No Discord / webhook** acquisition or notify paths in library/emulation copy.

## Related

- [emulation-coverage.md](emulation-coverage.md) — Wave 19 bar and acceptance  
- [browser-play.md](../user/browser-play.md) — operator/member matrix  
- [library-and-systems.md](../user/library-and-systems.md) — Systems hub + completeness  
- [v1-readiness.md](v1-readiness.md) — gate list  
