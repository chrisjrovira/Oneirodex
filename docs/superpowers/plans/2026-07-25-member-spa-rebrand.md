# Member SPA Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a React member SPA with top navigation, GameTheca visual identity (tokens, art, theme-tinted icons), and adjustable tile sizing for Discover / Library / Favorites / Downloads, while Admin stays Jinja.

**Architecture:** Evolve `frontend/library-grid` into `frontend/member-app` with React Router. Flask serves a thin SPA shell for member browse URLs and continues to own auth, APIs, admin, and static files. Same-origin session cookies + CSRF on mutating fetches.

**Tech Stack:** Flask, SQLAlchemy, Jinja shell, React 19, Vite, React Router, Vitest, existing `/browse_games` + `/api/*` endpoints.

**Spec:** `docs/superpowers/specs/2026-07-24-member-spa-rebrand-design.md`

## Global Constraints

- Primary top-bar links only: Discover · Library · Downloads · Favorites · Admin
- Member SPA pages must not render a left sidebar
- Visual lead: modern media library bones; arcade accents via `--gt-accent`; CRT only as subtle background/focus
- Default theme must not clone SharewareZ teal-glass chrome
- Tile sizes: `S | M | L | XL`, default `M`, one preference field shared by Preferences + on-page control
- Wave 1 does not fix admin `admin2.admin_dashboard`, scan depth, or Arr/AI/Quality/Layouts bugs (wave 2)
- Docker image must `npm run build` member-app into `/static/dist/member-app/`

---

## File map

| Path | Responsibility |
|------|----------------|
| `frontend/member-app/` (rename from `library-grid`) | Member SPA package |
| `frontend/member-app/src/App.jsx` | Router + layout outlet |
| `frontend/member-app/src/chrome/TopNav.jsx` | Top bar, More, account, mobile drawer |
| `frontend/member-app/src/chrome/navConfig.js` | Primary vs More membership (tested) |
| `frontend/member-app/src/chrome/icons.jsx` | Theme-tinted SVG icons |
| `frontend/member-app/src/chrome/TileSizeControl.jsx` | On-page S–XL control |
| `frontend/member-app/src/pages/DownloadsPage.jsx` | Downloads React UI |
| `frontend/member-app/src/api/preferences.js` | PATCH preferences (tile_size/theme) |
| `frontend/member-app/src/api/downloads.js` | List/poll/delete downloads |
| `frontend/member-app/src/utils/tileSize.js` | Map S–XL → CSS vars (tested) |
| `gametheca/templates/site/member_spa.html` | SPA shell (no sidebar) |
| `gametheca/static/library/themes/default/css/gt-tokens.css` | `--gt-*` tokens |
| `gametheca/static/newstyle/gt_bg.jpg` | New page background |
| `gametheca/static/newstyle/default_cover.jpg` | New cover fallback (replace) |
| `gametheca/static/newstyle/default_library.jpg` | New library fallback (replace) |
| `gametheca/models.py` | `UserPreference.tile_size` |
| `gametheca/updateschema.py` | `ADD COLUMN tile_size` |
| `gametheca/forms.py` | `tile_size` on `UserPreferencesForm` |
| `gametheca/routes_settings.py` | Persist `tile_size` |
| `gametheca/routes.py` | Fix `theme_asset_filter` app-root paths |
| `gametheca/routes_discover.py` / `routes_library.py` / `routes_site.py` / `routes_downloads_ext/user.py` | Serve SPA shell |
| `gametheca/routes_apis/download.py` | `GET /api/my_downloads` JSON |
| `Dockerfile` | Build `frontend/member-app` → `static/dist/member-app` |
| `entrypoint.sh` | Warn if `member-app.js` missing |

---

### Task 1: Fix `theme_asset` path resolution

**Files:**
- Modify: `gametheca/routes.py` (theme_asset_filter ~L1115–1132)
- Test: `tests/test_theme_asset.py` (create)

**Interfaces:**
- Consumes: Flask `url_for`, `g`/`session` current theme injection already used by filter
- Produces: `theme_asset_filter(path: str) -> str` that checks files under app static root, not CWD

- [ ] **Step 1: Write the failing test**

