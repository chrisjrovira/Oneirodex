# Library React Grid Island Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Library SSR/AJAX dual card markup with a React+Vite island so pagination and filters never drift, then remount the same components on Favorites and Discover.

**Architecture:** Flask keeps sidebar/chrome shells. A Vite React app (`frontend/library-grid/`) builds hashed assets into `sharewarez/static/dist/library-grid/`. Track 1a mounts on Library (`#library-grid-root`). Track 1b remounts `GameCard`/`GameGrid` on Favorites and Discover. Browse JSON is the single data source; cover URLs become app-rooted static paths.

**Tech Stack:** React 18, Vite, Vitest + Testing Library, Flask, existing `/browse_games` + filter/favorite/status APIs, existing theme CSS variables

**Spec:** `docs/superpowers/specs/2026-07-22-library-react-grid-design.md`

## Global Constraints

- Product order locked: pagination (this plan) → ops glance → rename → find/add → settings — do not start later tracks here
- Track 1a = Library only; Track 1b = Favorites + Discover using the **same** card/grid package
- Hybrid islands — no full-app client router in this plan
- No secrets in the JS bundle; mount config via `data-*` attributes
- Reuse existing dark glass CSS variables; do not invent a parallel design system
- Preserve filter cookie `libraryFilters` and existing browse query param names
- `*.md` is gitignored — use `git add -f` for plan/spec commits; set author via env if config unset
- TDD: failing test before implementation for each behavioral task
- Commit after each task; commit only that task’s files

## File Map

| File | Responsibility |
|------|----------------|
| `frontend/library-grid/package.json` | Vite/React/Vitest deps and scripts |
| `frontend/library-grid/vite.config.js` | Build → `sharewarez/static/dist/library-grid`, base `/static/dist/library-grid/` |
| `frontend/library-grid/index.html` | Vite HTML shell (dev only) |
| `frontend/library-grid/src/main.jsx` | Boot: read mount node `data-*`, render `LibraryApp` |
| `frontend/library-grid/src/LibraryApp.jsx` | Filters + grid + pagination state, fetch orchestration |
| `frontend/library-grid/src/components/GameCard.jsx` | Single card UI (cover, badges, favorite, status, menu) |
| `frontend/library-grid/src/components/GameGrid.jsx` | Grid of cards + empty/error slots |
| `frontend/library-grid/src/components/PaginationBar.jsx` | Per-page + page controls |
| `frontend/library-grid/src/components/FilterBar.jsx` | Library filter controls (or thin wrapper over existing DOM — prefer React-owned filters in 1a) |
| `frontend/library-grid/src/api/browse.js` | `fetchBrowseGames(params, { signal })` |
| `frontend/library-grid/src/api/filters.js` | Filter list GETs |
| `frontend/library-grid/src/utils/cookies.js` | Read/write `libraryFilters` |
| `frontend/library-grid/src/utils/coverUrl.js` | Normalize cover paths to usable `src` |
| `sharewarez/static/dist/library-grid/*` | Build output (committed or built in Docker — prefer build in image/CI; commit `.gitkeep` + document) |
| `sharewarez/routes.py` | `/browse_games`: `url_for` cover URLs + `has_local_override` |
| `sharewarez/templates/games/library_browser.html` | Mount node; load dist bundle; stop SSR card loop / stop `library_pagination.js` |
| `sharewarez/templates/games/favorites.html` | 1b mount |
| `sharewarez/templates/games/discover.html` | 1b mounts per section |
| `frontend/library-grid/src/**/*.test.jsx` | Vitest unit/integration |
| `tests/test_routes.py` | Browse payload contract (`cover_url`, `has_local_override`, `is_vr`) |
| `Dockerfile` / `entrypoint` / docs | Ensure `npm ci && npm run build` before app start (or multi-stage copy) |

---

### Task 1: Scaffold Vite React app + Vitest smoke test

