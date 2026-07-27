# Dual Platform Filters + Hardening (Phased)

**Date:** 2026-07-22  
**Status:** Approved for implementation planning  
**Delivery:** Risk-ordered vertical phases; test and fix after each phase; final whole-diff review

## Goal

Close the browse UI gap for platform filtering (backend already partially accepts `platform`) and harden related Unraid/Docker failure modes: unsafe disk deletes, scraper rate limits, partial metadata commits, and broken static media URLs behind reverse proxies.

## Decisions Locked

| Topic | Choice |
|-------|--------|
| Scope | Filters UI **and** four hardening items, in phases |
| Platform controls | **Both**, as **separate** dropdowns |
| Filter combination | Independent AND with all other active filters (same as today) |
| Dropdown population | **Used-only** (library platforms from existing libraries; IGDB platforms linked to ≥1 game) |
| Verification | Automated (pytest) **plus** short manual checklist per phase |
| Delivery shape | Risk-ordered vertical phases (Approach 1) |

## Explicit Non-Goals

- Rewriting the IGDB client
- New admin settings UI for scraper rate limits
- DB migrations that change how image filenames are stored
- A separate VR filter control (VR remains a player-perspective tag when present)

## Phase Map & Exit Gates

| Phase | Goal | Exit gate |
|-------|------|-----------|
| 1. Dual platform filters | Separate Library Platform + IGDB Platform controls; fix broken browse join | pytest + manual: both filters AND with genre/library; Clear resets both |
| 2. Path sanitization | Every user/DB `folder_path` used for disk delete passes `is_safe_path` | pytest deny traversal/outside-base; valid admin delete still works |
| 3. Scraper fail-safes | Steam/RAWG shared rate limit + exponential backoff | unit tests for backoff/limiter; scan continues on failure |
| 4. Metadata savepoints | Enrichment DB writes in nested transactions | pytest: mid-apply failure rolls back savepoint only |
| 5. Static URLs | JSON cover/screenshot payloads use `url_for('static', ...)` | pytest URL shape; AJAX cards load covers |
| 6. Whole-code review | Cross-phase consistency + full relevant suite | Final pytest green + short E2E manual checklist |

**Shared rule:** implement → automated tests → short manual checklist → fix regressions → only then start the next phase. No drive-by refactors outside the phase goal.

---

## Phase 1 — Dual Platform Filters

### API parameters

Alongside existing browse filters (all AND’d):

- `library_platform` — `LibraryPlatform` enum **name** (e.g. `NES`, `PS2`); exact match on `Library.platform`
- `igdb_platform` — name from `platforms` table; match via `Game.platforms.any(Platform.name == …)`

Do **not** keep a single ambiguous `platform` query param. Prefer the two explicit names only (remove or stop using the current ambiguous `platform` handling).

### Backend (`/browse_games`)

- Remove the broken join on `Library.platform_id` / `Platform` (Library has no `platform_id`; it has `platform` as `LibraryPlatform` enum).
- Implement `library_platform` and `igdb_platform` as separate filters.
- Leave genre/theme/game_mode/player_perspective/library_uuid behavior unchanged.

### Filter list endpoints

Same response shape as `/api/genres` (`[{id, name}, …]` or equivalent fields the existing `populateDropdown` helper expects):

- `GET /api/library_platforms` — distinct platforms from existing libraries  
  - Display label = enum **value** (e.g. `"Nintendo Entertainment System (NES)"`)  
  - Option value = enum **name** (e.g. `"NES"`)
- `GET /api/igdb_platforms` — distinct `Platform` rows linked to at least one game

### UI

Files: `library_filters.html`, `library_pagination.js` (and CSS only if layout requires it).

- Two selects after Library: **Library Platform**, **IGDB Platform**
- Populate via existing `populateDropdown` helper
- Wire into `fetchFilteredGames`, Apply, Clear, localStorage restore, and URL params

### Tests

Extend browse and filters API tests for both params, empty catalogs, and used-only population.

### Manual checklist

- Select Library Platform alone → results match that library platform
- Select IGDB Platform alone → results match tagged games
- Combine with genre/library → AND behavior
- Clear → both platform selects reset and full list returns

---

## Phase 2 — Path Sanitization Before Disk Ops

### Problem

`delete_folder` (and similar delete paths) call `os.remove` / `shutil.rmtree` on user-supplied `folder_path` without `is_safe_path`. Scan paths already validate; deletes must match that bar.

### Approach

- Reuse `is_safe_path` + `get_allowed_base_directories` before every disk delete driven by request or DB folder path input
- On failure: **403**, no disk mutation
- Resolve via existing `Path.resolve` semantics in `is_safe_path` (not naive `startswith` alone)
- Audit `routes.py` delete folder/game disk cleanup and any other user-influenced `rmtree`; leave internal install `rmtree` of known theme install targets alone unless they take user input
- Stale DB cleanup for missing paths: only after the intended path string is validated against allowed bases, or reject unsafe strings outright