```python
# tests/test_theme_asset.py
import os
from pathlib import Path

def test_theme_asset_finds_file_when_cwd_is_not_repo_root(app, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)  # CWD is empty — old logic would always miss
    with app.app_context():
        from gametheca.routes import theme_asset_filter
        # default theme base.css must exist in the app tree
        url = theme_asset_filter('css/base.css')
        assert 'library/themes/' in url
        assert url.endswith('css/base.css') or 'base.css' in url
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_theme_asset.py::test_theme_asset_finds_file_when_cwd_is_not_repo_root -v`  
Expected: FAIL (exists check relative to CWD returns False → still may return default URL; assert against wrong theme or force a non-default theme if fixtures allow). If the test passes accidentally because default fallback still ends with `base.css`, change the assertion to require the themed path when `g.current_theme` / preference is a preset folder that exists on disk.

- [ ] **Step 3: Write minimal implementation**

Replace the CWD-relative check in `theme_asset_filter` with:

```python
@bp.app_template_filter('theme_asset')
def theme_asset_filter(path):
    from flask import current_app, g, url_for
    current_theme = getattr(g, 'current_theme', None) or 'default'
    if current_theme == 'default' or not current_theme:
        # keep existing preference lookup if that is how the filter works today
        pass
    static_root = Path(current_app.root_path) / 'static' / 'library' / 'themes'
    themed = static_root / current_theme / path
    if themed.is_file():
        return url_for('static', filename=f'library/themes/{current_theme}/{path}')
    return url_for('static', filename=f'library/themes/default/{path}')
```

