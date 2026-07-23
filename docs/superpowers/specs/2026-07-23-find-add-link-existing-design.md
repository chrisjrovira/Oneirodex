# Design: Find/Add MVP — Link Existing Library Game (Track 4)

Date: 2026-07-23
Branch: `feature/find-add-link-existing`

## Problem

Admins identifying an unmatched/disk-scanned folder on `admin_game_identify`
(`add_game_manual`) can currently only create a **brand-new** `Game` row by
searching IGDB or entering a custom entry. There is no way to say "this disk
folder actually belongs to a game that already exists in the library" (e.g.
re-installed to a new drive letter, restored from backup with a different
subfolder, or duplicate scan of relocated files). Admins have to manually
edit the existing game's path elsewhere and separately clean up the
`UnmatchedFolder` row.

## Goal

Add a "link to existing game" path on the Identify page:

1. Admin searches existing library games by name.
2. Admin picks one from the results.
3. Confirming updates that game's `full_disk_path` to the folder currently
   being identified, deletes the matching `UnmatchedFolder` row (if any),
   flashes a success message, and redirects to
   `main.scan_management` (`active_tab=unmatched`).

The existing "add via IGDB / custom game" flow (`AddGameForm` +
`add_game_manual` POST) must remain fully intact — this is an additive path,
not a replacement.

## Approach

### Backend

1. **Search API** — `GET /api/admin/games_search?q=<term>`
   - New module `sharewarez/routes_apis/admin_search.py`, registered on the
     existing `apis_bp` (prefix `/api`), so the route is `/api/admin/games_search`.
   - `@login_required` + `@admin_required` (this is an admin-only tool,
     unlike the existing public `/api/search` used for user-facing search;
     we intentionally do not reuse `/api/search` because it is available to
     any logged-in user and does not return `full_disk_path`, which would be
     an information disclosure if reused as-is).
   - Case-insensitive `ilike` match on `Game.name`, ordered by name,
     hard-capped to 20 rows.
   - Response: `[{uuid, name, full_disk_path}, ...]`.

2. **Link action** — `POST /games/link_existing_game` (blueprint `games`,
   same blueprint as `add_game_manual`), form-encoded POST (not JSON) so the
   existing Flask `flash()` + `redirect()` UX matches `add_game_manual`
   exactly, and so a normal (non-fetch) `<form>` submit "just works" including
   CSRF via the standard `csrf_token` hidden field.
   - Fields: `game_uuid`, `full_disk_path`, `from_unmatched` (hidden, passed
     through from the page so failures can redirect back to Identify with the
     same context).
   - Validates `full_disk_path` with `is_safe_path` +
     `get_allowed_base_directories`, exactly like `add_game_manual` does for
     the create path. Rejects if the path is not inside an allowed base.
   - Looks up the `Game` by `uuid`; 404-equivalent (flash + redirect back) if
     missing.
   - On success: sets `game.full_disk_path`, deletes the matching
     `UnmatchedFolder` (`folder_path == full_disk_path`) in the same
     transaction/commit (mirrors the delete-in-same-commit pattern already
     used in `add_game_manual`), commits, logs a `log_system_event`, flashes
     success, redirects to `main.scan_management` with `active_tab='unmatched'`.
   - On any validation/DB error: flash error, redirect back to
     `games.add_game_manual` with the original query args so the admin can
     retry without losing context.
   - A dedicated route (rather than overloading `add_game_manual`'s POST
     handler with an `action` switch) keeps the existing `AddGameForm`
     validation path untouched and the diff minimal/reviewable.

3. **Prefill enhancement** — `add_game_manual` GET handling gains `igdb_id`
   query-arg prefill (it already prefills `full_disk_path`/`library_uuid` but
   silently dropped `igdb_id`), and
  `library_tools.approve_proposal`'s `identify_hint` now includes
  `&igdb_id=<id>` so a future/existing Library Tools UI that follows that
  hint lands on Identify with both fields pre-populated.

### Frontend

- `admin_game_identify.html`: new "Link to Existing Library Game" panel
  between the Full Disk Path field and the collapsible Details section.
  Contains a search input, a results list (reusing the existing
  `#search-results` / `.search-result-item` visual language already defined
  in `admin_game_identify.css` for the IGDB-by-name search), a selected-game
  confirmation line, and a "Link Selected Game" button that is disabled until
  a result is chosen. A hidden `<form>` (real POST, CSRF token included)
  targets the new `link_existing_game` route.
- `admin_game_identify.js`: debounced fetch to
  `/api/admin/games_search?q=...` as the admin types (min 2 chars),
  render results, click-to-select, enable/populate the hidden link form,
  submit on confirm click.
- `admin_game_identify.css` gets a couple of small additions for the new
  panel/button states. We also add the (previously missing) `<link>` tag for
  this stylesheet to `admin_game_identify.html` — it existed on disk but was
  never wired into the template.

### Security

- Reuses the exact same `is_safe_path` / `get_allowed_base_directories`
  validation already used by `add_game_manual` and `library_tools.py` — no
  new path-validation logic.
- New search endpoint is admin-only and caps result count; query length is
  implicitly bounded by the `ilike` pattern (no unbounded regex).
- Link route only accepts POST and is CSRF-protected via the app's global
  `CSRFProtect`.

## Out of scope / follow-ups

- No changes to the existing IGDB-based add flow or `AddGameForm`.
- No bulk-linking UI.
- No fuzzy/typo-tolerant search (plain `ilike`), matching the simplicity of
  the existing `/api/search`.