### Tests

Reject `../`, absolute paths outside bases, null-byte/odd input; accept a path under mocked configured bases.

### Manual checklist

- Admin delete of a valid unmatched folder under base still succeeds
- Crafted outside-base path is denied and disk unchanged

---

## Phase 3 — Scraper Rate Limits & Backoff

### Scope

`gametheca/utils/secondary_scrapers.py` (Steam + RAWG). IGDB client unchanged unless it already shares the same HTTP helper.

### Approach

- Shared HTTP helper (in-module or tiny `utils/http_retry.py` if reusable and small):
  - Per-host min interval / token bucket (Steam vs RAWG independently)
  - On `429` / `5xx` / timeout: exponential backoff with jitter, capped retries (e.g. 3), then return `None`
  - Keep hard request timeouts; never hang the scan worker
- `fetch_steam_data` / `fetch_rawg_data` use the helper; `enrich_game_metadata` contract unchanged (best-effort merge)
- Failures log at warning level; no exception escapes to abort the whole scan

### Out of scope

Response caching across games; IGDB rewrite; new config UI (env knobs only if already a project pattern).

### Tests

Mock `requests`: retry on 429, give up after cap, success path still merges.

### Manual checklist

- Force/simulate scrape failure → scan continues; partial/existing metadata retained

---

## Phase 4 — Metadata Transaction Savepoints

### Problem

Multi-source backfill in `utilities.py` mutates a game then commits. Mid-flight errors can leave partial attribute/association writes mixed with surrounding scan state.

### Approach

- Fetch Steam/RAWG **before** opening a DB savepoint (do not hold transactions across HTTP)
- Wrap each game’s enrichment **apply** in `db.session.begin_nested()`
- On failure: rollback to savepoint only; log warning; continue scan
- Prefer one helper (e.g. `apply_enriched_metadata(game_obj, enriched)`) shared by both enrichment call sites in `utilities.py`

### Tests

Mock mid-apply raise → that game unchanged after savepoint rollback; neighboring games still process.

### Manual checklist

- Enrichment error on one title does not corrupt that game’s prior committed metadata

---

## Phase 5 — Static Asset URL Hardening

### Problem

SSR templates use `url_for('static', ...)`, but AJAX browse cards build covers as hardcoded `/static/...` in `library_pagination.js`. Behind Nginx/SWAG/Traefik with a path prefix or non-root mount, images break.

### Approach

- `/browse_games` (and sibling JSON that returns relative cover filenames for client concatenation) return **ready-to-use** URLs via `url_for('static', filename=...)`
- JS uses `game.cover_url` as provided by the server (no hardcoded `/static/` prefixing)
- Align discover/favorites JSON the same way if they still emit bare filenames for client prefixing
- Do **not** rewrite stored DB image filenames — response shaping only

### Tests

Browse JSON `cover_url` uses Flask static URL shape; default cover correct when image missing.

### Manual checklist

- After Apply filters, AJAX-rendered cards show covers
- Default cover appears when a game has no image

---

## Phase 6 — Whole-Code Review & Final Verification

- Diff review across all phase changes (param names, URL shaping, shared helpers)
- Run the full relevant pytest set once
- Manual E2E: browse filters (library + both platforms + genre), safe delete under base, scan with Steam/RAWG miss/timeout still completing, covers load after filter AJAX
- Fix only issues found; no new scope

## Cross-Cutting Error Handling

- User-facing: existing JSON `{status/message}` patterns; never leak filesystem internals
- Scrapers: warn + `None`; scan continues
- Savepoints: isolate one game’s apply failure
- Path checks: deny before any `rmtree`/`remove`

## Testing Standard

- Prefer extending `tests/test_routes.py`, `tests/test_routes_apis_filters.py`, plus focused unit tests for scrapers/security/savepoints
- Each phase: automated + short manual checklist before proceeding

## Components & Data Flow (Phase 1)

```text
[library_filters.html selects]
        |
        v
[library_pagination.js] --GET--> /browse_games?library_platform=&igdb_platform=&...
        |                              |
        |                              +--> join Library for library_platform
        |                              +--> Game.platforms for igdb_platform
        v
[populateDropdown] --GET--> /api/library_platforms | /api/igdb_platforms
```

## Architecture Notes

- Follow existing filter patterns (`routes_apis/filters.py`, `populateDropdown`)
- Reuse `gametheca/utils/security.py` for path checks
- Keep scraper and savepoint helpers small and single-purpose
- Targeted cleanup only where it blocks the phase (e.g. broken `platform_id` join)
