# Console / emulator tree — library management

> **LOCKED (product decision):** **many per-platform leaf libraries** for `_console-gaming` — **not** one mega-library on the tree root or family parents.

**Audience:** Ops (library create) · PM · Backend (scan gaps) · Docs  
**Date:** 2026-07-28 · **Owner:** Game Master → Ops apply; Backend: LOCKED enums **shipped (code)** · scan DoD when scheduled  
**Evidence root (Windows share):** `Z:\_software\_games\_console-gaming`  
**Related:** [libraries-and-scans.md](../admin/libraries-and-scans.md) · [name-resolution.md](name-resolution.md) · [emulation-coverage.md](emulation-coverage.md) · [reference-sets.md](../runbooks/reference-sets.md)

Manage this tree as **many platform libraries**, not one mega-library. Goal is correct catalog + Systems filters — **not** mass-rename of disk folders.

---

## Verdict (PM lean)

| # | Rule |
|---|---|
| 1 | **Do not** create one library on `_console-gaming` (or on `NINTENDO` / `Sega` / `Sony` family parents) at `scan_depth` 1 or 2 — children are families, emu installs, and tools, not games. |
| 2 | Prefer **one GameTheca library per platform ROM/game leaf** with the matching `LibraryPlatform`, pointing at that leaf path. |
| 3 | Default `scan_mode`: **files** when the leaf is a flat dump of ROM/disc files; **folders** when the leaf is folder-per-title (or dir-per-set). `scan_depth` stays **1** unless that leaf itself uses `_a`…`_z` letter buckets (then **2**, same as PC). |
| 4 | **Never** library-root: `_Emulators`, named emulator install dirs, archive-only parents, frontend/tools (Pegasus, CRU, GOD, …). |
| 5 | Document disk paths **as-is** (including typos). Optional rename is a separate ops chore after libraries work. |
| 6 | Keep console section **separate** from `_pc` letter-bucket libraries. |

`scan_depth` today only unwraps letter buckets in **folders** mode (`_list_game_dirs`). It does **not** walk `Family → Platform → ROMs`. Depth 3 would not safely replace per-leaf libraries on this mixed tree.

---

## How the disk is shaped (evidence)

Top of `_console-gaming` (~46 entries) mixes:

- **Family folders:** `ATARI`, `NINTENDO`, `Sega`, `Sony`, `Arcade`, `Neo Geo`, … (`MAME` on this share is a zip dump leaf, not a family)
- **HuCard / TG dump leaves at tree root (not families):** `PC Engine` (flat `.pce`), `TurboGrafx-16`, `TurboGrafx CD`, `SuperGrafx`, `PCFX`
- **Vector-arcade set leaf:** `AAE` (Asteroids-class folders) → `ARCADE`
- **Glued spelling:** `Adventurevision` (no space) → `ADVISION`
- **Emulator app installs** at root and under families: `duckstation-…`, `YUZU`, `xenia_master`, `virtualjaguar-…`, `_Emulators`, `bsnes_…`, `mGBA-…`, `ryujinx-…`, `snes9x-…`, `Zinc`, …
- **Emulator app installs** at root and under families: `duckstation-…`, `YUZU`, `xenia_master`, `virtualjaguar-…`, `_Emulators`, `bsnes_…`, `mGBA-…`, `ryujinx-…`, `snes9x-…`, …
- **Stray tools:** `cru-1.4.1`, `pegasus-fe_…`, `GOD v1.0`
- Under `NINTENDO`: platform leaves (incl. typo `Ninentdo Entertainment System` ~1243 children) **plus** emu installs **plus** stray PC titles (e.g. Mario Kart 8, scene-tagged Switch/PC folders)
- `Arcade/ROMs` ~6891 dirs; `Neo Geo/ROMs` ~182; `MAME` mostly multipart archives + one emu dir

Treat family folders as **navigation only**. Library `folder` must be the **ROM/game leaf**.

---

## Operator rules (apply when creating libraries)

