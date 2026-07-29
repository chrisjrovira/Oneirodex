# Libraries & scans

Admin surfaces today are **Jinja** under `base_admin` (top bar). A React admin SPA is planned; paths below stay valid during migration.

## Add a library

1. Admin → Libraries (create / manage).
2. Point the folder at the games mount (Docker: under `/storage/...`).
3. Set **scan depth** on create/edit (GET seeds the form; save persists it).
4. Prefer a small test scan before a full library scan.

## Delete a library

Admin → Libraries → **Delete** opens a Bootstrap confirm modal. Confirm/Cancel must be clickable. If buttons look present but do not respond: rebuild/restart the app (page includes inline stacking CSS), hard-refresh, then optionally **Admin → Themes → Reset Themes** so `library/themes` copies pick up theme CSS/JS fixes — [troubleshooting.md](troubleshooting.md).

## Run a scan

- Start from library tools / scan management.
- Watch job status on Ops / scan UI; do not start overlapping full scans on the same tree unless you know the job model.
- Propose-only mode (when enabled) writes proposals instead of committing matches — review before apply.
- Progress (`N/total`) uses atomic counter bumps so multithreaded scans stay honest while titles land in the library.
- **Stop** sets status to Stopping, finishes in-flight folders (those still count), cancels the rest, then shows **Stopped N/total** — not a blank action cell.

## Unmatched folders

Admin → Scan management → **Unmatched Folders** tab lists rows the scanner could not auto-match, plus true duplicates and ignored entries.

Per-row actions:

- **Fix search** — opens manual add/identify with the folder's basename cleaned (release-group tags, dots/underscores, scanning filter patterns stripped) and prefilled as the search query — same cleanup the auto-matcher uses.
- **Copy path** — copies the full on-disk folder path to the clipboard.
- **Open / reveal** — best-effort: tries to deep-link the **Auto Scan** folder browser straight to that path (reuses `GET /api/browse_folders_ss?abs_path=`); if the path is outside the configured base directory (or the lookup fails), falls back to copy-to-clipboard with a toast asking you to open it in the host's file manager. The browser cannot open paths on a remote Unraid host directly.
- **Ignore / Clear / Delete** — unchanged (ignore hides from future scans, Clear drops the row only, Delete removes the folder from disk).
- **Export** — `Export CSV` / `Export JSON` buttons download the currently filtered status (`all` / `Unmatched` / `Duplicate` / `Ignore` / `Pending`) via `GET /api/unmatched_folders/export?status=…&format=csv|json` for offline triage.

## After scan

- Unmatched titles → Identify workbench (IGDB / Steam / GOG / RAWG / Epic / itch / GiantBomb / Meta·Quest via IGDB platforms).
- **Meta Quest Store & Epic** are **metadata + ownership register only** — GameTheca never downloads DRM titles from those stores. Optional CSV: `POST /api/ownership/meta_quest/csv`. Identify modes via `META_QUEST_API_MODE` (`igdb` default · `csv_only` · `disabled` · `unofficial_graphql` off unless `META_QUEST_UNOFFICIAL_GRAPHQL=1`). Optional `META_GRAPH_ACCESS_TOKEN` is reserved for a future official catalog.
- Identify metadata search: `GET /api/search_metadata?name=…&source=steam|rawg|gog|epic|itch|giantbomb|meta_quest|meta|quest` · source list: `GET /api/search_metadata/sources`.
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

## Image queue

Admin → Scan management → **Image Queue** tab manages cover/screenshot downloads.
Prefer **Admin → Settings → Art studio → Pick & queue** (`/admin/art_studio#images`) for the React artwork picker + mass queue chrome.

- **Preview** column shows a thumbnail once a file is downloaded and still present on disk; a striped placeholder shows for pending/failed rows.
- **Group by game** toggle clusters rows by title with a per-group Failed/Pending count badge, instead of one flat paginated list. Group headers include **Open picker** (Art studio Pick & queue) and **Classic edit**.
- **Status** is `Pending` / `Downloaded` / `Failed` / `File missing` (marked downloaded but the file is gone from `IMAGE_SAVE_PATH` — re-download to fix). Hover a Failed badge for the recorded reason (network error, HTTP status, disk permission, blocked URL). Queue JSON also returns `failure_reason` and `image_save_path` (`exists` / `writable` / `error`) so Unraid operators can see a read-only images volume immediately. React **Pick & queue** shows `failure_reason` on each row and banners `image_save_path.error`.
- **Retry failed** re-attempts every image with a recorded failure in one click (`POST /admin/api/download_images` with `retry_failed: true`); per-row Retry does the same for one image.
- **Auto-pick best** → `POST /admin/api/covers/batch/apply` with `policy=sgdb_then_igdb_then_generate` (optional library / platform / service from identify sources).
- **Mass cover search** → `POST /admin/api/covers/batch/search` with the same filters.
- **Mass / single cover selection** (admin):
  - `POST /admin/api/covers/search` — `{ game_uuid?|query, providers?, limit? }` → candidates across SteamGridDB / IGDB / GiantBomb
  - `POST /admin/api/covers/apply` — `{ game_uuid, url, provider }`
  - Identify chips (SPA picker): `GET /api/search_metadata/sources` + `GET /api/search_metadata?source=meta_quest|epic|itch|giantbomb`
  - `POST /admin/api/covers/batch/search` — filter `library_uuid` / `platform` / `service` / `missing_cover`
  - `POST /admin/api/covers/batch/apply` — same filters or `game_uuids` + `policy` (`sgdb_then_igdb_then_generate` | `provider:igdb` | `generate_only` | …)
- Failures are recorded on the `Image` row (`last_error`, `last_attempt_at`) by every download path (batch, single, turbo, and the eager cover/screenshot fetch during scan/identify) so a permissions or network problem on `IMAGE_SAVE_PATH` shows up in the UI instead of silently leaving images stuck "pending".

## Deploy note

Games volume is often **read-only** in Compose (`/storage:ro`). Scans identify and enrich metadata; they do not rewrite the games share unless you mount RW and use tools that allow it.

Related: [themes-reset.md](themes-reset.md) · [settings-modules.md](settings-modules.md) · [unraid-deploy.md](../runbooks/unraid-deploy.md)