Match the file’s existing theme-resolution variables exactly — only change how `exists` is computed (use `Path(current_app.root_path) / 'static' / ...`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_theme_asset.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add gametheca/routes.py tests/test_theme_asset.py
git commit -m "fix: resolve theme assets from app root instead of CWD"
```

---

### Task 2: Add `tile_size` preference (backend)

**Files:**
- Modify: `gametheca/models.py` (`UserPreference` ~L607–622)
- Modify: `gametheca/updateschema.py` (near locale alter ~L534)
- Modify: `gametheca/forms.py` (`UserPreferencesForm`)
- Modify: `gametheca/routes_settings.py` (`settings_panel` save ~L191–194)
- Modify: `gametheca/templates/settings/modal_preferences.html`
- Test: `tests/test_user_preferences_tile_size.py` (create)

**Interfaces:**
- Consumes: existing `settings_panel` POST JSON flow
- Produces: `UserPreference.tile_size: str` with values `S|M|L|XL`, default `M`; saved via preferences form

- [ ] **Step 1: Write the failing test**

```python
# tests/test_user_preferences_tile_size.py
def test_settings_panel_persists_tile_size(auth_client, user_with_prefs):
    resp = auth_client.post('/settings_panel', data={
        'items_per_page': '20',
        'default_sort': 'name',
        'default_sort_order': 'asc',
        'theme': 'default',
        'tile_size': 'L',
        'csrf_token': '...',  # use test helper / disable CSRF in fixture as other settings tests do
    }, headers={'X-Requested-With': 'XMLHttpRequest'})
    assert resp.status_code in (200, 302)
    assert user_with_prefs.preferences.tile_size == 'L'
```

Adapt to whatever fixture pattern `tests/test_*.py` already uses for authenticated POSTs (copy CSRF handling from an existing settings test if present).

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_user_preferences_tile_size.py -v`  
Expected: FAIL (no `tile_size` field / attribute)

- [ ] **Step 3: Implement model, migration, form, route, modal field**

```python
# models.py — add on UserPreference
tile_size = db.Column(db.String(4), default='M', nullable=False)
```

```sql
-- updateschema.py inside existing alter blob
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS tile_size VARCHAR(4) DEFAULT 'M';
```

```python
# forms.py — on UserPreferencesForm
tile_size = SelectField(
    'Tile size',
    choices=[('S', 'S'), ('M', 'M'), ('L', 'L'), ('XL', 'XL')],
    default='M',
)
```

```python
# routes_settings.py — alongside other preference assigns
current_user.preferences.tile_size = form.tile_size.data or 'M'
```

Add a select (or radio group) named `tile_size` in `modal_preferences.html` next to theme.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_user_preferences_tile_size.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add gametheca/models.py gametheca/updateschema.py gametheca/forms.py gametheca/routes_settings.py gametheca/templates/settings/modal_preferences.html tests/test_user_preferences_tile_size.py
git commit -m "feat: add tile_size user preference"
```

---

### Task 3: Rename package to `member-app` and add React Router scaffold

**Files:**
- Rename dir: `frontend/library-grid/` → `frontend/member-app/`
- Modify: `frontend/member-app/package.json` (name `member-app`)
- Modify: `frontend/member-app/vite.config.js` (base/outDir/entry names)
- Create: `frontend/member-app/src/App.jsx`
- Modify: `frontend/member-app/src/main.jsx`
- Modify: `Dockerfile`, `entrypoint.sh` (paths `library-grid` → `member-app`)
- Test: `frontend/member-app/src/App.test.jsx`

**Interfaces:**
- Consumes: existing `LibraryApp`, `DiscoverApp`, `FavoritesApp`
- Produces: `App` with routes `/discover`, `/library`, `/favorites`, `/downloads`; build emits `member-app.js`

- [ ] **Step 1: Write the failing router test**

```jsx
// frontend/member-app/src/App.test.jsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { App } from './App'

vi.mock('./LibraryApp', () => ({ LibraryApp: () => <div>LibraryPage</div> }))
vi.mock('./DiscoverApp', () => ({ DiscoverApp: () => <div>DiscoverPage</div> }))
vi.mock('./FavoritesApp', () => ({ FavoritesApp: () => <div>FavoritesPage</div> }))
vi.mock('./pages/DownloadsPage', () => ({ DownloadsPage: () => <div>DownloadsPage</div> }))
vi.mock('./chrome/TopNav', () => ({ TopNav: () => <nav>TopNav</nav> }))

test('renders library route', () => {
  render(
    <MemoryRouter initialEntries={['/library']}>
      <App shellConfig={{ tileSize: 'M', isAdmin: false }} />
    </MemoryRouter>,
  )
  expect(screen.getByText('LibraryPage')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend/member-app && npm test -- --run src/App.test.jsx`  
Expected: FAIL (module/path missing until rename + App exist)

- [ ] **Step 3: Rename and implement scaffold**

1. `git mv frontend/library-grid frontend/member-app`
2. Update `package.json` `"name": "member-app"`
3. Update `vite.config.js`:

```js
base: '/static/dist/member-app/',
build: {
  outDir: path.resolve(__dirname, '../../gametheca/static/dist/member-app'),
  emptyOutDir: true,
  rollupOptions: {
    input: path.resolve(__dirname, 'index.html'),
    output: {
      entryFileNames: 'member-app.js',
      assetFileNames: 'member-app.[ext]',
    },
  },
},
```

4. Add `react-router-dom` dependency: `npm install react-router-dom`
5. Create `App.jsx` with `Routes`/`Route` for the four pages inside a layout that renders `TopNav` (stub TopNav returning `<nav />` until Task 5).
6. Change `main.jsx` to mount `#member-app-root` with `BrowserRouter` + `App`, reading shell config from `data-*` attributes. Keep mounting `#game-details-react-root` with `GameDetailsApp` for Jinja game details pages.
7. Update Dockerfile frontend-build stage and COPY paths from `library-grid` to `member-app`.
8. Update `entrypoint.sh` missing-bundle warning to `member-app.js`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend/member-app && npm test -- --run src/App.test.jsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A frontend/member-app Dockerfile entrypoint.sh
git commit -m "refactor: rename library-grid to member-app and add router shell"
```

---

### Task 4: Nav config + TopNav chrome

**Files:**
- Create: `frontend/member-app/src/chrome/navConfig.js`
- Create: `frontend/member-app/src/chrome/navConfig.test.js`
- Create: `frontend/member-app/src/chrome/TopNav.jsx`
- Create: `frontend/member-app/src/chrome/TopNav.test.jsx`
- Create: `frontend/member-app/src/chrome/icons.jsx`

**Interfaces:**
- Consumes: `shellConfig` `{ isAdmin, showTrailers, showHelp, enableVr, username }`
- Produces: `getPrimaryLinks()`, `getMoreLinks(flags)`, `TopNav` component

- [ ] **Step 1: Write failing navConfig tests**

```js
// frontend/member-app/src/chrome/navConfig.test.js
import { getPrimaryLinks, getMoreLinks } from './navConfig'

test('primary links are locked set', () => {
  expect(getPrimaryLinks().map((l) => l.id)).toEqual([
    'discover', 'library', 'downloads', 'favorites', 'admin',
  ])
})

test('more links exclude primary ids', () => {
  const more = getMoreLinks({ showTrailers: true, showHelp: true, enableVr: true })
  const ids = more.map((l) => l.id)
  expect(ids).not.toContain('discover')
  expect(ids).toContain('collections')
  expect(ids).toContain('vr')
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd frontend/member-app && npm test -- --run src/chrome/navConfig.test.js`

- [ ] **Step 3: Implement navConfig + icons + TopNav**

```js
// navConfig.js
export function getPrimaryLinks() {
  return [
    { id: 'discover', to: '/discover', label: 'Discover' },
    { id: 'library', to: '/library', label: 'Library' },
    { id: 'downloads', to: '/downloads', label: 'Downloads' },
    { id: 'favorites', to: '/favorites', label: 'Favorites' },
    { id: 'admin', href: '/admin/dashboard', label: 'Admin', external: true },
  ]
}

export function getMoreLinks({ showTrailers, showHelp, enableVr }) {
  const links = [
    { id: 'collections', href: '/collections', label: 'Collections' },
    { id: 'news', href: '/news', label: 'News' },
    { id: 'wishlist', href: '/wishlist', label: 'Wishlist' },
    { id: 'updates', href: '/updates', label: 'Updates' },
    { id: 'playtime', href: '/playtime', label: 'Playtime' },
    { id: 'calendar', href: '/calendar', label: 'Release calendar' },
    { id: 'ownership', href: '/ownership', label: 'Ownership' },
    { id: 'big-picture', href: '/big-picture', label: 'Big Picture' },
  ]
  if (enableVr) links.push({ id: 'vr', href: '/vr', label: 'VR' })
  if (showTrailers) links.push({ id: 'trailers', href: '/trailers', label: 'Trailers' })
  if (showHelp) links.push({ id: 'help', href: '/help', label: 'Help' })
  return links
}
```

Verify real Flask paths for collections/news/etc. match `base.html` `url_for` targets and adjust `href`s to those exact paths.

`TopNav.jsx`: sticky header, wordmark “GameTheca”, `NavLink` for in-SPA routes, `<a>` for Admin and More targets, account menu links to existing profile/preferences/password/logout URLs, hamburger under 768px. Icons from `icons.jsx` use `currentColor` and CSS class `gt-icon` colored with `var(--gt-accent)`.

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd frontend/member-app && npm test -- --run src/chrome/`

- [ ] **Step 5: Commit**

```bash
git add frontend/member-app/src/chrome
git commit -m "feat: add GameTheca top nav with primary and More links"
```

---

### Task 5: Design tokens, typography, art assets

**Files:**
- Create: `gametheca/static/library/themes/default/css/gt-tokens.css`
- Modify: `gametheca/setup/default_theme/css/base.css` (and ensure runtime default theme gets tokens via install/reset path)
- Modify: `gametheca/static/library/themes/default/css/base.css` to `@import` or link tokens; set body background to new art; raise text contrast
- Replace: `gametheca/static/newstyle/gt_bg.jpg` (new), overwrite `default_cover.jpg` / `default_library.jpg` (keep backups as `*.sharewarez.bak` only if needed locally — do not commit bak files)
- Update preset themes’ `base.css` accent mappings to also set `--gt-accent` from their primary

**Interfaces:**
- Produces: CSS variables listed in the spec (`--gt-bg`, `--gt-surface`, `--gt-text`, `--gt-accent`, `--gt-tile-min`, `--gt-crt-opacity`, …)

- [ ] **Step 1: Add token file with non-teal default palette**

```css
/* gt-tokens.css */
:root {
  --gt-bg: #0b0d10;
  --gt-surface: #141820;
  --gt-surface-2: #1c2230;
  --gt-text: #f2f4f8;
  --gt-text-muted: #b6becc;
  --gt-accent: #ff5a36; /* arcade accent — not SharewareZ teal */
  --gt-accent-contrast: #0b0d10;
  --gt-border: rgba(255, 255, 255, 0.12);
  --gt-focus-ring: color-mix(in srgb, var(--gt-accent) 70%, white);
  --gt-tile-min: 180px;
  --gt-crt-opacity: 0.03;
  --font-ui: "Sora", "Segoe UI", sans-serif;
  --font-display: "Archivo Black", "Arial Black", sans-serif;
}
```

Load fonts via `@import` from a self-hosted folder under `static/newstyle/fonts/` or theme `css/` (prefer self-host; do not rely on Google Fonts if offline NAS is a requirement — if self-hosting is too heavy, use bundled WOFF already in repo or system faces with distinctive `font-family` stack documented in PR).

- [ ] **Step 2: Wire tokens into default `base.css` body**

Set `body` background to `/static/newstyle/gt_bg.jpg` with dark overlay; text color `var(--gt-text)`; add a `body::after` CRT noise layer using `opacity: var(--gt-crt-opacity)`.

- [ ] **Step 3: Create replacement images**

Generate or paint:
- `gt_bg.jpg` — abstract dark media-library + soft arcade geometry
- `default_cover.jpg` — branded placeholder cover
- `default_library.jpg` — branded library placeholder  

Use the image generation tool or a checked-in SVG→raster pipeline. Update any CSS still pointing at `gamecontroller.jpg` for body background to `gt_bg.jpg`.

- [ ] **Step 4: Map preset `--btn-primary` to `--gt-accent`**

In each preset `base.css` (or shared snippet), add `--gt-accent: var(--btn-primary);` so existing preset recolors tint SPA icons.

- [ ] **Step 5: Commit**

```bash
git add gametheca/static/library/themes gametheca/setup/default_theme gametheca/static/newstyle
git commit -m "feat: add GameTheca design tokens and replacement art"
```

---

### Task 6: SPA shell template + Flask route wiring

**Files:**
- Create: `gametheca/templates/site/member_spa.html`
- Modify: `gametheca/routes_discover.py` (`discover`)
- Modify: `gametheca/routes_library.py` (`library`)
- Modify: `gametheca/routes_site.py` (`favorites`)
- Modify: `gametheca/routes_downloads_ext/user.py` (`downloads`)
- Keep game details Jinja as-is (still may load member-app for details island)

**Interfaces:**
- Produces: shell HTML with `#member-app-root` and `data-*` config: `tile-size`, `is-admin`, `show-trailers`, `show-help`, `enable-vr`, `locale`, CSRF meta, theme CSS links via `theme_asset`

- [ ] **Step 1: Create shell template (no `#sidebar`)**

```html
{# gametheca/templates/site/member_spa.html #}
{% extends "base_empty.html" %}
{# If base_empty.html does not exist, create a minimal base: doctype, head assets, no sidebar #}
{% block content %}
<div
  id="member-app-root"
  data-tile-size="{{ current_user.preferences.tile_size or 'M' }}"
  data-is-admin="{{ 'true' if current_user.role == 'admin' else 'false' }}"
  data-show-trailers="{{ 'true' if show_trailers else 'false' }}"
  data-show-help="{{ 'true' if show_help_button else 'false' }}"
  data-enable-vr="{{ 'true' if enable_vr_browse else 'false' }}"
  data-locale="{{ current_user.preferences.locale or 'en' }}"
  data-per-page="{{ current_user.preferences.items_per_page or 20 }}"
  data-default-sort="{{ current_user.preferences.default_sort or 'name' }}"
  data-default-sort-order="{{ current_user.preferences.default_sort_order or 'asc' }}"
></div>
<script type="module" src="{{ url_for('static', filename='dist/member-app/member-app.js') }}"></script>
{% endblock %}
```

Create `base_empty.html` by copying `base.html` head (CSRF meta, theme CSS including `gt-tokens.css`, flash container) **without** `#sidebar`. Do not include `library_filters.html` in the shell — Library page owns filters in React.

- [ ] **Step 2: Point the four view functions at the shell**

Each of `discover`, `library`, `favorites`, `downloads` should `return render_template('site/member_spa.html', ...)` with the flags processors already expose. Preserve `@login_required`. Discover’s old server-side section building can move behind a JSON endpoint if `DiscoverApp` still needs `data-sections`; options:

1. Add `GET /api/discover_sections` returning the same payload `DiscoverApp` expects, or
2. Embed sections JSON in `data-sections` on the shell when path is discover only.

Prefer (1) if sections query is heavy; otherwise embed on shell only for discover by branching in the route before render.

- [ ] **Step 3: Manual smoke (dev)**

Run app, open `/library` — expect top nav (even stub), no left sidebar, React mount, no 404 on `member-app.js` (run `npm run build` first).

- [ ] **Step 4: Commit**

```bash
git add gametheca/templates/site/member_spa.html gametheca/templates/base_empty.html gametheca/routes_discover.py gametheca/routes_library.py gametheca/routes_site.py gametheca/routes_downloads_ext/user.py
git commit -m "feat: serve member SPA shell for browse routes"
```

---

### Task 7: Wire Discover / Library / Favorites into router + tile CSS vars

**Files:**
- Create: `frontend/member-app/src/utils/tileSize.js`
- Create: `frontend/member-app/src/utils/tileSize.test.js`
- Modify: `frontend/member-app/src/App.jsx`, `LibraryApp.jsx`, `DiscoverApp.jsx`, `FavoritesApp.jsx`, `components/GameGrid.jsx` / CSS
- Create: `frontend/member-app/src/chrome/TileSizeControl.jsx`
- Create: `frontend/member-app/src/api/preferences.js`

**Interfaces:**
- Produces: `tileSizeToCssVars(size) -> { '--gt-tile-min': string }`; `saveTileSize(size)` POST/PATCH to `/settings_panel`

- [ ] **Step 1: Failing tileSize unit test**

```js
import { tileSizeToCssVars } from './tileSize'
test('maps sizes', () => {
  expect(tileSizeToCssVars('S')['--gt-tile-min']).toBe('140px')
  expect(tileSizeToCssVars('M')['--gt-tile-min']).toBe('180px')
  expect(tileSizeToCssVars('L')['--gt-tile-min']).toBe('220px')
  expect(tileSizeToCssVars('XL')['--gt-tile-min']).toBe('280px')
})
```

- [ ] **Step 2: Run — expect FAIL, then implement `tileSize.js`**

- [ ] **Step 3: Apply CSS vars on layout**

In `App.jsx`, read `shellConfig.tileSize`, set `document.documentElement.style` from `tileSizeToCssVars`. `GameGrid` / card CSS uses `minmax(var(--gt-tile-min), 1fr)`.

- [ ] **Step 4: TileSizeControl**

Segmented control S–XL; on change call:

```js
// api/preferences.js
export async function savePreferences(partial) {
  const csrf = document.querySelector('meta[name="csrf-token"]')?.content
  const body = new FormData()
  // include required fields from shellConfig defaults + partial.tile_size
  Object.entries(partial).forEach(([k, v]) => body.append(k, v))
  const res = await fetch('/settings_panel', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'X-CSRFToken': csrf, 'X-Requested-With': 'XMLHttpRequest' },
    body,
  })
  if (!res.ok) throw new Error('prefs save failed')
  return res.json().catch(() => ({}))
}
```

Place control in TopNav toolbar area and on Library/Discover/Favorites headers.

- [ ] **Step 5: Run vitest for tileSize + App routes; commit**

```bash
cd frontend/member-app && npm test -- --run
git add frontend/member-app
git commit -m "feat: wire SPA pages and adjustable tile sizing"
```

---

### Task 8: Downloads JSON API + Downloads React page

**Files:**
- Modify: `gametheca/routes_apis/download.py` (add list endpoint)
- Create: `frontend/member-app/src/api/downloads.js`
- Create: `frontend/member-app/src/pages/DownloadsPage.jsx`
- Create: `frontend/member-app/src/pages/DownloadsPage.test.jsx`
- Test: `tests/test_api_my_downloads.py`

**Interfaces:**
- Produces: `GET /api/my_downloads` → `[{ id, game_name, status, file_name, download_url? }]`
- Produces: `DownloadsPage` polling `GET /check_download_status/<id>` every 5s for non-terminal rows

- [ ] **Step 1: Failing API test**

```python
def test_my_downloads_requires_login(client):
    assert client.get('/api/my_downloads').status_code in (401, 302)

def test_my_downloads_lists_current_user_requests(auth_client, download_request_factory):
    download_request_factory(status='pending')
    data = auth_client.get('/api/my_downloads').get_json()
    assert isinstance(data, list)
    assert data[0]['id']
```

- [ ] **Step 2: Implement endpoint** using `DownloadRequest` model filtered by `current_user.id`, serialize fields needed by the UI. Reuse delete via existing `DELETE /api/delete_download/<id>` or form-compatible route with CSRF.

- [ ] **Step 3: Implement `DownloadsPage`** with empty state, error+retry, and status polling matching prior `downloads_manager.js` behavior.

- [ ] **Step 4: Tests pass + commit**

```bash
pytest tests/test_api_my_downloads.py -v
cd frontend/member-app && npm test -- --run src/pages/DownloadsPage.test.jsx
git add gametheca/routes_apis/download.py tests/test_api_my_downloads.py frontend/member-app
git commit -m "feat: React downloads page with my_downloads API"
```

---

### Task 9: Discover sections API (if not embedded)

**Files:**
- Modify: `gametheca/routes_discover.py` or `gametheca/routes_apis/` — add `GET /api/discover` JSON used by `DiscoverApp`
- Modify: `frontend/member-app/src/DiscoverApp.jsx` to fetch if `sections` not provided

Only do this task if Task 6 did not embed `data-sections`. Keep response shape identical to today’s `data-sections` JSON.

- [ ] Implement + unit/API test + commit: `feat: expose discover sections JSON for SPA`

---

### Task 10: Polish contrast on SPA chrome + remove dead island templates

**Files:**
- Modify: SPA-related CSS under default theme (`components.css` card text, TopNav CSS module or `gt-chrome.css`)
- Simplify: `games/library_browser.html`, `games/discover.html`, `games/favorites.html`, `games/manage_downloads.html` — either delete unused islands or leave redirects; prefer routes already return `member_spa.html` so old templates can remain unused or become thin redirects
- Grep for `library-grid` / `library-grid-root` and update remaining references

- [ ] Raise opacity on any remaining glass panels used by SPA overlays; ensure `--gt-text-muted` stays ≥ AA on `--gt-surface`
- [ ] Grep clean + commit: `chore: finish SPA chrome contrast and remove stale grid mounts`

---

### Task 11: Docker verify + docs touch

**Files:**
- Modify: `Dockerfile` (already updated in Task 3 — verify)
- Modify: `CHANGELOG.md` (short wave-1 note)
- Modify: `NAS-DEPLOY.md` if it mentions `library-grid.js`

- [ ] **Step 1:** `docker build` locally or CI-equivalent: confirm `/app/gametheca/static/dist/member-app/member-app.js` exists in image
- [ ] **Step 2:** Commit docs: `docs: note member SPA rebrand in changelog and NAS deploy`

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Theme asset CWD fix | 1 |
| Tile size preference | 2, 7 |
| Member-app + React Router | 3 |
| Top bar + More + icons | 4 |
| Tokens, art, CRT subtle, non-teal default | 5 |
| SPA shell, no LHN | 6 |
| Discover/Library/Favorites React | 6–7 |
| Downloads React | 8 |
| Theme-tinted icons | 4–5 |
| Docker build member-app | 3, 11 |
| Wave 2 exclusions respected | (no tasks for admin2/scan depth/arr) |

## Placeholder / consistency self-review

- No TBD left; Downloads path is `/downloads`; Admin href `/admin/dashboard` (`site.admin_dashboard`) — confirm exact path in codebase during Task 4 and adjust if dashboard URL differs.
- `tile_size` values consistently `S|M|L|XL`.
- Bundle name consistently `member-app.js` / `/static/dist/member-app/`.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-25-member-spa-rebrand.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with executing-plans checkpoints  

Which approach?