**Files:**
- Create: `frontend/library-grid/package.json`
- Create: `frontend/library-grid/vite.config.js`
- Create: `frontend/library-grid/index.html`
- Create: `frontend/library-grid/src/main.jsx`
- Create: `frontend/library-grid/src/AppSmoke.jsx`
- Create: `frontend/library-grid/src/AppSmoke.test.jsx`
- Create: `sharewarez/static/dist/library-grid/.gitkeep`

**Interfaces:**
- Consumes: none
- Produces: `npm run build` writes `sharewarez/static/dist/library-grid/library-grid.js` (+ css); `npm test` runs Vitest

- [ ] **Step 1: Write the failing smoke test**

```jsx
// frontend/library-grid/src/AppSmoke.test.jsx
import { render, screen } from '@testing-library/react'
import { AppSmoke } from './AppSmoke'

test('renders library grid smoke marker', () => {
  render(<AppSmoke />)
  expect(screen.getByText('library-grid-ok')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend/library-grid && npm install && npm test -- --run`
Expected: FAIL (module/AppSmoke missing or Vitest not configured)

- [ ] **Step 3: Scaffold package and minimal implementation**

`package.json` scripts: `"dev": "vite"`, `"build": "vite build"`, `"test": "vitest"`.

Dependencies: `react`, `react-dom`; dev: `vite`, `@vitejs/plugin-react`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`.

`vite.config.js`:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/static/dist/library-grid/',
  build: {
    outDir: path.resolve(__dirname, '../../sharewarez/static/dist/library-grid'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
      output: {
        entryFileNames: 'library-grid.js',
        assetFileNames: 'library-grid.[ext]',
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/testSetup.js',
  },
})
```

`AppSmoke.jsx` exports `export function AppSmoke() { return <div>library-grid-ok</div> }`.

`main.jsx` mounts `AppSmoke` into `#library-grid-root` if present (temporary until Task 5).

- [ ] **Step 4: Run tests and build**

Run: `cd frontend/library-grid && npm test -- --run && npm run build`
Expected: PASS; `sharewarez/static/dist/library-grid/library-grid.js` exists

- [ ] **Step 5: Commit**

```bash
git add frontend/library-grid sharewarez/static/dist/library-grid/.gitkeep
git commit -m "Scaffold library-grid Vite React app with Vitest smoke test."
```

---

### Task 2: Browse JSON contract — cover URL + local override flag

**Files:**
- Modify: `sharewarez/routes.py` (`browse_games`)
- Modify: `sharewarez/routes_library.py` (`get_games`) — keep SSR/initial payload aligned if still used
- Test: `tests/test_routes.py`

**Interfaces:**
- Consumes: `game_card_flags(game)`, `has_local_metadata` / `has_local_images` patterns from `routes_library.py`
- Produces: each browse game object includes:
  - `cover_url`: path usable as `/static/...` or full path from `url_for('static', filename=...)`
  - `has_local_override`: bool
  - existing: `uuid`, `name`, `is_favorite`, `user_status`, `is_vr`, `genres`, …

- [ ] **Step 1: Write failing tests**

```python
@patch('flask_login.current_user')
def test_browse_games_cover_url_is_static_path(self, mock_current_user, client, app, db_session, test_user, test_game, test_image):
    mock_current_user.is_authenticated = True
    mock_current_user.name = test_user.name
    mock_current_user.id = test_user.id
    with client.session_transaction() as sess:
        sess['_user_id'] = str(test_user.id)
    response = client.get('/browse_games')
    assert response.status_code == 200
    game = response.get_json()['games'][0]
    assert 'cover_url' in game
    # Must be fetchable under /static/ — either url_for path or library/images/…
    assert game['cover_url'].startswith('/') or game['cover_url'].startswith('http') or game['cover_url'].startswith('library/') or game['cover_url'].startswith('newstyle/')
    # Prefer absolute app path once implemented:
    assert '/static/' in game['cover_url'] or game['cover_url'].startswith('/static/')


@patch('flask_login.current_user')
def test_browse_games_includes_has_local_override_and_is_vr(self, mock_current_user, client, app, db_session, test_user, test_game):
    mock_current_user.is_authenticated = True
    mock_current_user.name = test_user.name
    mock_current_user.id = test_user.id
    with client.session_transaction() as sess:
        sess['_user_id'] = str(test_user.id)
    response = client.get('/browse_games')
    game = response.get_json()['games'][0]
    assert 'has_local_override' in game
    assert isinstance(game['has_local_override'], bool)
    assert 'is_vr' in game
```