| Situation | Action |
|---|---|
| Flat ROM/ISO/CHD dumps in one folder | Library root = that folder · `scan_mode=files` · `scan_depth=1` (unused in files mode) |
| One subfolder per title (or per arcade set) | Library root = parent of those dirs · `scan_mode=folders` · `scan_depth=1` |
| Letter-bucketed under a console leaf (`_a`…`_z`) | Same as PC: `folders` · `scan_depth=2` |
| Family parent (`NINTENDO`, `Sega`, …) | **Do not** library; create children libs on platform leaves |
| Emulator / tool / archive-only path | **Skip** — exclude list below |
| Typo path (`Ninentdo Entertainment System`) | Point library at typo path; rename later if desired |
| Stray PC / wrong-platform folders inside a console leaf | Leave on disk or move under `_pc`; do **not** fix via deep scan of the family |
| Multipart `.rar` / incomplete sets (common under `MAME`) | Prefer extracted ROM dirs elsewhere, or defer library until extract; archive-only parents stay excluded |
| Platform with no `LibraryPlatform` enum yet | Catalog as `OTHER` **or** defer until enum exists (see gaps) — do not invent play CTAs |
| Emulator *install tree* that also nests a `ROMs` / dump leaf (e.g. portable PS1 / PSP apps) | Library the **ROM/dump leaf only** — never the emu root (`BIOS`, `plugins`, `memcards`, frontend exe, …) |

**Allowed extensions** still gate `files` mode (`AllowedFileType`). Confirm ROM/disc extensions for that platform are enabled before a full scan. Prefer a small propose-only / test scan first.

### Suggested apply order (capability)

Ops creates leaf libs in this order when standing up the console tree (exact on-disk paths stay in the private Ops checklist):

1. **NES** — typo Entertainment System leaf · prefer **folders** when title dirs dominate (mixed loose archives at the same leaf are a later consolidate chore, not a second lib on the family).  
2. **Genesis / Mega Drive** — flat dump-set leaf (**files**) and/or `…/Genesis/ROMs` (**folders**); decide twin coverage before dual-scanning the same titles.  
3. **PS1** — **`…/PlayStation/ROMs`** (**files**); never the portable emulator parent. Enable archive extensions if dumps are `.rar`/`.7z`.  
4. Then as needed: **Neo Geo** AES dump and/or `Neo Geo/ROMs` · **PSP** `ROMs` leaf (not PPSSPP root) · **Switch** title-dir leaf · **Arcade/ROMs** (slice test first).

Private Ops checklist (paths + accept boxes): `docs/_private/console-leaf-libs-checklist-2026-07-29.md` (gitignored vault).

**Docker / Unraid:** map the share under `/storage/...` and use the container path as library folder (same as PC libs). Volume is often `:ro` — scans identify metadata; they do not rewrite the share.

---

## Never library-root (exclude list)

Skip these as library `folder` values. Names are patterns from the evidence tree — match by role, not exact version string.

| Pattern / example | Why |
|---|---|
| `_Emulators`, `Emulators` | App installs, not ROMs |
| `*duckstation*`, `yuzu*`, `ryujinx*`, `xenia*`, `bsnes*`, `mgba*`, `snes9x*`, `virtualjaguar*`, `pcsx2*`, `dolphin*`, `citra*`, `flycast*`, `vita3k*`, `retroarch*` | Emulator binaries / portable installs (prefer **prefix** globs — avoid `*dolphin*` / `*yuzu*` mid-name false positives) |
| `cru-*`, `pegasus*`, `pegasus-fe*`, `GOD v*`, other FE/tools | Frontends / utilities (`GOD v*` only — not `GOD*` / `GOD *`, which skip *God of War*) |
| `Config`, `Lang`, `Plugin`, `ROMs`, `docs` | Emulator install scaffolding when a lib is pointed too high |
| `_console-gaming`, `_pc`, `walkthroughs` / `*walkthrough*` | Scan-root / lane / guide-tree leaks — not game folders |
| `* MOD`, `*-MOD*`, `* VR Mod*` | Mod / VR-mod pack folders (generic markers — not mid-title `*mod*`) |
| Folder names with generic `[… Repack]` bracket tags | Scene/repack install folders — built-in regex skip (W20-7) |
| Family-only parents without a dedicated ROM leaf: bare `NINTENDO`, `Sega`, `Sony`, `ATARI` when children are mixed platforms + emus | Wrong unit of scan |
| Archive-only parents (multipart rar packs with no extracted sets) | Scanner will invent junk titles or stall on archives |
| Root `_console-gaming` itself | Same failure mode as depth-1/2 on the mix |

