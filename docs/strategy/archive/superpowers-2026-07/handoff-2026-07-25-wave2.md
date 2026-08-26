# Handoff — 2026-07-25, member SPA rebrand + admin restyle

Read this first if you are picking up cold. It is written for a new agent
with no prior context.

> **Superseded for planning (2026-07-26).** Use the Jul 26 program board canvas
> instead of this handoff for priorities, gaps, and Admin SPA tracks:
> `C:\Users\cephyrix_zyth\.cursor\projects\c-Users-cephyrix-zyth-Desktop-gametheca\canvases\gametheca-program.canvas.tsx`
> Historical Wave 2A/2B detail below remains useful for theme/pipeline context.

## State

- Repo: `C:\Users\cephyrix_zyth\Desktop\gametheca`
- Branch: `feature/wave2-admin-fixes`, tip `96e39c3`
- Working tree: **clean**, no stashes
- **25 commits ahead of `origin/main`. Nothing has been pushed.** The user
  chose to keep everything local for now.
- Local `main` is behind the feature branch and can fast-forward.

## What the user originally asked for

Verbatim, after the discover-page 500 was fixed:

> "emnulators, arr, Quality, Layouts, ai, layouts, and possibly more, themes
> cannot be selected and/or applied. the ui contrast is very hard to read on
> some some ui portions. the background image should be changed and so should
> the fallback images. also seeing a double left hand nav again we should see
> how to remove and merge if any are not in the original lhn and lets change
> the icons to better ones with color that change per theme, scan depth canot
> be changed. The ui should be overhauled to look different from the prior fork's
> generic teal-glass chrome — it still looked too similar. Perhaps see about changing the lhn to on top.
> Sizing should be adujstable for all tiles"

Decisions the user made along the way: visual rebrand before bug-fixing;
hybrid modern-media-library aesthetic with arcade accents and subtle CRT;
single top bar with an overflow More menu; tile size as a global preference
plus a quick control on library pages; a React SPA for the member area with
Admin staying Jinja for now.

## What is done

**Wave 1 (merged to local `main`):** member SPA with top nav and no left
sidebar, GameTheca design tokens and art, `tile_size` preference, React
Downloads page, theme asset path fix, Docker builds `member-app`.

**Wave 2A — More-menu migration (`31afb04`).** All seven remaining
placeholder pages are now real React pages: Collections, Collection detail,
Wishlist, Ownership, Big Picture, VR, Trailers. This closed a live
regression — Flask already routed those paths to the SPA shell, so they had
been rendering a permanent "Loading…" placeholder. `MoreStubs.jsx` is gone.
Also exposed `is_librarian` on the SPA shell for wishlist moderation.

**Wave 2B — admin restyle**, five work packages:

- `994dd87` **theme pipeline.** Three stacked bugs. The nine presets on disk
  were generated before `gt-tokens.css` existed so they had no token file and
  fell back to the default orange accent; the installer skipped any preset
  that already had a `theme.json`, so a restart could never repair them; and
  only a fixed list of seven files was force-synced from the tracked theme
  source at boot, meaning **any** CSS edit to an admin sheet was invisible on
  a normal install. Presets now regenerate from a content fingerprint, each
  gets its own `gt-tokens.css` (verified 9 of 9 distinct accents), syncing is
  a whole-tree hash comparison covering presets, and source paths resolve
  from the package root instead of the CWD. Added `POST /admin/themes/apply`.
- `7422e0b` **unstyled admin pages.** New `css/admin/admin-pages.css`, a
  token-only shared page shell, adopted across 19 templates — the 12 with no
  stylesheet at all, the 5 whose `<link>` 404'd, and 2 borrowing the
  dashboard sheet. Also closed five pre-existing unbalanced `<div>` trees.
- `764d4ed` **theme picker.** The swatch grid had never worked: handlers were
  bound on `DOMContentLoaded` but the modal markup is fetched and injected
  later. Now delegated from `document`. Admin Manage Themes gained an Active
  Theme picker with live accent preview. Swatch colours corrected and pinned
  by a test reading `preset_tokens()`.
- `1e450ca` **nav + icons.** `/admin/settings` had a 220px sticky nav beside
  the member sidebar — the double left-hand nav. Replaced with a card grid
  where the whole card links straight to the page, and `?section=` now
  redirects instead of filtering. That two-click "Open X" step is why
  emulators / arr / quality / layouts / AI felt unselectable. Added
  `templates/partials/icons.html`, a Jinja SVG macro set mirroring the SPA's
  2px `currentColor` icons; converted 58 Font Awesome usages in `base.html`,
  the settings shell and the dashboard.
- `96e39c3` **contrast.** Every admin stylesheet is token-driven. Worst case
  `.status-value` in the globally-loaded `admin-components.css` went 2.35:1 →
  6.98:1; progress text 1.41:1 → 16.14:1. 26 pairs measured. Added
  `--gt-success/danger/warning/info`, deliberately **not** in
  `preset_tokens()` so a failure reads red in every theme. Removed the
  `!important` Bootstrap overrides leaking out of the Discord sheet. Deleted
  three orphan stylesheets and one dead partial.

