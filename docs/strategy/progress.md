# Roadmap execution progress

**Branch:** `main`

**Release:** **1.0.0-beta** — see the root [CHANGELOG.md](../../CHANGELOG.md). Waves **4–28** are on `origin/main`.

**Updated:** 2026-08-28 — Member/admin chrome: atmosphere behind UI, mark-only rail, flattened admin LHN, smaller rail icons, library two-bar default, loading takeover. Household scan/match: propose from the games root walks `_console-gaming` and `_pc` (skip-dir names); MAME zip dump → Arcade files; PC peel P2/P2P + Fisherman's. Package path still `gametheca/`. Standing constraints: **no** Discord · **no Class A** intel in public docs · **no store downloads**.

Wave diary (W4–W28): [archive/progress-waves-2026-07-08.md](archive/progress-waves-2026-07-08.md). Open set: [carryover-w28.md](carryover-w28.md). UI register: [ui-debt-log.md](../dev/ui-debt-log.md) (open table only). Name lock: [ADR 0003](../adr/0003-product-name-oneirodex.md).

## Product name (2026-08-26)

| | |
|---|---|
| **Chosen** | **Oneirodex** (oh-NY-roh-dex) · slug `oneirodex` · [ADR 0003](../adr/0003-product-name-oneirodex.md) |
| **Shipped surface** | **Oneirodex** in UI, Help, README, user/admin docs. Package `gametheca/`. Phase 2: `APP_IMAGE` / GitHub `chrisjrovira/oneirodex`. Phase 3a: `ONEIRODEX_*` wins over `GT_*`; CSS `--od-*` aliases |
| **Do not** | Mix OneiroDex into UI. Do not move the Python package or rename `.gt-*` classes in this wave. Do not rename running Unraid containers. Do not wrap the 11 envelope keeps. |
| **Claim soon (human)** | PyPI/npm slugs · `oneirodex.com` / `.dev` / `.app`. Hub image publish. |

## Ship TLDR

Decade room themes (`GENERATOR_VERSION` **17**) on member + admin chrome; atmosphere sits **behind** the UI. Loading is a full-viewport takeover. Library two-bar chrome is the default. Household matching: propose from `/storage` walks `_console-gaming` and proposes `_pc` as PCWIN depth 2; MAME zips are an Arcade files leaf; ROM peel on every console enum; PC peel FitGirl / Steam IDs / `v3 2 9` / `1.13.06` / `P2`/`P2P`. **Oneirodex** is the public product string (package still `gametheca`). GitHub is **`chrisjrovira/oneirodex`**. Shared JSON envelope remainder is **11** annotated keeps. CSS token ratchet **0**. **Next:** Unraid app image rebuild + Reset Default Themes; Hub image publish; package rename (phase 3b) last.

## Done