**Skip-dir (shipped):** folder listing ignores built-in emu/FE/tool **prefix** globs (`_Emulators`, `yuzu*`, `ryujinx*`, `dolphin*`, `bsnes*`, `pegasus*`, `cru-*`, `GOD v*`, `mame0*`, …), scaffolding dirs (`Config`, `Lang`, `Plugin`, `ROMs`, `docs`), scan-root leaks (`_console-gaming`, `_pc`, walkthrough trees), mod/VR-mod markers, and generic `[… Repack]` bracket-tag folder names (regex). Operators add extras via Admin Scanning filters prefixed `dir:` (fnmatch) or `re:` (regex). This is **defense-in-depth only** — **correct leaf paths** remain the control; do not point a lib at a family root and rely on skips.

**Propose from the games root:** Admin **Add many: scan a folder** pointed at `/storage` (the games mount) walks `_console-gaming` even though that name is a skip-dir, and proposes `_pc` as **PCWIN** `folders` / `scan_depth=2`. A host folder named `games` that contains those lanes is walked the same way (not treated as a nested `games` dump). Walkthroughs and emu installs stay out. Pointing at `_console-gaming` itself still works.

---

## Family → suggested GameTheca libraries

Paths below are relative to `…/_console-gaming`. Use the real on-disk spelling (typos included). Adjust leaf names if the operator’s tree differs; the **unit of library** stays “one platform leaf.”

### Nintendo (`NINTENDO/…`)

| Disk leaf (evidence / typical) | `LibraryPlatform` | `scan_mode` | `scan_depth` | Notes |
|---|---|---|---|---|
| `Ninentdo Entertainment System` *(typo)* | `NES` | `files` if flat ROMs; else `folders` | 1 | ~1243 children — inspect one level; document typo path |
| `Super Nintendo*` / `SNES*` (if present) | `SNES` | files / folders by layout | 1 | Emu dirs (`bsnes*`, `snes9x*`) stay out of library root |
| `Nintendo 64` | `N64` | folders if subdirs are titles; else files | 1 | Evidence: few subdirs — verify before full scan |
| `GameBoy` / `GB` | `GB` | files / folders | 1 | Split GB vs GBC leaves if separate on disk |
| `GameBoy Color` / `GBC` | `GBC` | files / folders | 1 | |
| `GameBoy Advance` / `GBA` | `GBA` | files / folders | 1 | Skip sibling `mGBA-*` install |
| `Nintendo DS` | `NDS` | files / folders | 1 | |
| `Nintendo 3DS` (if present) | `N3DS` | folders often | 1 | Companion play — [emulation-coverage.md](emulation-coverage.md) |
| `GameCube` / `NGC` | `NGC` | folders (ISO/RVZ dirs common) | 1 | Companion (Dolphin) |
| `Wii` (if present) | `WII` | folders | 1 | Companion |
| `Virtual Boy` (if present) | `VB` | files | 1 | |
| `Switch` (~62) | **`SWITCH`** · **catalog** | folders if title dirs | 1 | No WebRetro; see LOCKED enum add list |
| Strays: `Mario Kart 8`, scene-tagged PC/Switch folders | — | **do not** attach to NES/N64/… libs | — | Move under `_pc` or ignore |

Also skip under this family: `bsnes_*`, `mGBA-*`, `ryujinx-*`, `snes9x-*`, and any other emu install folders.

### Sega (`Sega/…`)

| Disk leaf | `LibraryPlatform` | Mode | Depth |
|---|---|---|---|
| Master System / SMS | `SEGA_MS` | files / folders | 1 |
| Genesis / Mega Drive | `SEGA_MD` | files / folders | 1 |
| Sega CD / Mega-CD | `SEGA_CD` | files / folders | 1 |
| 32X | `SEGA_32X` | files / folders | 1 |
| Game Gear | `SEGA_GG` | files / folders | 1 |
| Saturn | `SEGA_SATURN` | files / folders | 1 |
| Dreamcast | `SEGA_DC` | folders often | 1 |

Loose emulator zips/exes at the `Sega` parent: **never** part of a library root — only platform ROM leaves.

### Sony (`Sony/…`)

