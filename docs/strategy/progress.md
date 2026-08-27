# Roadmap execution progress

**Branch:** `main`

**Release:** **1.0.0-beta** — see the root [CHANGELOG.md](../../CHANGELOG.md). Waves **4–28** are on `origin/main`.

**Updated:** 2026-08-27 — **Oneirodex phase 1 (public string) landed.** Package / Docker / `GT_*` / `gt-` unchanged. Standing constraints: **no** Discord · **no Class A** intel in public docs.

Wave diary (W4–W28): [archive/progress-waves-2026-07-08.md](archive/progress-waves-2026-07-08.md). Open set: [carryover-w28.md](carryover-w28.md). UI register: [ui-debt-log.md](../dev/ui-debt-log.md) (open table only). Name lock: [ADR 0003](../adr/0003-product-name-oneirodex.md).

## Product name (2026-08-26)

| | |
|---|---|
| **Chosen** | **Oneirodex** (oh-NY-roh-dex) · slug `oneirodex` · [ADR 0003](../adr/0003-product-name-oneirodex.md) |
| **Shipped surface** | **Oneirodex** in UI, Help, README, user/admin docs. Package `gametheca/`, Docker, GitHub, `GT_*`, `--gt-*` unchanged |
| **Do not** | Mix OneiroDex / ONEIRODEX into UI. Do not rename the package or Docker image in this wave |
| **Claim soon (human)** | GitHub user/org `oneirodex` · PyPI/npm slugs · `oneirodex.com` / `.dev` / `.app` (RDAP 404 on 26 Aug 2026). `.io` not confirmed |

## Ship TLDR

Decade room themes (`GENERATOR_VERSION` **17**) on member + admin chrome; backup/placeholder art follows the room. Cabinet playback on the WebRetro play bar. **Oneirodex** is the public product string (package still `gametheca`). Play-mode matrix covers every `LibraryPlatform`, not only NES/GB. Set completion and Playtime use bar two. High-confidence IGDB hits that unique-exact-disagree with other catalogs go to Review. Admin Emulators can scan a local firmware collection and copy a markdown missing list. Shared JSON envelope remainder is **11** annotated keeps (`/healthz`, batch `ok`, `ollama_status`, hardlink preview, game-details play status, OIDC report). CSS token ratchet **0**. Page-owning SPA loads use `PageStatus` (including Ops glance, Library browse, FilterBar, Tokens, Acquire, Report, Friends dock); Trailers **Another one** uses `LoadingOverlay` so the player does not collapse. Landscape pass ticketed as INSP-* ([capability-inspiration.md](capability-inspiration.md)); named catalog stays private. Leftover admin/member chrome, GOG/Epic live register, and CSP **enforces** already on `main`. **Blank-cover replace is wired through every download path.** **Next:** README recapture on a populated instance; **Ops** Reset Themes (`gt-era.css` + UID-017 classic CSS); ops/code identifier waves.

## Done

| | |
|---|---|
| **Decade rooms** | Six era presets + colour cabinets that still sit in a play room · grouped Preferences picker · `css/gt-era.css` on all three shells · placeholder covers cached per theme · Art Studio **Decade rooms** stock packs |
| **Cabinet playback** | Play bar **Save / Load / Rewind / FF / Picture / ?** · RetroArch rewind + FF keybinds · Picture CRT · Sharp · Soft · rewind off on N64/PS1/Saturn/DC/PSP |
| **Leftover chrome** | Dead sidebar JS/CSS stripped · `/admin/server_status_page` → Ops · Statistics charts in a bounded grid · Unmatched dupe **Pop out** · Library tools is a tab (`?active_tab=tools`) · Rail glyphs at rest use `--gt-accent` |
| **Reset Themes** | `gt-era.css` · `gt-shell.css` · `admin_manage_scanjobs.js` / `.css` · `admin-pages.css` · `chart-utils.js` · `base.css` · `sidebar.css` · `GENERATOR_VERSION` **17** |
| **Match / detect** | BE-DET-1…10 Done (image kinds). Waves 4–28 on main. |
| **GOW / LIGHT** | GOW-1/2 and LIGHT-1/2 **shipped** |
| **Follow-through** | Blank-cover replace wired through `download_image` (scan, queue, turbo, retry) · Help Expand/Collapse separated by `n of m open` · Preferences picker walks `group['items']` (Jinja `dict.items` crash) · UID-018: classic admin JSON failures onto `api_ok` / `api_error` with `body_status` / `body_code` (ratchet **41 → 11** annotated keeps; Arr was invisible behind a UTF-8 BOM and is now on the envelope too) · UID-017: remaining sheets on radius/type/semantic colour tokens; hardware-family marks are `--gt-family-*` (**1074 → 0**) · UX-B6: `PageStatus` on remaining admin/member page loads, Ops glance, Chat / Notifications / Activity, Library browse / FilterBar / Tokens, Acquire / Report / Friends dock errors; Trailers **Another one** keeps the player under `LoadingOverlay` |
| **UIR-3 leftover** | Set completion + Playtime identity and actions live in bar two (region filter, owned count, Systems / Browse library). Admin Users Invites/Support sit in the top bar; the roster is the editor |
| **Play matrix** | Every `LibraryPlatform` has browser / companion / catalog honesty. SG-1000 and NGPC browser-play via already-shipped WASM (`genesis_plus_gx` / `mednafen_ngp`). Legal sample ROMs: NES, SNES, GB, GBC, GBA, Genesis, Atari 2600 |
| **W34 catalog corroboration** | High-confidence IGDB hits that unique-exact-disagree with Steam/GOG/Moby/TGDB go to Review (`catalog_disagreement`). Remaster tails are no-signal. Agreeing catalogs fill-only store IDs. |
| **Oneirodex phase 1** | Public string in UI, Help, README, user/admin docs. `RESET ONEIRODEX` (legacy `RESET GAMETHECA` still accepted). Package / Docker unchanged |
| **Admin firmware scan** | Folder of dumps you already own → matching names on the volume, version picker, copyable missing markdown. Same walk as `scripts/import_bios.py`. Never downloads BIOS. |

## Next

| | |
|---|---|
| README recapture | Populated instance — empty test-DB frames are worse than stale art |
| Icon packs | Six visually distinct packs · per-theme icon drawings (art, not code) |
| UID-017 / UID-018 | Token ratchet **0** (UID-017) · envelope remainder (**11** annotated keeps) |
| Amazon / silent DRM | Not code this cycle |
| Rename ops / code identifiers | Phase 1 (public string) **landed**. Image `chrisjrovira/oneirodex`, containers, GitHub, `gametheca/` / `GT_*` / `gt-` wait for a later ask. Dual names required. |

## Blocked

None for code. Capture needs a populated instance (`CAPTURE_BASE_URL`).