| | |
|---|---|
| **Decade rooms** | Six era presets + colour cabinets that still sit in a play room · grouped Preferences picker · `css/gt-era.css` on all three shells · placeholder covers cached per theme · Art Studio **Decade rooms** stock packs |
| **Cabinet playback** | Play bar **Save / Load / Rewind / FF / Picture / ?** · RetroArch rewind + FF keybinds · Picture CRT · Sharp · Soft · rewind off on N64/PS1/Saturn/DC/PSP |
| **Leftover chrome** | Dead sidebar JS/CSS stripped · `/admin/server_status_page` → Ops · Statistics charts in a bounded grid · Unmatched dupe **Pop out** · Library tools is a tab (`?active_tab=tools`) · Rail glyphs at rest use `--gt-accent` |
| **Reset Themes** | `gt-era.css` · `gt-shell.css` · `admin_manage_scanjobs.js` / `.css` · `admin-pages.css` · `chart-utils.js` · `base.css` · `sidebar.css` · `GENERATOR_VERSION` **17** |
| **Match / detect** | BE-DET-1…10 Done (image kinds). Waves 4–28 on main. |
| **GOW / LIGHT** | GOW-1/2 and LIGHT-1/2 **shipped** |
| **Follow-through** | Blank-cover replace wired through `download_image` (scan, queue, turbo, retry) · Help Expand/Collapse separated by `n of m open` · Preferences picker walks `group['items']` (Jinja `dict.items` crash) · UID-018: classic admin JSON failures onto `api_ok` / `api_error` with `body_status` / `body_code` (ratchet **41 → 11** annotated keeps; Arr was invisible behind a UTF-8 BOM and is now on the envelope too) · UID-017: remaining sheets on radius/type/semantic colour tokens; hardware-family marks are `--gt-family-*` (**1074 → 0**) · UX-B6: `PageStatus` on remaining admin/member page loads and leftover action/section errors (Ops glance, Chat / Notifications / Activity, Library / FilterBar / Tokens, Acquire / Report / Friends, space rail / voice / store search / wishlist / collections, Users save, Images path); Trailers **Another one** keeps the player under `LoadingOverlay` · Tile preview GOG / Epic / YouTube marks ride on `GET /api/games/<uuid>/editions` (browse still does not send `urls` or `video_urls` per tile) |
| **UIR-3 leftover** | Set completion + Playtime identity and actions live in bar two (region filter, owned count, Systems / Browse library). Admin Users Invites/Support sit in the top bar; the roster is the editor |
| **Play matrix** | Every `LibraryPlatform` has browser / companion / catalog honesty. SG-1000 and NGPC browser-play via already-shipped WASM (`genesis_plus_gx` / `mednafen_ngp`). Legal sample ROMs: NES, SNES, GB, GBC, GBA, Genesis, Atari 2600 |
| **W34 catalog corroboration** | High-confidence IGDB hits that unique-exact-disagree with Steam/GOG/Moby/TGDB go to Review (`catalog_disagreement`). Remaster tails are no-signal. Agreeing catalogs fill-only store IDs. |
| **Oneirodex phase 1** | Public string in UI, Help, README, user/admin docs. `RESET ONEIRODEX` (legacy `RESET GAMETHECA` still accepted). Package / Docker unchanged |
| **Amazon live register** | Nile/Heroic entitlements → `UserOwnedTitle`. Never downloads. CSV still works. Poller enrolled. |
| **Details disc chips** | Multi-disc count + Disc N on game details. Not on tiles. |
| **Oneirodex phase 2 (ops dual names)** | `APP_IMAGE` / `APP_CONTAINER_NAME` / `DB_CONTAINER_NAME`; OCI title **Oneirodex**. Defaults keep `gametheca-*`. GitHub default **`chrisjrovira/oneirodex`**. |
| **Oneirodex phase 3a** | `ONEIRODEX_*` wins over `GT_*`. CSS `--od-*` aliases `--gt-*`. Package path unchanged. |
| **Icon pack drawings** | Five packs ship all **17** `PACK_DRAWING_KEYS` SVGs (`PACK_DRAWING_KEYS` == `CORE_ICON_KEYS`). Chips still preview five. Outline stays the inline stroke set. SPA `IconMenu` / `IconUser` / `IconMore` expose `data-icon` so those masks apply. |
| **Envelope keeps** | [api-envelope-keeps.md](../dev/api-envelope-keeps.md) — why 11 sites stay off `api_ok`. |
| **Admin firmware scan** | Folder of dumps you already own → matching names on the volume, version picker, copyable missing markdown. Same walk as `scripts/import_bios.py`. Never downloads BIOS. |
| **Unraid stack path** | Compose Manager tree is `/mnt/user/infernal-data-streams/_projects/Oneirodex`. `/mnt/user/isos/gametheca/` is retired. |
| **Member chrome** | Rail icons 1× with matching labels; expanded mark 3× the icon column; Library/Favorites pager in-flow at the grid foot, no glass; account / hamburger / Filters have no resting outline |
| **Compose library roots** | `docker-compose.yml` interpolates `ONEIRODEX_LIBRARY_ROOTS` and `GT_LIBRARY_ROOTS` (no `env_file:`; host-only new key never reached the container) |
| **Admin era stacking** | Decade-room wallpaper no longer covers admin chrome. Atmosphere is `z-index: -1`; `.gt-rail` / `.gt-topbar` stack at 2; main at 1. Flattened `#admin-app-root` cannot. |
| **Scan / match (household tree)** | Propose from the games root walks `_console-gaming` (skip-dir + family) and proposes `_pc` as PCWIN `folders`/`2`. `MAME` zip dump → Arcade files (not a family). `PC Engine` HuCard leaf. `AAE` → Arcade. ROM peel on every console enum (`.pce` / `.ngc` / `.wsc`). PC peel: backtick, `x.y.z`, `P2`/`P2P`, Fisherman's. |
| **Local GPU AI** | `docker-compose.artwork-local.yml` → `oneirodex-sdnext-local` on :7860 (RTX 2080). SD 1.5 `v1-5-pruned-emaonly` in volume. Review app: `ENABLE_AI_ARTWORK` → `host.docker.internal:7860`. Free-ROM sample libraries scanned + **7 AI covers** via `POST /admin/api/artwork/generate`. Runbook: [artwork-gpu-workstation.md](../runbooks/artwork-gpu-workstation.md). |
| **Art Studio stock** | Review instance generated **40** platform/motif/era packs under `static/library/stock/` (Pillow size matrix; includes 6 decade rooms). |
| **README capture** | Recaptured from review `:5006` (7 AI-covered free ROMs). Slots under `docs/assets/readme/` + docs media. |

## Next

| | |
|---|---|
| Batch AI covers (NAS) | App env live on GPU URL — run `POST /admin/api/artwork/generate/batch` (or Images → Generate) on the real library |
| UID-018 | Envelope remainder (**11** annotated keeps) — do not wrap; see [api-envelope-keeps.md](../dev/api-envelope-keeps.md) |
| Hub image | Operator publish `chrisjrovira/oneirodex` |
| Code identifiers 3b | Package path `gametheca/` · `.gt-*` classes — last. Dual names required. |
| NAS → this GPU | Done: Portmaster inbound · Compose Manager → Oneirodex · `AI_ARTWORK_*` in compose app env · Unraid app reaches `192.168.50.42:7860` |

## Blocked

None for the NAS→GPU path. Optional sidecars (LiveKit / ClamAV / challenge) still stopped until an operator starts those profiles.