| Disk leaf | `LibraryPlatform` | Mode | Depth |
|---|---|---|---|
| PS1 / PSX / PlayStation **`…/ROMs`** (or flat dump leaf) — **not** a portable ePSXe/DuckStation install root | `PSX` | files / folders | 1 |
| PS2 | `PS2` | folders often | 1 |
| PS3 | `PS3` | folders | 1 |
| PS4 / PS5 (if present) | `PS4` / `PS5` | folders | 1 | PS5 catalog-only play mode |
| PSP **`…/ROMs`** (if present) — **not** a PPSSPP install root | **`PSP`** · **companion** | files / folders | 1 | PPSSPP BYO; no WebRetro |
| PS Vita | `PSVITA` | folders | 1 |

Skip: `duckstation-*` and other Sony-side emu installs at family or root. If a “PlayStation” folder is itself an emulator tree (`BIOS`, `plugins`, `memcards`, frontend `.exe`), point the library at its nested **ROMs** / dump leaf only.

### Atari (`ATARI/…`)

| Disk leaf | `LibraryPlatform` | Mode | Depth |
|---|---|---|---|
| 2600 | `ATARI_2600` | files | 1 |
| 5200 | `ATARI_5200` | files | 1 |
| 7800 | `ATARI_7800` | files | 1 |
| Lynx | `LYNX` | files | 1 |
| Jaguar | `JAGUAR` | files | 1 |

Skip: `virtualjaguar-*` app dirs.

### Other families on this share

| Disk area | `LibraryPlatform` | Mode | Depth | Notes |
|---|---|---|---|---|
| `PC Engine` HuCard dump (flat `.pce` at tree root) | `PCE` | **files** | 1 | Not a family parent — proposing it as a leaf is required |
| `PC-FX` (if any) | `PCFX` | files / folders | 1 | |
| `AAE` (vector-arcade set dirs) | `ARCADE` | **folders** | 1 | Emulator-named folder whose children *are* the dumps |
| `Adventurevision` (glued) | `ADVISION` | files / folders | 1 | Household spelling; `Adventure Vision` also maps |
| `Neo Geo/ROMs` (~182) | **`NEOGEO`** · **catalog**; **never** `NEOGEO_CD` for cart sets | **folders** (dir-per-set) | 1 | Cart AES only; CD stays on `NEOGEO_CD` |
| `Neo Geo CD` leaf (if separate) | `NEOGEO_CD` | files / folders | 1 | |
| `Neo Geo Pocket` | `NGP` | files | 1 | |
| `Arcade/ROMs` (~6891 dirs) | **`ARCADE`** · **catalog** | **folders** | 1 | Huge; test-scan a slice first; no browser Play CTA in 1.0 |
| `MAME` zip dump (~8650 `.zip` + one `mame0*` emu build) | `ARCADE` | **files** | 1 | Propose the dump folder; skip `mame0274b_64bit`. Not a family parent. Companion/catalog honesty — no browser Play CTA |
| WonderSwan / Coleco / 3DO / Vectrex / Intellivision / Channel F / Odyssey 2 / Commodore leaves | Matching enum (`WS`, `COLECO`, …) | files / folders | 1 | Only if a dedicated leaf exists |
| Xbox family leaves | `XBOX` / `X360` / `XONE` / `XSX` | folders | 1 | Catalog / companion honesty per Wave 19 |

---

## `scan_mode` / depth cheat sheet

| Leaf layout | Mode | Depth | Why |
|---|---|---|---|
| Many `.nes` / `.sfc` / `.iso` / `.chd` files in one folder | `files` | 1 (N/A) | `get_game_names_from_files` lists **only immediate files** — no recursion |
| Many title folders (Arcade/ROMs style) | `folders` | 1 | Each child dir = one game |
| `_a`…`_z` under a console leaf | `folders` | **2** | Same letter-bucket rule as `_pc` |
| Family + emus + platforms mixed | — | — | **Invalid** library root |

Do **not** set depth 3 hoping to “reach” ROMs under `NINTENDO/…` — depth≥2 only unwraps **letter-bucket** names today, and non-bucket children at depth 2 are still treated as games (emu installs, typos siblings, PC strays).

---

## Product implications