Adjust assertions to match final URL helper (see Step 3). If Postgres unavailable, skip with clear note — do not mark task done without green tests when DB is up.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_routes.py -k "browse_games_cover_url or browse_games_includes_has_local" -v`
Expected: FAIL (missing keys or cover not under `/static/`)

- [ ] **Step 3: Implement browse payload fields**

In `browse_games` loop:

```python
from flask import url_for
# ...
if cover_image and cover_image.url:
    if cover_image.url.startswith('http'):
        cover_url = cover_image.url
    else:
        cover_url = url_for('static', filename=f'library/images/{cover_image.url}')
else:
    cover_url = url_for('static', filename='newstyle/default_cover.jpg')

# has_local_override — mirror routes_library.get_games logic (import helpers at module top)
has_local_override = False
# ... settings + has_local_metadata / has_local_images ...

game_data.append({
    # ...existing fields...
    'cover_url': cover_url,
    'has_local_override': has_local_override,
    **game_card_flags(game),
})
```

Move any inline imports in that function to module top per project rule.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_routes.py -k "browse_games_cover_url or browse_games_includes_has_local" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add sharewarez/routes.py sharewarez/routes_library.py tests/test_routes.py
git commit -m "Stabilize browse_games cover URLs and card flags for React grid."
```

---

### Task 3: `GameCard` component (badges, favorite affordance)

**Files:**
- Create: `frontend/library-grid/src/components/GameCard.jsx`
- Create: `frontend/library-grid/src/components/GameCard.test.jsx`
- Create: `frontend/library-grid/src/utils/coverUrl.js`

**Interfaces:**
- Consumes: game object `{ uuid, name, cover_url, is_favorite, user_status, has_local_override, is_vr, genres }`
- Produces: `<GameCard game={...} showPlayStatus={bool} isAdmin={bool} onToggleFavorite={fn} />`

- [ ] **Step 1: Write failing tests**

```jsx
import { render, screen } from '@testing-library/react'
import { GameCard } from './GameCard'

const baseGame = {
  uuid: '11111111-1111-4111-8111-111111111111',
  name: 'Archery Kings VR',
  cover_url: '/static/newstyle/default_cover.jpg',
  is_favorite: false,
  user_status: null,
  has_local_override: true,
  is_vr: true,
  genres: ['Sports'],
}

test('renders L and VR badges when flags set', () => {
  render(<GameCard game={baseGame} showPlayStatus={false} isAdmin={false} />)
  expect(screen.getByTitle(/local metadata/i)).toHaveTextContent('L')
  expect(screen.getByTitle(/virtual reality/i)).toHaveTextContent('VR')
})

test('omits badges when flags false', () => {
  render(
    <GameCard
      game={{ ...baseGame, has_local_override: false, is_vr: false }}
      showPlayStatus={false}
      isAdmin={false}
    />,
  )
  expect(screen.queryByTitle(/local metadata/i)).toBeNull()
  expect(screen.queryByTitle(/virtual reality/i)).toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend/library-grid && npm test -- --run src/components/GameCard.test.jsx`
Expected: FAIL

- [ ] **Step 3: Implement `GameCard`**

Reuse class names from theme where practical: `game-card`, `game-card-container`, `local-metadata-badge`, `vr-badge`, `favorite-btn` so existing CSS applies. Cover: `<img src={coverUrl(game.cover_url)} alt={game.name} />`. Details link: `/game_details/${uuid}`.

