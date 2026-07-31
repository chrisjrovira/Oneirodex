# Libraries & scans

Admin surfaces today are **Jinja** under `base_admin` (top bar). A React admin SPA is planned; paths below stay valid during migration.

## Add a library

1. Admin → Libraries (create / manage).
2. Point the folder at the games mount (Docker: under `/storage/...`).
3. Set **scan depth** on create/edit (GET seeds the form; save persists it).
4. Prefer a small test scan before a full library scan.

## Delete a library

Admin → Libraries → **Delete** opens a Bootstrap confirm modal. Type the library name to enable **Confirm Delete** (delete-all uses `DELETE ALL LIBRARIES`). Confirm/Cancel must be clickable. If buttons look present but do not respond: rebuild/restart the app (page includes inline stacking CSS), hard-refresh, then optionally **Admin → Themes → Reset Themes** so `library/themes` copies pick up theme CSS/JS fixes — [troubleshooting.md](troubleshooting.md).

## Run a scan

- Start from library tools / scan management (**Auto Scan** / **Manual Scan** / **Refresh all libraries**), or `POST /api/admin/libraries/scan`.
- **Default when a scan is already Running/Stopping:** Backend **queues** the request (`ScanJob.status=Queued`, FIFO). Not silently dropped; not a hard fail.
- **Force parallel (admin only):** `force_parallel=true` or `queue_policy=force` starts alongside the running job. Response includes an honest NAS/CPU risk note. Each job still respects `scan_thread_count` / `worker_caps` (do not raise UVICORN_WORKERS for this).
- **Watcher / multi-path bursts:** When optional `GT_LIBRARY_WATCH` (Wave 3) or Admin refresh enqueues many paths while a job is Running, prefer **Queue** over force-parallel so FIFO drains under Unraid CPU caps — [unraid-deploy.md § Library root watch](../runbooks/unraid-deploy.md#library-root-watch-gt_library_watch--unraid-honesty).
- Request fields (JSON or form): `queue_policy=queue|force` and/or `force_parallel=1`. Response: `{ status: "queued"|"started"|"rejected", job_id?, position?, message, risk? }` for honest toasts.
- **UI:** When a scan is already busy, Scan management opens a conflict modal — **Queue this scan** (default focus) or **Force run now (parallel)** with an Unraid/NAS load warning — on Auto Scan, Manual Scan, Refresh all, and restart-while-busy. Toasts map `queued` / `started` / `rejected`. After theme CSS/JS updates, **Admin → Themes → Reset Themes** so `library/themes` picks up `admin_manage_scanjobs` changes.
- `POST /api/admin/libraries/refresh_all` uses the same policy (enqueue libs as Queued + promote first when idle; force runs a sequential worker in parallel with any Running job).
- Scan jobs / Ops glance show **Queued** rows (`scans.queued_count`, `jobs[].queue_position`, `queues.scans_queued`).
- Watch job status on Ops / scan UI.
- Propose-only mode (when enabled) writes proposals instead of committing matches — review before apply.
- Progress (`N/total`) uses atomic counter bumps so multithreaded scans stay honest while titles land in the library.
- **Stop** sets status to Stopping, finishes in-flight folders (those still count), cancels the rest, then shows **Stopped N/total** — not a blank action cell. Cancel also clears **Queued** jobs before they start.
- **Worker starvation guard:** scan/image turbo threads are hard-capped at runtime (default **4** each) even if Admin Server Settings store a higher value. New installs default to scan threads **1**, turbo threads **4**, turbo batch **100**. Scan futures submit in chunks; brief cooperative yields between completions. Env overrides: `GT_SCAN_THREAD_CAP` (default 4), `GT_IMAGE_DOWNLOAD_THREAD_CAP` (default 4), `GT_IMAGE_DOWNLOAD_BATCH_CAP` (default 100), `GT_WORKER_YIELD_MS` (default 5).
- **Optional root-folder watch (`GT_LIBRARY_WATCH`, default off):** when enabled, watches each library `last_scan_folder` (scan-depth–aware game leaves only; not deep arcade ROM trees), debounces 2–5s, and **enqueues** FIFO ScanJobs (add / change with updates refresh / delete honoring last remove-missing policy). Never starts unbounded scan threads. Ops pulse: `services.library_watch`. Details: [library-root-watch-spike.md](library-root-watch-spike.md) · Unraid mount limits: [unraid-deploy.md](../runbooks/unraid-deploy.md#library-root-watch-gt_library_watch--unraid-honesty).

## Unmatched folders

Admin → Scan management → **Unmatched Folders** tab lists rows the scanner could not auto-match, plus true duplicates and ignored entries. Each Unmatched/Pending row shows a quiet **Why unmatched?** one-liner from Backend fields (`why_unmatched` / `unmatched_reason` when present, else `match_reason` + `suggested_kind*`) — same copy on Admin Dashboard **Dupe glance**. When Backend sends `match_score`, it appears as a compact chip beside the Why label (null-safe; omitted when absent).

Per-row actions:

- **Open path** — **OpenPathModal** queues companion `open_path` via `POST /api/client/commands` (`{ action: "open_path", path, select: true, game_uuid: "" }` for unmatched). Clipboard fallback when the companion is offline. Path-info only: `GET /api/path/open?path=`. Does **not** jump to Auto Scan. The browser cannot open paths on a remote Unraid host directly.
- **Copy path** — copies the full on-disk folder path to the clipboard.
- **Fix search / Identify as game** — opens manual add/identify with the folder's basename cleaned (release-group tags, dots/underscores, scanning filter patterns stripped) and prefilled as the search query — same cleanup the auto-matcher uses.
- **Mark as Experience / Emulator / Tool** — `POST /api/unmatched_folders/<id>/mark_kind` catalogs the folder as gaming software (custom-range Game + `item_kind`) **without** inventing an IGDB Main Game match. Success/error toasts are honest. Also available on Admin Dashboard **Dupe glance** (filter Unmatched).
- **Backfill kind hints** — quiet toolbar action (`POST /api/unmatched_folders/backfill_suggested_kind`) fills null `suggested_kind` from on-disk proposal sidecars for legacy rows; confirm dialog; toast shows updated/scanned counts. Idempotent.
- **Ignore / Clear / Delete** — unchanged (ignore hides from future scans, Clear drops the row only, Delete removes the folder from disk).
- **Export** — `Export CSV` / `Export JSON` buttons download the currently filtered status (`all` / `Unmatched` / `Duplicate` / `Ignore` / `Pending`) via `GET /api/unmatched_folders/export?status=…&format=csv|json` for offline triage.

**Duplicate glance + fix (Wave 2a shipped):** Admin Scan management / Dashboard shows a **Dupe glance** compare UI for Duplicate / Unmatched rows with Open path, Identify as game, Mark as Experience/Emulator/Tool, and Fix false duplicates.

| Endpoint | Purpose |
|---|---|
| `GET /api/unmatched_folders` | List rows: `match_reason` · `match_score` · `folder_name` · `suggested_kind*` · `why_unmatched` / `unmatched_reason` |
| `GET /api/unmatched_folders/duplicates` | Compare payload for Duplicate rows (`titles[]` / `candidates[]` with ids, names, covers, paths, `match_reason` / `match_score` + kind/why fields) |
| `POST /api/unmatched_folders/backfill_suggested_kind` | One-shot fill null `suggested_kind` from proposal sidecars (`dry_run?` · `limit?`; idempotent) |
| `POST /api/unmatched_folders/<id>/fix` | `{action: merge\|keep\|ignore}` — merge clears the row (keep library game); keep → Unmatched; ignore → Ignore. Writes `duplicate_fix_logs` |
| `GET /api/unmatched_folders/fix_logs` | Queryable how-matched / how-fixed history |
| `GET /api/path/open?path=` | Path string only for Desktop OS explorer — **no** Auto Scan redirect. Queue reveal via `POST /api/client/commands` `{action:"open_path", path, select?}` (allowlisted under library roots; `game_uuid` optional). |

**PC extras on scan (Wave 2a):** PC libraries associate common under-game `DLC`/`extras` folders (+ sibling `Title DLC` sidecars). Details `extras[].on_server` is honest — missing disk presence stays false. Console/ROM DLC ingest remains deferred (GM-locked).

The unmatched table stretches with the Scan management page (`gt-adminpage--xl`, ~1600px): Actions wraps instead of crushing, long paths wrap/break, and a horizontal scroll wrapper covers narrow windows. After theme CSS/JS updates, **Admin → Themes → Reset Themes** (or hard-refresh) so `library/themes` copies pick up `admin_manage_scanjobs` changes.

## After scan

- Unmatched titles → Identify workbench (IGDB / Steam / GOG / RAWG / Epic / itch / GiantBomb / Meta·Quest via IGDB platforms).
- **Gaming software / emulators / tools** (not IGDB Main Game) — Steam search includes `type=software` by default (`include_software=1`). Results carry `steam_type` + `item_kind` (`game`|`experience`|`emulator`|`tool`). On IGDB miss, scan writes a proposal with `software_candidates` + `suggested_kind`, and **denormalizes** `suggested_kind` + `suggested_candidate_name` onto `UnmatchedFolder` at propose/log time (list API reads DB columns only — no N+1 sidecar I/O). `GET /api/unmatched_folders` (+ export CSV/JSON) returns `suggested_kind`, `suggested_kind_label`, `suggested_candidate_name`, plus `folder_name`, `match_reason`, `match_score`, and a deterministic `why_unmatched` / `unmatched_reason` one-liner for UI explainers. Legacy rows with null hints + on-disk proposal sidecars: one-shot `POST /api/unmatched_folders/backfill_suggested_kind` (`{dry_run?, limit?}`; idempotent; sidecar reads only for null-hint rows). Unmatched UI + Dupe glance show a **Suggested …** chip when present and pre-bias **Mark as…**. Catalog via Unmatched **Mark as Experience / Emulator / Tool** (`POST /api/unmatched_folders/<id>/mark_kind` `{item_kind, name?, steam_app_id?}`) → custom-range Game (`igdb_id ≥ 2000000420`) with `item_kind` set; clears Unmatched. Library tiles/details show **EXP** / **EMU** / **TOOL** badges for non-game kinds. Member browse: `GET /browse_games?item_kind=` (comma list; alias `content_kind=`; omit = all kinds); same on `/api/favorites`. Library SPA Kind chips (Games · Experiences · Emulators · Tools) multi-select that param. Stay on **PCWIN** (no Apps platform). Never auto-treat Steam software as IGDB Main Game; no DRM download queues.
- **Meta Quest Store & Epic** are **metadata + ownership register only** — GameTheca never downloads DRM titles from those stores. Optional CSV: `POST /api/ownership/meta_quest/csv`. Identify modes via `META_QUEST_API_MODE` (`igdb` default · `csv_only` · `disabled` · `unofficial_graphql` off unless `META_QUEST_UNOFFICIAL_GRAPHQL=1`). Optional `META_GRAPH_ACCESS_TOKEN` is reserved for a future official catalog.
- Identify metadata search: `GET /api/search_metadata?name=…&source=steam|rawg|gog|epic|itch|giantbomb|meta_quest|meta|quest` · Steam: `&include_software=0` to hide software · source list: `GET /api/search_metadata/sources`.
- **Identify is fast-path:** when a scan job creates a game, folder-size walk, Steam enrichment, cover/screenshot download, and HLTB run on a background thread after the row commits (`queue_post_identify_enrichment`). The library can show the title before size/covers finish.
- Manual identify / add still sizes the folder inline (capped ~60s) and enriches inline (or uses the existing image-refresh thread).
- Covers may also fill via missing-image tools; freshness tools mark OUT/~ titles.
- **Library health (light):** Ops `library.health` / `GET /admin/api/library/health` — deterministic cover · empty/`path_status` missing · no-IGDB/custom-range · OUT/~ · unmatched score (0–100, grades good|fair|poor; withheld when no games). Scan refreshes `Game.path_status`; Ops poll stays SQL-only — [ops-summary.md](ops-summary.md#libraryhealth-lightweight-ops-pulse).
- Members see new platforms on **Systems** (`/systems`) once platforms appear in `/api/library_platforms`.

## Scan depth

| Value | Behavior |
|---|---|
| **1** | Treat each immediate child folder of the scan root as a game |
| **2** | Unwrap letter buckets (`_a`…`_z`, `_#`) then treat *their* children as games |

**Required for letter-bucket PC trees:** if the library root is something like `…/_pc` whose children are `_a`…`_z` / `_#` (not the games themselves), set **scan_depth = 2**. Depth 1 will treat each letter folder as a “game” and miss thousands of real titles. Flat roots (`…/_software-games`, installed `…/games`) stay at **1**.

Folder → IGDB matching cleans the folder basename in Stage **A0–A14** (`parse_game_label`: scene/repack brackets + unbracketed suffixes, Incl Update / Update·Build prose, date-stamps, version/build/VR/EA junk, Steam App ID, edition/add-on peel, franchise apostrophe inject, VR re-pass after version), then expands search variants (colon subtitles, trailing bare `1` strip, `2`/`II` sequel swaps, year/pack/edition peel, Steam title as query #0 when App ID resolves, C11 bare-franchise propose-only). **Done (uncommitted, QA 166 PASS)** — details: [name-resolution.md](../strategy/name-resolution.md).

Depth does not recursively walk whole trees per title; per-game stalls were from sync folder-size walks on large NAS volumes (now deferred on scan).

## Scanning filters

Admin → Scan management → **Scan Filters** (also legacy `/admin/edit_filters`). One list, two behaviors:

| Kind | How you enter it | What it does |
|---|---|---|
| **Name tag** | Plain text (e.g. `GOG`) | Matcher strips `-tag` / `.tag` from folder basenames before identify — does **not** hide folders |
| **Skip folder** | Prefix `dir:` (e.g. `dir:_MyTools`, `dir:OpenVR*`) | Folder listing skips matching basenames (case-insensitive **fnmatch**). Built-in emu/FE/tool globs already apply; Admin rows add extras |

**UI:** How-it-works copy, examples, Kind column, and **Quick add** chips that fill the modal (Name · GOG / Open Source / Public Domain; Skip · `_MyTools` / `OpenVR*` / `Tools*` / `_Extras`). Type toggle auto-prefixes `dir:` for skip rows. Prefer **prefix** globs (`dolphin*`, `GOD v*`) over substring (`*dolphin*`, `GOD*`) so real titles are not skipped.

Skip-dir is **defense-in-depth only** — still create per-leaf libraries; do not point a lib at a family root and rely on skips. There is no separate filter-kind API column; kind is encoded by the `dir:` prefix on `filter_pattern`. Case sensitivity is stored as `'yes'|'no'` on `filters.case_sensitive` (String); both Scan management and legacy Edit filters write that form, and the scan loader accepts legacy bool / `1|0` / true-false strings. After theme CSS/JS updates, **Admin → Themes → Reset Default Themes** so `library/themes` picks up `admin_manage_scanjobs` changes.

**Quality profiles (P1-12):** Active profile `blocked_groups` + `excluded_terms` are merged into the same name-clean strip patterns as Name-tag filters during scan. Preferred groups/patterns + size bands score / prefer-exclude *arr search hits (`GET /api/arr/search`; disallowed hits omitted unless `include_disallowed=1`). Admin → **Quality profiles** SPA `/admin/quality_profiles` (list · set active · new · delete · edit · score probe) via `/api/quality-profiles`.

**Batch refresh images:** Librarian+ Library sticky **More → Refresh covers** · `POST /api/games/batch/refresh_images` `{ uuids }` (max **20**, 202 `{ queued, skipped, errors }`) enqueues the same IGDB refresh path as single-game refresh; ACL per title; skips missing / forbidden / no `igdb_id`.

## After A0–A14 ship — Library A PCWIN rescan

**When:** Stage A0–A14 name-resolution is on **origin** and the Unraid image is rebuilt from that commit (human ship). Do **not** run a live full rescan from an agent Task alone.

**Library:** Library A — platform **PCWIN**, folder = letter-bucket PC root under the games mount (container path under `/storage/.../_pc` with children `_a`…`_z` / `_#`).

**Path rule:** Operators and agents edit the repo via **UNC** or **`Y:`**. **Never remap `Z:`** (NAS game share) — library `folder` paths and host mounts stay as configured.

### Exact operator steps

1. **Preflight** — Host disk free (not ~99%); stack healthy (`/readyz`); Admin → Themes → **Reset Default Themes** + confirm member-app dist in View Source — [unraid-deploy.md § Deploy gates](../runbooks/unraid-deploy.md#deploy-gates-operator-checklist).
2. **Confirm depth** — Admin → Libraries → Library A (PCWIN): **`scan_depth = 2`**. Save if wrong.
3. **Propose-only first** — Start a scan with propose-only enabled (writes proposals / unmatched without committing low-confidence matches). Watch Admin → Scan jobs / Ops `scans.jobs[]`. Stop if overlapping full jobs exist.
4. **Review** — Admin → Scan management → Unmatched Folders (+ any proposal review UI). Spot-check letter buckets; Fix search / Identify as needed.
5. **Full rescan** — After propose-only looks sane, run a **full** Library A scan at `scan_depth=2`. One full job at a time on this tree.
6. **Sign-off** — Ops glance healthy; unmatched count trend down vs pre-A0–A14; no games-RO false alarms on Ops issues.

Games mount stays **`:ro`**. Rescan identifies and enriches metadata; it does not rewrite the games share.

## Console / emulator trees (`_console-gaming`)

Do **not** create one library on a mixed console root (families + emulator installs + tools). Prefer **one library per platform ROM/game leaf** with the correct `LibraryPlatform`, `scan_mode` **files** (flat dumps) or **folders** (folder-per-game), and `scan_depth` **1** (or **2** only if that leaf uses letter buckets).

Never library-root: `_Emulators`, named emu installs, Pegasus/CRU/tools, archive-only parents. Document typo paths as-is (e.g. `Ninentdo Entertainment System`).

**Skip-dir (defense-in-depth):** folder listing ignores built-in emu/FE/tool name globs (`_Emulators`, `yuzu*`, `ryujinx*`, `dolphin*`, `bsnes*`, `pegasus*`, `cru-*`, `GOD v*`, …). Patterns are mostly **prefix** globs so titles like *God of War* or *Ecco the Dolphin* are not skipped. Operators can add more via Admin → Scan management → **Scan Filters** with type **Skip folder** (`dir:` prefix, e.g. `dir:_MyTools`) — see [Scanning filters](#scanning-filters). This does **not** replace per-leaf libraries — do not point a lib at a family root and rely on skips. There is no `scan_depth=3` family walker.

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
- Identify/match accepts bare IGDB image ids **or** expanded `{id, url}` objects for cover and screenshots (`store_image` normalizes int-or-dict — expanded cover dicts used to be dropped, leaving screenshots-only / branded **No cover art**). Cover is queued whenever IGDB provides one; until the local file lands, browse/details resolve the remote `download_url` instead of the branded placeholder.

## Deploy note

Games volume is often **read-only** in Compose (`/storage:ro`). Scans identify and enrich metadata; they do not rewrite the games share unless you mount RW and use tools that allow it.

Related: [themes-reset.md](themes-reset.md) · [settings-modules.md](settings-modules.md) · [unraid-deploy.md](../runbooks/unraid-deploy.md) · [name-resolution.md](../strategy/name-resolution.md)
