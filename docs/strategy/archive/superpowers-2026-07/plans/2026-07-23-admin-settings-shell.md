# Admin Settings Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an Admin Settings shell at `/admin/settings` that groups Server
Settings, Attract Mode, Integrations, and Themes behind a left nav + card hub,
with `?section=` deep-linking, without rewriting any of the underlying forms.

**Architecture:** Reuse the existing `admin2.settings` view
(`gametheca/routes_admin_ext/settings.py`). GET renders a new Jinja shell
template instead of redirecting to Server Settings; POST is untouched. A
single `SETTINGS_SHELL_SECTIONS` dict is the source of truth for nav labels,
icons, descriptions, and target endpoints. Dashboard buttons and three legacy
standalone integration pages get small, additive updates only.

**Tech Stack:** Flask, Jinja2, existing admin glass CSS tokens — no new
frontend build, no DB migration.

**Spec:** `docs/superpowers/specs/2026-07-23-admin-settings-shell-design.md`

## Global Constraints

- Product order locked: pagination ✓ → ops glance ✓ → rename ✓ → find/add ✓ →
  **settings (this plan)** — do not start work outside this track here.
- Do not rewrite `new_server_settings`, `attract_mode_settings_page`,
  `integrations`, or `manage_themes` — deep-link to them, don't merge them.
- Do not change the POST save/test behavior of `/admin/settings`,
  `/admin/smtp_settings`, `/admin/igdb_settings`, `/admin/discord_settings`,
  `/admin/smtp_test`, `/admin/test_igdb`, `/admin/test_discord_webhook` — all
  are live backends consumed by `integrations.html`'s tabs.
- Do not touch the user-facing `settings_panel` or any user (non-admin)
  settings routes/templates.
- `*.md` is gitignored — use `git add -f` for plan/spec; set author via env
  (`GIT_AUTHOR_NAME`/`GIT_AUTHOR_EMAIL`) since local git config has no
  identity.
- No unrelated dirty files get staged or committed (this sandbox has
  pre-existing unrelated modified/untracked files from other tracks — leave
  them alone).
- Do not push.

## File Map

| File | Responsibility |
|------|-----------------|
| `gametheca/routes_admin_ext/settings.py` | `SETTINGS_SHELL_SECTIONS`, `DEFAULT_SETTINGS_SHELL_SECTION`, updated `settings()` GET branch |
| `gametheca/templates/admin/admin_settings_shell.html` | Left nav + active card + card grid |
| `gametheca/setup/default_theme/css/admin/admin_settings_shell.css` | Shell layout styling |
| `gametheca/templates/admin/admin_dashboard.html` | 4 buttons repointed to `/admin/settings?section=...` |
| `gametheca/templates/admin/admin_manage_smtp_settings.html` | Soft-deprecation banner |
| `gametheca/templates/admin/admin_manage_igdb_settings.html` | Soft-deprecation banner |
| `gametheca/templates/admin/admin_manage_discord_settings.html` | Soft-deprecation banner |
| `tests/test_routes_admin_ext_settings_shell.py` | Route/auth/section behavior tests |

---

### Task 1: Section registry + shell route

**Files:**
- Modify: `gametheca/routes_admin_ext/settings.py`

**Interfaces:**
- Produces: `SETTINGS_SHELL_SECTIONS: dict[str, dict]`,
  `DEFAULT_SETTINGS_SHELL_SECTION: str`
- `settings()` GET renders `admin/admin_settings_shell.html` with
  `sections=SETTINGS_SHELL_SECTIONS, active_section=<validated key>`

- [x] **Step 1: Add the section registry** above `FIELD_MAPPINGS`, keyed
  `server`, `attract`, `integrations`, `themes` (in nav order), each with
  `label`, `icon` (FA class), `description`, `endpoint` (existing view
  endpoint name).
- [x] **Step 2: Update the `settings()` view's GET branch** to read
  `request.args.get('section', DEFAULT_SETTINGS_SHELL_SECTION)`, fall back to
  the default when not a known key, and render the new template. Remove the
  now-unused inline `from flask import redirect, url_for` (redirect is no
  longer needed on GET).
- [x] **Step 3: Commit**

```bash
git add gametheca/routes_admin_ext/settings.py
git commit -m "feat: add settings shell hub route with section deep-links"
```

---

### Task 2: Shell template + CSS

**Files:**
- Create: `gametheca/templates/admin/admin_settings_shell.html`
- Create: `gametheca/setup/default_theme/css/admin/admin_settings_shell.css`

**Interfaces:**
- Consumes: `sections`, `active_section` from the view
- Renders: left nav (`ul` of `section` links with `?section=key`), an active
  section detail card with an "Open <label>" button, and a card grid of all
  4 sections — every deep link uses `url_for(section.endpoint)`

- [x] **Step 1: Template** — extends `base.html`; Back-to-Dashboard link;
  nav highlights `active` via `key == active_section`; cards loop over
  `sections.items()`.