Popup menu + status dropdown can be stubs in this task (buttons present, handlers no-op) if Task 4 wires actions — prefer including menu structure matching `popup_menu.html` so layout is correct.

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit**

```bash
git add frontend/library-grid/src/components/GameCard.jsx frontend/library-grid/src/components/GameCard.test.jsx frontend/library-grid/src/utils/coverUrl.js
git commit -m "Add GameCard with L/VR badges for library grid."
```

---

### Task 4: Browse fetch + `GameGrid` + pagination with abort

**Files:**
- Create: `frontend/library-grid/src/api/browse.js`
- Create: `frontend/library-grid/src/components/GameGrid.jsx`
- Create: `frontend/library-grid/src/components/PaginationBar.jsx`
- Create: `frontend/library-grid/src/LibraryApp.jsx`
- Create: `frontend/library-grid/src/LibraryApp.test.jsx`

**Interfaces:**
- Consumes: `GET /browse_games?...` → `{ games, pages, current_page, total }`
- Produces: `LibraryApp` manages `page`, `perPage`, `filters`, aborts stale fetches

- [ ] **Step 1: Write failing integration-style test**

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LibraryApp } from './LibraryApp'

function jsonResponse(body) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
  })
}

test('page flip replaces cards and does not duplicate grid roots', async () => {
  const user = userEvent.setup()
  const fetchMock = vi.fn()
    .mockImplementationOnce(() =>
      jsonResponse({
        games: [{ uuid: 'a', name: 'Game A', cover_url: '/static/x', is_favorite: false, has_local_override: false, is_vr: false, genres: [] }],
        pages: 2,
        current_page: 1,
        total: 2,
      }),
    )
    .mockImplementationOnce(() =>
      jsonResponse({
        games: [{ uuid: 'b', name: 'Game B', cover_url: '/static/x', is_favorite: false, has_local_override: false, is_vr: false, genres: [] }],
        pages: 2,
        current_page: 2,
        total: 2,
      }),
    )
  vi.stubGlobal('fetch', fetchMock)

  render(
    <LibraryApp
      initialConfig={{
        perPage: 20,
        showPlayStatus: false,
        isAdmin: false,
        libraryCount: 1,
        gamesCount: 2,
      }}
    />,
  )

  await waitFor(() => expect(screen.getByText('Game A')).toBeInTheDocument())
  await user.click(screen.getByLabelText(/next page/i))
  await waitFor(() => expect(screen.getByText('Game B')).toBeInTheDocument())
  expect(screen.queryByText('Game A')).toBeNull()
  expect(document.querySelectorAll('[data-library-grid]').length).toBe(1)
})
```

Add `@testing-library/user-event` if missing.

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement fetch + UI**

`browse.js`:

```js
export async function fetchBrowseGames(params, { signal } = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  )
  const res = await fetch(`/browse_games?${qs}`, { signal, credentials: 'same-origin' })
  if (!res.ok) throw new Error(`browse_games ${res.status}`)
  return res.json()
}
```

`LibraryApp.jsx`: on filter/page change, `abortController.abort()` previous; set error state with Retry button on failure; empty states using `libraryCount` / `gamesCount` / `isAdmin` from config.

- [ ] **Step 4: Tests PASS**

- [ ] **Step 5: Commit**

```bash
git add frontend/library-grid/src
git commit -m "Add LibraryApp grid pagination with stale-fetch abort."
```

---

### Task 5: Filter bar + cookie restore; mount on Library template

**Files:**
- Create: `frontend/library-grid/src/components/FilterBar.jsx`
- Create: `frontend/library-grid/src/api/filters.js`
- Create: `frontend/library-grid/src/utils/cookies.js`
- Modify: `frontend/library-grid/src/main.jsx`
- Modify: `sharewarez/templates/games/library_browser.html`
- Modify: `sharewarez/templates/games/library_filters.html` (optional: empty mount host if filters move fully into React)

**Interfaces:**
- Consumes: `/api/get_libraries`, `/api/library_platforms`, `/api/igdb_platforms`, `/api/genres`, `/api/themes`, `/api/game_modes`, `/api/player_perspectives`
- Produces: filter params passed into `fetchBrowseGames`; cookie `libraryFilters` JSON

- [ ] **Step 1: Write failing test for cookie → initial filter apply**

```jsx
test('applies libraryFilters cookie on boot', async () => {
  document.cookie = `libraryFilters=${encodeURIComponent(JSON.stringify({ genre: 'Action' }))}; path=/`
  // mock filter APIs + browse; assert browse called with genre=Action
})
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement FilterBar + template mount**

