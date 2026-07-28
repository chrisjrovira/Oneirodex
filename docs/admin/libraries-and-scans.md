# Libraries & scans

Admin surfaces today are **Jinja** under `base_admin` (top bar). A React admin SPA is planned; paths below stay valid during migration.

## Add a library

1. Admin → Libraries (create / manage).
2. Point the folder at the games mount (Docker: under `/storage/...`).
3. Set **scan depth** on create/edit (GET seeds the form; save persists it).
4. Prefer a small test scan before a full library scan.

## Run a scan

- Start from library tools / scan management.
- Watch job status on Ops / scan UI; do not start overlapping full scans on the same tree unless you know the job model.
- Propose-only mode (when enabled) writes proposals instead of committing matches — review before apply.
- Progress (`N/total`) uses atomic counter bumps so multithreaded scans stay honest while titles land in the library.
- **Stop** sets status to Stopping, finishes in-flight folders (those still count), cancels the rest, then shows **Stopped N/total** — not a blank action cell.

## After scan

- Unmatched titles → Identify workbench (IGDB / Steam / GOG / RAWG).
- **Identify is fast-path:** when a scan job creates a game, folder-size walk, Steam enrichment, cover/screenshot download, and HLTB run on a background thread after the row commits (`queue_post_identify_enrichment`). The library can show the title before size/covers finish.
- Manual identify / add still sizes the folder inline (capped ~60s) and enriches inline (or uses the existing image-refresh thread).
- Covers may also fill via missing-image tools; freshness tools mark OUT/~ titles.
- Members see new platforms on **Systems** (`/systems`) once platforms appear in `/api/library_platforms`.

## Scan depth

| Value | Behavior |
|---|---|
| **1** | Treat each immediate child folder of the scan root as a game |
| **2** | Unwrap letter buckets (`_a`…`_z`, `_#`) then treat *their* children as games |

**Required for letter-bucket PC trees:** if the library root is something like `…/_pc` whose children are `_a`…`_z` / `_#` (not the games themselves), set **scan_depth = 2**. Depth 1 will treat each letter folder as a “game” and miss thousands of real titles. Flat roots (`…/_software-games`, installed `…/games`) stay at **1**.

Folder → IGDB matching expands cleaned labels into search variants (colon subtitles, trailing bare `1` strip, `2`/`II` sequel swaps, Steam App ID preference). Details: [name-resolution.md](../strategy/name-resolution.md).

Depth does not recursively walk whole trees per title; per-game stalls were from sync folder-size walks on large NAS volumes (now deferred on scan).

## Console / emulator trees (`_console-gaming`)

Do **not** create one library on a mixed console root (families + emulator installs + tools). Prefer **one library per platform ROM/game leaf** with the correct `LibraryPlatform`, `scan_mode` **files** (flat dumps) or **folders** (folder-per-game), and `scan_depth` **1** (or **2** only if that leaf uses letter buckets).

Never library-root: `_Emulators`, named emu installs, Pegasus/CRU/tools, archive-only parents. Document typo paths as-is (e.g. `Ninentdo Entertainment System`).

**Skip-dir (defense-in-depth):** folder listing ignores built-in emu/FE/tool name globs (`_Emulators`, `yuzu*`, `ryujinx*`, `dolphin*`, `bsnes*`, `pegasus*`, `cru-*`, `GOD v*`, …). Patterns are mostly **prefix** globs so titles like *God of War* or *Ecco the Dolphin* are not skipped. Operators can add more via Admin → Scanning filters with prefix `dir:` (e.g. `dir:_MyTools`). This does **not** replace per-leaf libraries — do not point a lib at a family root and rely on skips. There is no `scan_depth=3` family walker.

Full family→platform map, exclude list, and Backend DoD: [console-gaming-libraries.md](../strategy/console-gaming-libraries.md).

## Deploy note

Games volume is often **read-only** in Compose (`/storage:ro`). Scans identify and enrich metadata; they do not rewrite the games share unless you mount RW and use tools that allow it.

Related: [themes-reset.md](themes-reset.md) · [settings-modules.md](settings-modules.md) · [unraid-deploy.md](../runbooks/unraid-deploy.md)
