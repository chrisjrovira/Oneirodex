# Plan: Find/Add MVP — Link Existing Library Game (Track 4)

Date: 2026-07-23
Branch: `feature/find-add-link-existing`
Design: `docs/superpowers/specs/2026-07-23-find-add-link-existing-design.md`

## Steps

1. Docs (this file + design doc) — commit first, `git add -f` (repo
   `.gitignore`s `*.md` except `README.md`).
2. Backend: admin games search API
   - `gametheca/routes_apis/admin_search.py`: `GET /api/admin/games_search?q=`
   - Register module import in `gametheca/routes_apis/__init__.py`.
3. Backend: link-existing-game route
   - `gametheca/routes_games_ext/add.py`: `POST /link_existing_game`
     (blueprint `games`), validates path, updates `Game.full_disk_path`,
     deletes matching `UnmatchedFolder`, flashes, redirects.
4. Backend: prefill enhancement
   - `add_game_manual` GET: prefill `form.igdb_id.data` from
     `request.args.get('igdb_id')` when present.
   - `library_tools.approve_proposal`: include `igdb_id` in `identify_hint`.
5. Frontend: template
   - `gametheca/templates/admin/admin_game_identify.html`: add missing CSS
     `<link>`, add "Link to Existing Library Game" panel + hidden form.
6. Frontend: JS
   - `gametheca/setup/default_theme/js/admin_game_identify.js`: search
     input handling, results rendering, selection state, submit wiring.
7. Frontend: CSS
   - `gametheca/setup/default_theme/css/admin/admin_game_identify.css`:
     small additions for new panel/button states.
8. Tests
   - `tests/test_routes_apis_admin_search.py` — search endpoint auth +
     filtering + result shape + limit.
   - Extend/add to `tests/test_routes_games_ext_add.py` (new file, mirrors
     existing `test_routes_games_ext_edit.py` style) — link route success,
     unsafe-path rejection, missing game, unmatched-folder cleanup, igdb_id
     prefill on GET.
   - Run `pytest` for the new/changed test files; DB (`TEST_DATABASE_URL`)
     may be unavailable in this sandbox — if so, note as blocked after
     confirming collection/imports are clean.
9. Manual verification notes (in final report): steps to exercise the UI by
   hand once a real Postgres + app server is available.
10. Commit implementation as a second commit (docs already committed
    separately per instructions).

## Non-goals

- No changes to `AddGameForm` / the existing IGDB add flow.
- No schema/migration changes (no new columns/tables needed).