| Area | Recommendation |
|---|---|
| Scan / file types | Per-leaf libraries; enable platform extensions before `files` scans; Arcade/Neo Geo AES = folders on ROM leaves |
| UI / Systems | Correct `LibraryPlatform` → Systems hub filters and play-mode badges work; `OTHER` dumps lack good skins |
| Metadata | ROM No-Intro/Redump names clean well; folder-per-game arcade sets need name filters + propose-only first on large trees |
| Emulation / launch | Library platform drives WebRetro / companion mapping — wrong platform on a leaf breaks Play honesty |
| Ops hygiene | Separate `_console-gaming` from `_pc`; optional later: move emu installs under `_Emulators` only (docs path, not required for scan) |

---

## LOCKED enum add list (Backend)

> **LOCKED (Game Master → Backend):** catalog-first adds below. **Shipped in code** (`LibraryPlatform` + play_mode + Postgres ALTER + tests). Ops can create per-leaf libs with these enums; no WebRetro Play CTAs for any row.

| Priority | Enum member | Display string (`LibraryPlatform` value) | `play_mode` honesty | AllowedFileType hints (enable before `files` scans) | Notes |
|---|---|---|---|---|---|
| 1 | `NEOGEO` | `Neo Geo AES` | **catalog** (1.0) | `zip`, `7z`, `rom` (sets often archived; prefer **folders** on `Neo Geo/ROMs`) | Cart AES only. **Never** alias to `NEOGEO_CD` / `neocd`. Companion (FBNeo / MAME BYO) is a later opt-in — not Wave 19 browser. |
| 2 | `PSP` | `Sony PSP` | **companion** | `iso`, `cso`, `pbp`, `chd`, `zip` | PPSSPP BYO companion (same honesty class as `PSVITA`). **No** WebRetro core claim. |
| 3 | `SWITCH` | `Nintendo Switch` | **catalog** | `nsp`, `xci`, `nsz`, `xcz`, `zip` (title dirs → prefer **folders**) | Catalog / optional later BYO companion only. **No** fake WebRetro. Hard platform — same honesty bar as Switch/Wii U in [emulation-coverage.md](emulation-coverage.md). |
| 4 | `ARCADE` | `Arcade` | **catalog** | `zip`, `7z` (set archives); leaf is usually **folders** on `Arcade/ROMs` | One platform for arcade/MAME-style sets. **Do not** add a separate `MAME` enum (MAME is an emulator, not a library platform). **No** browser Play CTA in 1.0. |

### Naming locks (do not bikeshed)

- Prefer **`NEOGEO`** over `NEOGEO_AES` — pairs with existing `NEOGEO_CD` the way `SEGA_MD` pairs with `SEGA_CD`; display string carries “AES.”
- Prefer **`ARCADE`** over `MAME` — keeps emulator names out of `LibraryPlatform`.
- Member names are exact Python enum identifiers for `gametheca/platform.py`.

### Wii U — defer (not in this add list)

| Candidate | Verdict |
|---|---|
| `WII_U` → `"Nintendo Wii U"` | **Defer.** No strong dedicated leaf in the current evidence brief; play path is hard (same bucket as Switch). If a Wii U ROM leaf appears later, add as **catalog** (Cemu BYO companion optional) — do not sneak into this wave. Ops: leave on disk or `OTHER` until then. |

See [emulation-coverage.md](emulation-coverage.md) “Explicit out of Wave 19” and [v1-gamemaster-signoff.md](v1-gamemaster-signoff.md).

### Backend DoD — enum wave (acceptance)

**Done (code, local):** four members · play_mode matrix · empty mapping (no `NEOCD` for `NEOGEO`) · not in `WEBRETRO_BROWSER_KEYS` · `PLATFORM_IDS` · `updateschema` ALTER · `tests/test_console_platform_enums.py`.

When PM scheduled this add list, Backend was done when:

1. Add the four members to `LibraryPlatform` with the **exact** names and display strings above.
2. Wire `play_mode_for_platform`: `NEOGEO` / `SWITCH` / `ARCADE` → **`catalog`** (`CATALOG_ONLY_PLATFORMS` or equivalent); `PSP` → **`companion`** (`COMPANION_PREFERRED_PLATFORMS`); empty or non-WebRetro `platform_emulator_mapping` (optional PPSSPP hint for PSP only — no WASM).
3. **Never** put any of the four in `WEBRETRO_BROWSER_KEYS` / browser Play paths; **never** map `NEOGEO` → `Emulator.NEOCD`.
4. Seed / document AllowedFileType extensions from the hints table (ops can enable manually if seed is deferred); Arcade + Neo Geo AES default scan guidance remains **folders**.
5. Tests: enum presence · play_mode matrix assertions · no browser CTA for the four · `NEOGEO` ≠ CD mapping.
6. No commit of secrets. (Fetching sources, chat integrations and store queues are unscheduled, not refused — see the private scope doc.)