## THE NEXT THING TO DO

**Nothing here has been verified against a real database or a browser.**
There is no Postgres and no Docker daemon on the dev machine. The DB-backed
route tests are written but have never run — that covers
`POST /admin/themes/apply`, the `?section=` redirect, and admin auth guards.
If something is broken, that is the most likely neighbourhood.

The user is deploying by SMB-copying to Unraid (they declined pushing). The
runbook is `docs/runbooks/unraid-deploy.md`. Instructions given:

```powershell
robocopy "C:\Users\cephyrix_zyth\Desktop\gametheca" "\\192.168.50.X\appdata\gametheca-build" /E /R:1 /W:1 /XD node_modules .git __pycache__ .venv .pytest_cache dist .worktrees /XF *.pyc
```

```bash
cd /mnt/user/appdata/gametheca-build && docker compose build --no-cache && docker compose up -d && docker compose logs -f
```

`--no-cache` matters: the Dockerfile runs `npm run build` and the seven new
React pages must land in the bundle. `/E` not `/MIR`, because mirroring would
delete the `.env` on the NAS.

What to check, in order: themes actually recolour everything (Ocean/Forest);
the preferences swatch grid responds to clicks; `/admin/settings` is a card
grid with one-click destinations; the seven new member pages render; scan
depth saves on library edit.

Expect a burst of log lines on first boot — the source fingerprint changed,
so all nine presets regenerate. That is the fix working.

## Known gaps and follow-ups (user deferred all of these)

- Member sidebar still renders on admin pages. It is currently the only
  navigation those ~40 Jinja pages have, so removing it before an admin top
  nav exists would strand admins. Suggested cheap step: emit `collapsed` on
  `#sidebar` and `#content` server-side for `/admin/*`.
- 244 Font Awesome usages remain across 40 unconverted admin templates. The
  CDN link is intentionally still in `base.html`.
- Collections backend is thin: no delete-collection or remove-item endpoint,
  no item counts in the list response, and adding a game needs a raw UUID
  because there is no picker endpoint.
- `init_manager.py` prints emoji; on a Windows cp1252 console this raises
  `UnicodeEncodeError` from inside `except` handlers and kills init. Invisible
  under Docker and with `PYTHONIOENCODING=utf-8`.
- `admin_newsletter.html` inits CKEditor against `#editor` but the textarea is
  `id="content"` — pre-existing, always threw.
- `admin_statistics.html` hardcodes two `<script>` paths under
  `library/themes/default/js/...`, bypassing `theme_asset`.
- `tests/test_utils_themes.py` has 4 Windows path-separator failures and one
  Postgres hang. Pre-existing.
- `admin_manage_downloads.css` is now orphaned (its template moved to
  `admin-pages.css`). Deletion candidate.
- Wave 2C, feature-flag / module UX, was never started.

## Working notes for the next agent

These cost real time to rediscover.

- **The IDE workspace root must be `gametheca`.** If Glob/Grep fail with a wrong path, ask the user to reopen the folder as `gametheca`, or fall back to `Shell` with `required_permissions: ["all"]` and an explicit `working_directory`, plus `Read` with absolute paths.
- **The shell is PowerShell.** Bash heredocs do not work. For commit messages, write the message to a file and use `git commit -F`.
- **Git identity is not configured** and must not be written. Prior commits used `git -c user.name="Cursor Agent" -c user.email="cursoragent@localhost" commit ...`. Match that.
- **pytest needs `TEST_DATABASE_URL` set** even for tests that never touch the database — the root `conftest.py` raises without it. Use
  `$env:TEST_DATABASE_URL='postgresql://postgres:postgres@localhost:5432/gametheca_test'`.
  DB-backed tests then hang ~120s in `create_app()`'s port retry loop before failing, so scope test runs to specific files.
- DB-free suite that passes today (108 tests): `test_preset_themes.py`,
  `test_init_manager_themes.py`, `test_theme_apply_registration.py`,
  `test_theme_token_contrast.py`, `test_template_icons.py`,
  `test_theme_picker_ui.py`, `test_preferences_modal_js.py`,
  `test_theme_asset.py`, `test_wave2_admin_fixes.py`.
- Frontend: `cd frontend/member-app; npm test -- --run` (87 pass) and
  `npm run build` (clean). Run the build too — vitest mocks hide broken
  imports.
- **Never edit `gametheca/static/library/themes/`.** It is gitignored runtime
  output. The tracked source is `gametheca/setup/default_theme/`.
- Per-preset token values live in `preset_tokens()` in
  `gametheca/utils/preset_themes.py`, not in CSS. A new themeable token needs
  adding there as well as to `gt-tokens.css`. Bump `GENERATOR_VERSION` when
  the generated output format changes.
- **Parallel agents work well here if they own disjoint file sets.** Five ran
  concurrently on the More pages and three on the admin packages with zero
  collisions, because shared files (`App.jsx`, `base.html`, `gt-tokens.css`)
  were assigned to exactly one owner and the controller did the wiring. Do
  not let two agents near the same file.