- [x] **Step 2: CSS** — grid layout (`220px` nav + flexible main), reuse
  `--container-glass-*`, `--border-light`, `--primary-brand-*`,
  `--spacing-*`, `--border-radius-*`, `--shadow-glass`, `--btn-primary`
  tokens already used by `admin_dashboard.css` / `admin_ops.css`; mobile
  breakpoint collapses nav to a horizontal row.
- [x] **Step 3: Commit**

```bash
git add gametheca/templates/admin/admin_settings_shell.html gametheca/setup/default_theme/css/admin/admin_settings_shell.css
git commit -m "feat: add admin settings shell template and styling"
```

---

### Task 3: Dashboard buttons repointed

**Files:**
- Modify: `gametheca/templates/admin/admin_dashboard.html`

- [x] **Step 1:** Change the Server Settings, Attract Mode, and Integrations
  buttons (Server Management section) and the Themes button (Admin Tools
  section) to `url_for('admin2.settings', section='server'|'attract'|'integrations'|'themes')`.
- [x] **Step 2: Commit**

```bash
git add gametheca/templates/admin/admin_dashboard.html
git commit -m "feat: route dashboard settings buttons through settings shell"
```

---

### Task 4: Soft-deprecate standalone integration pages

**Files:**
- Modify: `gametheca/templates/admin/admin_manage_smtp_settings.html`
- Modify: `gametheca/templates/admin/admin_manage_igdb_settings.html`
- Modify: `gametheca/templates/admin/admin_manage_discord_settings.html`

**Constraint:** GET must keep returning 200 with existing content (covered
by `tests/test_routes_smtp.py`, `tests/test_routes_admin_ext_igdb.py`,
`tests/test_routes_admin_ext_discord.py`); POST save/test flows are the live
backends for `integrations.html` tabs and must not change. Only add a static
`alert alert-info` banner linking to `admin2.integrations` — no route logic
changes.

- [x] **Step 1:** Add banner to each of the 3 templates, just inside the
  `container-settings`/card wrapper, above the existing form/heading.
- [x] **Step 2: Commit**

```bash
git add gametheca/templates/admin/admin_manage_smtp_settings.html gametheca/templates/admin/admin_manage_igdb_settings.html gametheca/templates/admin/admin_manage_discord_settings.html
git commit -m "chore: point standalone integration pages at the Integrations hub"
```

---

### Task 5: Tests

**Files:**
- Create: `tests/test_routes_admin_ext_settings_shell.py`

- [x] **Step 1: Write tests** covering: section registry shape/order/default;
  every section endpoint resolves via `url_for`; login/admin guards on
  `GET /admin/settings`; default section renders all 4 labels;
  `?section=attract` highlights Attract Mode; invalid `?section=` falls back
  to `server`; cards deep-link to the real admin URLs; `POST /admin/settings`
  still saves settings.
- [x] **Step 2: Attempt run** — `python -m pytest tests/test_routes_admin_ext_settings_shell.py -v`.
  In this sandbox Postgres is unreachable (`TEST_DATABASE_URL` at
  `localhost:5432`, Docker Desktop not running) so the DB-backed fixtures
  hang; bound the attempt with a timeout job and fall back to static checks
  (Python `ast.parse` on the route module; `jinja2.Environment.parse` on
  every modified/created template) — both passed. Re-run the full suite once
  Postgres is reachable.
- [x] **Step 3: Commit**

```bash
git add tests/test_routes_admin_ext_settings_shell.py
git commit -m "test: add settings shell route coverage"
```

---

### Task 6: Final verification + docs

**Files:**
- Create: `docs/superpowers/specs/2026-07-23-admin-settings-shell-design.md`
- Create: `docs/superpowers/plans/2026-07-23-admin-settings-shell.md` (this file)

- [x] **Step 1: Spec coverage checklist** — confirm each exists: shell route,
  left nav + `?section=`, card deep-links, dashboard repoint, standalone-page
  banners, tests, docs.
- [x] **Step 2: Commit docs with `-f`**

```bash
git add -f docs/superpowers/specs/2026-07-23-admin-settings-shell-design.md docs/superpowers/plans/2026-07-23-admin-settings-shell.md
git commit -m "docs: add settings shell spec and implementation plan"
```

---

## Spec coverage (self-review)

| Spec item | Task |
|-----------|------|
| `/admin/settings` shell route | 1 |
| Left nav of 4 sections | 2 |
| `?section=` deep-link + highlight | 1–2 |
| Card hub with deep links (no iframe) | 2 |
| Dashboard buttons repointed | 3 |
| Soft-deprecate SMTP/IGDB/Discord pages | 4 |
| Existing forms/POST endpoints untouched | 1, 4 |
| User `settings_panel` untouched | n/a (not modified anywhere in this plan) |
| Tests | 5 |
| Spec + plan docs | 6 |

## Placeholder scan

No TBD/TODO steps; commands and code included per task.