---

## Backend DoD (scan / ops — only if scheduled)

Ops can apply the family tables with **current** scan code (interim `OTHER` / defer for LOCKED enums). Schedule Backend if we want safer mistakes and less manual leaf hunting:

1. **Docs/ops remain source of truth** for this tree until code ships; no forced mass-rename tool.
2. **Skip-dir patterns (library or global):** ignore directory names matching emu/FE/tool **prefix** globs, scaffolding dirs, scan-root/walkthrough leaks, MOD/VR-mod markers, and generic `[… Repack]` bracket tags (regex) when listing game dirs — defense in depth if someone points a lib too high. Operators add `dir:` (fnmatch) or `re:` (regex) via Admin Scan Filters. *(Shipped in code — W20-7 handoff #4; keep tests green.)*
3. **Do not implement `scan_depth=3` as “walk family trees”** without an explicit product design: letter-bucket semantics must stay; deep walk of mixed trees recreates the mega-library failure mode.
4. **Optional:** `files` mode recursive **opt-in** (or depth for files) for nested dump layouts — today files mode is flat-only; operators must point at the flat leaf.
5. **Optional library tools:** “propose libraries from tree” that lists platform-looking leaves under a console root and suggests `LibraryPlatform` + mode — propose-only, never auto-create without admin confirm. **Shipped (code, W20-1):** `GET|POST /api/library_tools/propose_leaf_libraries` · Admin UI confirm/create on Libraries + Library tools · candidates `{ path, suggested_name, platform, scan_mode, scan_depth, reason }` · `auto_create: false` · family/emu rejected · nested `ROMs` preferred · layout→mode heuristics · AllowedFileType seed adds `nsp`/`xci`/`nsz`/`xcz` · tests `tests/test_propose_leaf_libraries.py` + admin Vitest.
6. **Enum wave:** implement the **LOCKED enum add list** above (not a separate invent-as-you-go backlog).
7. **Tests:** fixtures for “family root must not be scanned as games”; skip-pattern unit tests; enum play_mode honesty.

Priority lean: ops on per-leaf libs + skip-dir ≫ **LOCKED enum add** ≫ depth-3 ≫ auto-propose.

---

## Handoffs

| Seat | Ask |
|---|---|
| **Ops / Admin** | Create one library per ROM leaf from the tables; follow **Suggested apply order**; exclude list; typo NES path as-is; library nested `ROMs` under emu trees (PS1/PSP); test-scan before Arcade ~6k; private path checklist when available |
| **`agent-backend`** | LOCKED enum add list **shipped (code)**; skip-dir **Done (W20-7 #4 · uncommitted · extended globs + repack regex + Admin `re:`/`dir:`)**; **W20-1 propose leaf libs shipped (code)** |
| **`agent-docs`** | Keep [libraries-and-scans.md](../admin/libraries-and-scans.md) pointer current; update [progress.md](progress.md) when the wave lands |
| **`agent-uiux`** | W20-1: Admin confirm/create UI shipped (Libraries + Library tools mount; create-on-confirm only) |
| **`agent-desktop`** | Companion launch still keyed by platform enum — wrong library platform ⇒ wrong core hints |

## Do not

- One library on `_console-gaming` or family parents
- Mass-rename / “fix the tree” as a prerequisite
- Scrape DAT/ROM sites; pirate indexers; Discord webhooks
- Claim Switch / Arcade / Neo Geo AES / PSP **browser** play paths in 1.0 (enums may ship catalog/companion-honest only)
- Add `MAME` or `NEOGEO_AES` as alternate enum names — names are LOCKED (`ARCADE`, `NEOGEO`)
- Map cart Neo Geo to `NEOGEO_CD` / `neocd`
- Put emulator installs or Pegasus/CRU/GOD into library roots
- Commit secrets or rewrite the games share from scan jobs
