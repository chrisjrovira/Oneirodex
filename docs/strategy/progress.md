# Roadmap execution progress

**Branch:** `main`

**Release:** **1.0.0-beta** — see the root [CHANGELOG.md](../../CHANGELOG.md). Waves **4–28** are on `origin/main`.

**Updated:** 2026-08-26 — **Product name chosen: Oneirodex** (cutover not started). Standing constraints: **no** Discord · **no Class A** intel in public docs.

Wave diary (W4–W28): [archive/progress-waves-2026-07-08.md](archive/progress-waves-2026-07-08.md). Open set: [carryover-w28.md](carryover-w28.md). UI register: [ui-debt-log.md](../dev/ui-debt-log.md) (open table only). Name lock: [ADR 0003](../adr/0003-product-name-oneirodex.md).

## Product name (2026-08-26)

| | |
|---|---|
| **Chosen** | **Oneirodex** (oh-NY-roh-dex) · slug `oneirodex` · [ADR 0003](../adr/0003-product-name-oneirodex.md) |
| **Shipped surface** | Still **GameTheca** — UI, package `gametheca/`, Docker, GitHub, `GT_*`, `--gt-*` |
| **Do not** | Mix Oneirodex into user-facing copy until a rename wave is asked for |
| **Claim soon (human)** | GitHub user/org `oneirodex` · PyPI/npm slugs · `oneirodex.com` / `.dev` / `.app` (RDAP 404 on 26 Aug 2026). `.io` not confirmed |

## Ship TLDR

Decade room themes (`GENERATOR_VERSION` **17**) on member + admin chrome; backup/placeholder art follows the room. Cabinet playback on the WebRetro play bar. Admin Emulators can scan a local firmware collection and copy a markdown missing list. Landscape pass ticketed as INSP-* ([capability-inspiration.md](capability-inspiration.md)); named catalog stays private. Leftover admin/member chrome, GOG/Epic live register, and CSP **enforces** already on `main`. **Blank-cover replace is wired through every download path.** **Next:** README recapture on a populated instance; **Ops** Reset Themes (`gt-era.css`).

## Done

| | |
|---|---|
| **Decade rooms** | Six era presets + colour cabinets that still sit in a play room · grouped Preferences picker · `css/gt-era.css` on all three shells · placeholder covers cached per theme · Art Studio **Decade rooms** stock packs |
| **Cabinet playback** | Play bar **Save / Load / Rewind / FF / Picture / ?** · RetroArch rewind + FF keybinds · Picture CRT · Sharp · Soft · rewind off on N64/PS1/Saturn/DC/PSP |
| **Leftover chrome** | Dead sidebar JS/CSS stripped · `/admin/server_status_page` → Ops · Statistics charts in a bounded grid · Unmatched dupe **Pop out** · Library tools is a tab (`?active_tab=tools`) · Rail glyphs at rest use `--gt-accent` |
| **Reset Themes** | `gt-era.css` · `gt-shell.css` · `admin_manage_scanjobs.js` / `.css` · `admin-pages.css` · `chart-utils.js` · `base.css` · `sidebar.css` · `GENERATOR_VERSION` **17** |
| **Match / detect** | BE-DET-1…10 Done (image kinds). Waves 4–28 on main. |
| **GOW / LIGHT** | GOW-1/2 and LIGHT-1/2 **shipped** |
| **Follow-through** | Blank-cover replace wired through `download_image` (scan, queue, turbo, retry) · Help Expand/Collapse separated by `n of m open` · six UID-018 files onto `api_error` |
| **Admin firmware scan** | Folder of dumps you already own → matching names on the volume, version picker, copyable missing markdown. Same walk as `scripts/import_bios.py`. Never downloads BIOS. |

## Next

| | |
|---|---|
| README recapture | Populated instance — empty test-DB frames are worse than stale art |
| Icon packs | Six visually distinct packs · per-theme icon drawings (art, not code) |
| UID-017 / UID-018 | Token migration remainder · envelope remainder |
| UIR-3 | Set completion / Playtime into bar two |
| Amazon / silent DRM | Not code this cycle |
| Rename to Oneirodex | Name locked ([ADR 0003](../adr/0003-product-name-oneirodex.md)); **not** a 1.0 gate. Public-string wave first, then ops identifiers, then `gametheca/` / `GT_*` / `gt-`. Only when asked. |

## Blocked

None for code. Capture needs a populated instance (`CAPTURE_BASE_URL`).