`library_browser.html` changes:
- Remove SSR `{% for game in games %}` card loop (replace with empty `#library-grid-root`).
- Remove `<script src="{{ 'js/library_pagination.js'|theme_asset }}">` (keep `favorites_manager.js` / `game_status_manager.js` only if React delegates to them; otherwise implement toggles via `/api/toggle_favorite` and `/api/set_game_status` with CSRF from `data-csrf-token`).
- Add:

```html
<div
  id="library-grid-root"
  data-per-page="{{ user_per_page }}"
  data-default-sort="{{ user_default_sort }}"
  data-default-sort-order="{{ user_default_sort_order }}"
  data-is-admin="{{ is_admin|lower }}"
  data-show-play-status="{{ show_play_status|lower }}"
  data-library-count="{{ library_count }}"
  data-games-count="{{ games_count }}"
  data-enable-delete-on-disk="{{ enable_delete_game_on_disk|lower }}"
  data-discord-configured="{{ discord_configured|lower }}"
  data-current-filters="{{ filters|tojson|e }}"
></div>
<script type="module" src="{{ url_for('static', filename='dist/library-grid/library-grid.js') }}"></script>
```

CSRF: read from existing meta/cookie pattern used by `csrf-utils.js` — pass token into fetch POST headers the same way `favorites_manager.js` does.

Move filter UI into React **or** keep `#filterForm` in DOM and have React read/write it — prefer React-owned FilterBar inside the island for one owner.

- [ ] **Step 4: `npm test -- --run` + `npm run build`; manual checklist**

Manual:
1. Open Library — island boots, cards load
2. Next/prev pages repeatedly — no duplicate controls, no reload needed
3. Apply genre filter + Clear
4. Hard refresh — still works

- [ ] **Step 5: Commit**

```bash
git add frontend/library-grid sharewarez/templates/games/library_browser.html sharewarez/templates/games/library_filters.html sharewarez/static/dist/library-grid
git commit -m "Mount library-grid React island on Library browser."
```

---

### Task 6: Card actions (favorite, status, popup) parity

**Files:**
- Modify: `frontend/library-grid/src/components/GameCard.jsx`
- Create: `frontend/library-grid/src/api/userActions.js`
- Test: `frontend/library-grid/src/components/GameCard.actions.test.jsx`

**Interfaces:**
- Consumes: `POST /api/toggle_favorite/<uuid>`, `POST /api/set_game_status/<uuid>`, existing admin routes used by popup (`/game_edit/...`, refresh images, delete modals — can open URLs / dispatch CustomEvents compatible with `popup_menu.js` if that script remains)

- [ ] **Step 1: Failing test — favorite toggle calls API and updates UI**

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implement with CSRF; close menu on page change (LibraryApp sets `menuGameUuid` null on page change)**

- [ ] **Step 4: PASS + manual favorite/status**

- [ ] **Step 5: Commit**

```bash
git commit -m "Wire GameCard favorite and status actions for library grid."
```

---

### Task 7: Docker/build wiring so Unraid gets the bundle

