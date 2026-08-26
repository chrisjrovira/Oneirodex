# Roadmap execution progress

**Branch:** `main`  
**Release:** **1.0.0-beta** — see the root [CHANGELOG.md](../../CHANGELOG.md). Waves **4–28** are on `origin/main`.  
**Updated:** 2026-08-26. Standing constraints: **no** Discord · **no Class A** intel in public docs.

Wave diary (W4–W28): [archive/progress-waves-2026-07-08.md](archive/progress-waves-2026-07-08.md). Open set: [carryover-w28.md](carryover-w28.md). UI register: [ui-debt-log.md](../dev/ui-debt-log.md) (open table only).

## Ship TLDR

Leftover admin/member chrome shipped (tools tab, stats grid, dupe pop-out, Ops redirect, rail accent). GOG/Epic live register. CSP **enforces**. Match coverage BE-DET-1…10 Done. This branch: docs / agents / skills context refresh.

## Done

| | |
|---|---|
| **Leftover chrome** | Dead sidebar JS/CSS stripped · `/admin/server_status_page` → Ops · Statistics charts in a bounded grid · Unmatched dupe **Pop out** · Library tools is a tab (`?active_tab=tools`) · Rail glyphs at rest use `--gt-accent` |
| **Reset Themes** | `gt-shell.css` · `admin_manage_scanjobs.js` / `.css` · `admin-pages.css` · `chart-utils.js` · `base.css` · `sidebar.css` · `GENERATOR_VERSION` **16** |
| **Match / detect** | BE-DET-1…10 Done (image kinds). Waves 4–28 on main. |
| **GOW / LIGHT** | GOW-1/2 and LIGHT-1/2 **shipped** |
| **Follow-through** | Blank-cover replace on download · Help Expand/Collapse separated by `n of m open` · six UID-018 files onto `api_error` |

## Next

| | |
|---|---|
| README recapture | Populated instance — empty test-DB frames are worse than stale art |
| Icon packs | Six visually distinct packs · per-theme icon drawings (art, not code) |
| UID-017 / UID-018 | Token migration remainder · envelope remainder |
| UIR-3 | Set completion / Playtime into bar two |
| Amazon / silent DRM | Not code this cycle |

## Blocked

None for code. Capture needs a populated instance (`CAPTURE_BASE_URL`).