**Files:**
- Modify: `Dockerfile` (multi-stage: `node` build → copy `static/dist/library-grid`)
- Modify: `README.md` or install docs (dev: `cd frontend/library-grid && npm run build`)
- Optional: `entrypoint.sh` warning if `library-grid.js` missing

- [ ] **Step 1: Add Dockerfile stages**

```dockerfile
FROM node:22-alpine AS library-grid-build
WORKDIR /src
COPY frontend/library-grid/package*.json ./
RUN npm ci
COPY frontend/library-grid/ ./
RUN npm run build
# later stage:
COPY --from=library-grid-build /src/../../sharewarez/static/dist/library-grid /app/sharewarez/static/dist/library-grid
```

Fix paths to match actual build `outDir`.

- [ ] **Step 2: Build image locally; confirm JS exists in image**

- [ ] **Step 3: Commit**

```bash
git commit -m "Build library-grid assets in Docker image."
```

---

### Task 8: Track 1b — Favorites mount

**Files:**
- Modify: `frontend/library-grid/src/FavoritesApp.jsx` (or `mode` prop on shared app)
- Modify: `sharewarez/templates/games/favorites.html`
- Add JSON endpoint if favorites are SSR-only today — prefer `GET /api/favorites` returning same card shape; implement + pytest if missing

- [ ] **Step 1: Discover current favorites data path; write failing API or adapter test**

- [ ] **Step 2: Implement endpoint if needed + Favorites mount using `GameGrid`/`GameCard`**

- [ ] **Step 3: Manual — favorites list renders via React; remove heart updates card**

- [ ] **Step 4: Commit**

```bash
git commit -m "Mount shared GameGrid on Favorites page."
```

---

### Task 9: Track 1b — Discover section mounts

**Files:**
- Modify: `sharewarez/templates/games/discover.html`
- Modify: `frontend/library-grid/src/DiscoverApp.jsx`
- Align discover section APIs / embedded JSON to card shape (`cover_url`, flags)

- [ ] **Step 1: Failing test for Discover section adapter mapping fixture → GameCard props**

- [ ] **Step 2: Mount one React root per section container (latest, most downloaded, …) or one root with sections prop**

- [ ] **Step 3: Manual — Discover sections show React cards; no Jinja card loops left**

- [ ] **Step 4: Commit**

```bash
git commit -m "Mount shared GameCard grid on Discover sections."
```

---

### Task 10: Cleanup + verification

**Files:**
- Modify/delete Library-only dead paths in `library_pagination.js` (or delete file if unused)
- Update `popup_menu.html` comment about dual maintenance

- [ ] **Step 1: Grep for `library_pagination` / `createGameCardHtml` — ensure Library no longer loads them**

- [ ] **Step 2: Full Vitest + relevant pytest**

```bash
cd frontend/library-grid && npm test -- --run
pytest tests/test_routes.py -k browse_games -v
```

- [ ] **Step 3: Manual regression checklist (spec success criteria)**

1. Rapid page 1↔2↔1 — no UI corruption  
2. Filters Apply/Clear + cookie  
3. L/VR badges match data  
4. Favorite/status work  
5. Favorites + Discover use same cards  

- [ ] **Step 4: Commit**

```bash
git commit -m "Remove legacy Library pagination card builders after React island."
```

---

## Spec coverage (self-review)

| Spec item | Task |
|-----------|------|
| React+Vite island Library first | 1, 5 |
| Hybrid then Favorites/Discover | 8, 9 |
| Stable cover URLs + card flags | 2 |
| Single GameCard | 3 |
| Abort stale fetch / no duplicate DOM | 4 |
| Filters + cookie | 5 |
| Actions parity | 6 |
| Build/deploy | 7 |
| Success criteria / cleanup | 10 |

## Placeholder scan

No TBD/TODO left in task steps; Dockerfile path note says “fix to match outDir” — implementer must align COPY path with `vite.config.js` `outDir` from Task 1 (absolute under `sharewarez/static/dist/library-grid`).
