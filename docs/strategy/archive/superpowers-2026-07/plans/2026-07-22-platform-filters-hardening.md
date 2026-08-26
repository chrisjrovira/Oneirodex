# Platform Filters + Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add separate Library Platform and IGDB Platform browse filters, then harden path deletes, Steam/RAWG scraping, metadata savepoints, and static cover URLs — testing and fixing after each phase.

**Architecture:** Extend existing filter APIs and `library_pagination.js` for dual platform params; reuse `is_safe_path` before disk deletes; add a small shared HTTP retry helper for scrapers; extract enrichment apply into a savepoint-wrapped helper; return `url_for('static', …)` cover URLs from JSON browse endpoints so AJAX cards work behind reverse proxies.

**Tech Stack:** Flask, SQLAlchemy 2.x, jQuery (existing library UI), pytest, `requests`

**Spec:** `docs/superpowers/specs/2026-07-22-platform-filters-hardening-design.md`

## Global Constraints

- Delivery is risk-ordered vertical phases; do not start phase N+1 until phase N tests pass
- Platform filters: separate controls; all active filters AND together; used-only dropdown population
- Prefer explicit `library_platform` + `igdb_platform` params; do not keep ambiguous `platform`
- Verification: pytest + short manual checklist per phase
- No IGDB client rewrite, no rate-limit admin UI, no DB migrations for image storage, no separate VR filter
- Follow existing patterns in `routes_apis/filters.py` and `populateDropdown`
- `*.md` is gitignored — use `git add -f` for plan/spec commits; set author via env if config unset

## File Map

| File | Responsibility |
|------|----------------|
| `gametheca/routes_apis/filters.py` | `/api/library_platforms`, `/api/igdb_platforms` |
| `gametheca/routes.py` | `/browse_games` dual filters + static cover URLs; sanitize `delete_folder` / `delete_full_game` |
| `gametheca/templates/games/library_filters.html` | Two new `<select>` controls |
| `gametheca/setup/default_theme/js/library_pagination.js` | Populate, query, cookie, clear; use server cover URLs |
| `gametheca/utils/http_retry.py` | Per-host throttle + exponential backoff GET |
| `gametheca/utils/secondary_scrapers.py` | Use http_retry for Steam/RAWG |
| `gametheca/utils/metadata_enrichment.py` | `apply_enriched_metadata` with savepoint |
| `gametheca/utilities.py` | Call enrich HTTP then `apply_enriched_metadata` (both sites) |
| `gametheca/routes_discover.py` | Align cover_url to `url_for('static', …)` when bare filename |
| `tests/test_routes_apis_filters.py` | New platform list endpoint tests |
| `tests/test_routes.py` | Browse filter + delete_folder safety + cover URL tests |
| `tests/test_utils_http_retry.py` | Retry/backoff unit tests |
| `tests/test_utils_secondary_scrapers.py` | Scraper integration with mocked HTTP |
| `tests/test_utils_metadata_enrichment.py` | Savepoint rollback tests |

---

### Task 1: Library / IGDB platform filter list APIs

**Files:**
- Modify: `gametheca/routes_apis/filters.py`
- Test: `tests/test_routes_apis_filters.py`

**Interfaces:**
- Consumes: `Library.platform` (`LibraryPlatform` enum), `Platform` model + `game_platform_association`
- Produces:
  - `GET /api/library_platforms` → `[{ "id": "PCWIN", "name": "PC Windows", "value": "PCWIN" }, …]` (distinct from existing libraries only)
  - `GET /api/igdb_platforms` → `[{ "id": <int>, "name": "<str>" }, …]` (platforms linked to ≥1 game only)

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_routes_apis_filters.py` (add imports `Library`, `Platform`, `Game`, `LibraryPlatform` as needed):

```python
def test_library_platforms_requires_login(self, client):
    response = client.get('/api/library_platforms')
    assert response.status_code == 302


def test_igdb_platforms_requires_login(self, client):
    response = client.get('/api/igdb_platforms')
    assert response.status_code == 302


def test_get_library_platforms_used_only(self, client, regular_user, db_session):
    from gametheca.models import Library
    from gametheca.platform import LibraryPlatform
    from uuid import uuid4

    lib = Library(
        name=f'Lib {uuid4().hex[:8]}',
        platform=LibraryPlatform.NES,
        display_order=0,
    )
    db_session.add(lib)
    db_session.commit()

    with client.session_transaction() as sess:
        sess['_user_id'] = str(regular_user.id)
        sess['_fresh'] = True

    response = client.get('/api/library_platforms')
    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, list)
    values = {item['value'] for item in data}
    assert 'NES' in values
    nes = next(item for item in data if item['value'] == 'NES')
    assert nes['name'] == LibraryPlatform.NES.value
    assert nes['id'] == 'NES'


def test_get_igdb_platforms_used_only(self, client, regular_user, db_session):
    from gametheca.models import Library, Game, Platform
    from gametheca.platform import LibraryPlatform
    from uuid import uuid4

    lib = Library(
        name=f'Lib {uuid4().hex[:8]}',
        platform=LibraryPlatform.PCWIN,
        display_order=0,
    )
    db_session.add(lib)
    db_session.flush()

    linked = Platform(name=f'WinTest-{uuid4().hex[:6]}')
    orphan = Platform(name=f'Orphan-{uuid4().hex[:6]}')
    db_session.add_all([linked, orphan])
    db_session.flush()

    game = Game(
        uuid=str(uuid4()),
        name='PGame',
        library_uuid=lib.uuid,
        full_disk_path=f'/test/{uuid4().hex}',
    )
    game.platforms.append(linked)
    db_session.add(game)
    db_session.commit()

    with client.session_transaction() as sess:
        sess['_user_id'] = str(regular_user.id)
        sess['_fresh'] = True

    response = client.get('/api/igdb_platforms')
    assert response.status_code == 200
    names = {item['name'] for item in response.get_json()}
    assert linked.name in names
    assert orphan.name not in names
```

Place login tests in `TestFiltersAPIAuthentication`; success tests in `TestFiltersAPISuccessful` (or a new class if cleaner).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_routes_apis_filters.py::TestFiltersAPIAuthentication::test_library_platforms_requires_login tests/test_routes_apis_filters.py::TestFiltersAPISuccessful::test_get_library_platforms_used_only tests/test_routes_apis_filters.py::TestFiltersAPISuccessful::test_get_igdb_platforms_used_only -v`

Expected: FAIL (404 or route missing)

- [ ] **Step 3: Implement endpoints**

In `gametheca/routes_apis/filters.py`, add imports and routes:

```python
from gametheca.models import Genre, Theme, GameMode, PlayerPerspective, Library, Platform, Game
from gametheca.platform import LibraryPlatform
from sqlalchemy import select, distinct

@apis_bp.route('/library_platforms')
@login_required
def get_library_platforms():
    try:
        platforms = db.session.execute(
            select(distinct(Library.platform)).order_by(Library.platform.asc())
        ).scalars().all()
        data = []
        for p in platforms:
            if p is None:
                continue
            data.append({
                'id': p.name,
                'name': p.value,
                'value': p.name,
            })
        data.sort(key=lambda x: x['name'].lower())
        return jsonify(data), 200
    except SQLAlchemyError as e:
        log_system_event('filters_api', f'Database error fetching library_platforms: {str(e)}', 'error')
        return jsonify({'status': 'error', 'message': 'Database error retrieving library platforms'}), 500


@apis_bp.route('/igdb_platforms')
@login_required
def get_igdb_platforms():
    try:
        results = db.session.execute(
            select(Platform)
            .join(Platform.games)
            .distinct()
            .order_by(Platform.name.asc())
        ).scalars().all()
        data_list = [{'id': item.id, 'name': item.name} for item in results]
        return jsonify(data_list), 200
    except SQLAlchemyError as e:
        log_system_event('filters_api', f'Database error fetching igdb_platforms: {str(e)}', 'error')
        return jsonify({'status': 'error', 'message': 'Database error retrieving igdb platforms'}), 500
```

If `order_by(Library.platform.asc())` fails on your SQLAlchemy/DB combo, fetch distinct then sort in Python by `p.value`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_routes_apis_filters.py -v -k "library_platforms or igdb_platforms or genres_success"`

Expected: PASS for new tests; existing genre test still green

- [ ] **Step 5: Commit**

```bash
git add -f tests/test_routes_apis_filters.py gametheca/routes_apis/filters.py
git commit -m "Add used-only library and IGDB platform filter APIs."
```

---

### Task 2: `/browse_games` dual platform filters

**Files:**
- Modify: `gametheca/routes.py` (`browse_games`, ~lines 61–165)
- Test: `tests/test_routes.py`

**Interfaces:**
- Consumes: `library_platform` (enum name string), `igdb_platform` (platform name string)
- Produces: filtered game list; removes broken `platform` / `Library.platform_id` join

- [ ] **Step 1: Write the failing tests**

In `tests/test_routes.py`, add:

```python
@patch('flask_login.current_user')
def test_browse_games_library_platform_filter(self, mock_current_user, client, app, db_session, test_user, test_game, test_library):
    mock_current_user.is_authenticated = True
    mock_current_user.name = test_user.name
    mock_current_user.id = test_user.id

    other = Library(
        name=f'NES Lib {uuid4().hex[:8]}',
        platform=LibraryPlatform.NES,
        display_order=2,
    )
    db_session.add(other)
    db_session.flush()
    nes_game = Game(
        uuid=str(uuid4()),
        name='NES Only',
        library_uuid=other.uuid,
        full_disk_path=f'/test/nes/{uuid4().hex}',
    )
    db_session.add(nes_game)
    db_session.commit()

    with client.session_transaction() as sess:
        sess['_user_id'] = str(test_user.id)

    response = client.get('/browse_games?library_platform=NES')
    assert response.status_code == 200
    names = [g['name'] for g in response.get_json()['games']]
    assert 'NES Only' in names
    assert 'Test Game' not in names


@patch('flask_login.current_user')
def test_browse_games_igdb_platform_filter(self, mock_current_user, client, app, db_session, test_user, test_game, test_library):
    mock_current_user.is_authenticated = True
    mock_current_user.name = test_user.name
    mock_current_user.id = test_user.id

    plat = Platform(name=f'IGDB-{uuid4().hex[:6]}')
    db_session.add(plat)
    db_session.flush()
    test_game.platforms.append(plat)
    db_session.commit()

    with client.session_transaction() as sess:
        sess['_user_id'] = str(test_user.id)

    response = client.get(f'/browse_games?igdb_platform={plat.name}')
    assert response.status_code == 200
    names = [g['name'] for g in response.get_json()['games']]
    assert 'Test Game' in names

    response = client.get('/browse_games?igdb_platform=DoesNotExistXYZ')
    assert response.status_code == 200
    assert response.get_json()['games'] == []
```

Ensure `Library`, `LibraryPlatform`, `Platform`, `Game`, `uuid4` imports exist at top of the test file.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_routes.py::TestMainRoutes::test_browse_games_library_platform_filter tests/test_routes.py::TestMainRoutes::test_browse_games_igdb_platform_filter -v`

(Adjust class name to match the file’s actual class wrapping browse tests.)

Expected: FAIL (filters ignored or 500 from broken join if `platform=` still used)

- [ ] **Step 3: Implement browse filters**

Replace the platform block in `browse_games`:

```python
library_platform = request.args.get('library_platform')
igdb_platform = request.args.get('igdb_platform')
# remove: platform = request.args.get('platform') and the Library.platform_id join

# after building base query:
if library_platform:
    try:
        platform_enum = LibraryPlatform[library_platform]
    except KeyError:
        return jsonify({'games': [], 'total': 0, 'pages': 0, 'current_page': page}), 200
    query = query.join(Library, Game.library_uuid == Library.uuid).filter(
        Library.platform == platform_enum
    )

if igdb_platform:
    query = query.filter(Game.platforms.any(Platform.name == igdb_platform))
```

Add `from gametheca.platform import LibraryPlatform` at top of `routes.py` if missing.

If both `library_uuid` and `library_platform` are set, keep AND semantics (may need `joinedload` / single join — if Library is joined twice, use `query.join(Library, …)` only once or use `has()` / subquery). Preferred safe form:

```python
if library_platform:
    try:
        platform_enum = LibraryPlatform[library_platform]
    except KeyError:
        return jsonify({'games': [], 'total': 0, 'pages': 0, 'current_page': page}), 200
    query = query.filter(Game.library.has(Library.platform == platform_enum))

if library_uuid:
    query = query.filter(Game.library_uuid == library_uuid)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_routes.py -k "browse_games" -v`

Expected: PASS including new filters and existing filter tests

- [ ] **Step 5: Commit**

```bash
git add gametheca/routes.py tests/test_routes.py
git commit -m "Filter browse_games by library and IGDB platforms."
```

---

### Task 3: Library filter UI wiring

**Files:**
- Modify: `gametheca/templates/games/library_filters.html`
- Modify: `gametheca/setup/default_theme/js/library_pagination.js`

**Interfaces:**
- Consumes: `/api/library_platforms`, `/api/igdb_platforms`, Task 2 query params
- Produces: `#libraryPlatformSelect`, `#igdbPlatformSelect` wired through Apply/Clear/cookie/URL

- [ ] **Step 1: Add selects to the template**

In `library_filters.html`, after the Library select block, insert:

```html
      <div class="form-group">
        <label for="libraryPlatformSelect"></label>
        <select class="form-control" id="libraryPlatformSelect">
          <option value="">All Library Platforms</option>
        </select>
      </div>
      <div class="form-group">
        <label for="igdbPlatformSelect"></label>
        <select class="form-control" id="igdbPlatformSelect">
          <option value="">All IGDB Platforms</option>
        </select>
      </div>
```

- [ ] **Step 2: Wire JS populate + fetch + cookie + clear**

In `library_pagination.js`:

1. Add populate helpers after `populateLibraries`:

```javascript
    function populateLibraryPlatforms(callback) {
        populateDropdown({
            apiUrl: '/api/library_platforms',
            elementId: '#libraryPlatformSelect',
            defaultText: 'All Library Platforms',
            valueField: 'value',
            textField: 'name',
            paramName: 'library_platform',
            callback: callback
        });
    }

    function populateIgdbPlatforms(callback) {
        populateDropdown({
            apiUrl: '/api/igdb_platforms',
            elementId: '#igdbPlatformSelect',
            defaultText: 'All IGDB Platforms',
            valueField: 'name',
            textField: 'name',
            paramName: 'igdb_platform',
            callback: callback
        });
    }
```

2. In `fetchFilteredGames` filters object, add:

```javascript
            library_platform: $('#libraryPlatformSelect').val() || urlParams.library_platform || undefined,
            igdb_platform: $('#igdbPlatformSelect').val() || urlParams.igdb_platform || undefined,
```

3. In `#filterForm` submit cookie payload, add `library_platform` and `igdb_platform`.

4. In `#clearFilters`, include `#libraryPlatformSelect, #igdbPlatformSelect` in the val('') selector.

5. In cookie restore (both early restore and nested populate callback), set:

```javascript
$('#libraryPlatformSelect').val(savedFilters.library_platform || '');
$('#igdbPlatformSelect').val(savedFilters.igdb_platform || '');
```

6. Add keys to `filtersMatch` `keyMappings`:

```javascript
            'library_platform': 'library_platform',
            'igdb_platform': 'igdb_platform',
```

7. Nest populate chain: after libraries, call `populateLibraryPlatforms` then `populateIgdbPlatforms` before genres (order flexible; keep callback nesting intact).

- [ ] **Step 3: Manual checklist (Phase 1 exit)**

With app running:

1. Open library browser → both new dropdowns populate with used-only values
2. Library Platform alone filters correctly
3. IGDB Platform alone filters correctly
4. Combine with genre → AND
5. Clear resets both platform selects

- [ ] **Step 4: Commit**

```bash
git add gametheca/templates/games/library_filters.html gametheca/setup/default_theme/js/library_pagination.js
git commit -m "Wire dual platform filter dropdowns in library UI."
```

---

### Task 4: Sanitize folder deletes before `rmtree` / `remove`

**Files:**
- Modify: `gametheca/routes.py` (`delete_folder`, `delete_full_game`)
- Test: `tests/test_routes.py`

**Interfaces:**
- Consumes: `is_safe_path`, `get_allowed_base_directories(current_app)`
- Produces: 403 + no disk mutation when path outside allowed bases

- [ ] **Step 1: Write the failing tests**

```python
@patch('flask_login.current_user')
@patch('gametheca.routes.shutil.rmtree')
@patch('gametheca.routes.os.path.exists', return_value=True)
@patch('gametheca.routes.is_safe_path', return_value=(False, 'Access denied'))
def test_delete_folder_rejects_unsafe_path(self, mock_safe, mock_exists, mock_rmtree,
                                           mock_current_user, client, app, db_session, admin_user):
    mock_current_user.is_authenticated = True
    mock_current_user.role = 'admin'
    with client.session_transaction() as sess:
        sess['_user_id'] = str(admin_user.id)

    response = client.post('/delete_folder', json={'folder_path': '/etc/passwd'})
    assert response.status_code == 403
    mock_rmtree.assert_not_called()


@patch('flask_login.current_user')
@patch('gametheca.routes.shutil.rmtree')
@patch('gametheca.routes.os.path.exists', return_value=True)
@patch('gametheca.routes.is_safe_path', return_value=(True, None))
def test_delete_folder_allows_safe_path(self, mock_safe, mock_exists, mock_rmtree,
                                        mock_current_user, client, app, db_session, admin_user):
    mock_current_user.is_authenticated = True
    mock_current_user.role = 'admin'
    mock_exists.side_effect = [True, False]
    with client.session_transaction() as sess:
        sess['_user_id'] = str(admin_user.id)

    with patch('gametheca.routes.os.path.isfile', return_value=False):
        response = client.post('/delete_folder', json={'folder_path': '/allowed/game'})
    assert response.status_code == 200
    mock_rmtree.assert_called_once()
```

Update existing `test_delete_folder_file` / `test_delete_folder_directory` to patch `is_safe_path` → `(True, None)` so they keep passing.

Also add a test that `delete_full_game` refuses unsafe `full_disk_path` (patch game path + `is_safe_path` False → 403, `rmtree` not called).

- [ ] **Step 2: Run tests to verify new reject test fails**

Run: `pytest tests/test_routes.py -k "delete_folder_rejects_unsafe" -v`

Expected: FAIL (currently deletes / returns 200)

- [ ] **Step 3: Implement validation**

In `delete_folder`, after reading `folder_path` and before existence checks / disk ops:

```python
    allowed_bases = get_allowed_base_directories(current_app)
    is_safe, error_message = is_safe_path(folder_path, allowed_bases)
    if not is_safe:
        return jsonify({'status': 'error', 'message': 'Access denied.'}), 403

    full_path = os.path.abspath(folder_path)
```

In `delete_full_game`, before `shutil.rmtree` / `os.remove` when `on_disk`:

```python
        allowed_bases = get_allowed_base_directories(current_app)
        is_safe, error_message = is_safe_path(full_path, allowed_bases)
        if not is_safe:
            return jsonify({'success': False, 'message': 'Access denied.'}), 403
```

DB-only cleanup when path missing may proceed without disk ops; do not delete disk for unsafe paths.

- [ ] **Step 4: Run tests**

Run: `pytest tests/test_routes.py -k "delete_folder or delete_full_game" -v`

Expected: PASS

- [ ] **Step 5: Manual checklist (Phase 2)**

- Valid unmatched folder under base still deletes
- Outside-base path denied; disk unchanged

- [ ] **Step 6: Commit**

```bash
git add gametheca/routes.py tests/test_routes.py
git commit -m "Require safe paths before folder and game disk deletes."
```

---

### Task 5: HTTP retry helper + scraper backoff

**Files:**
- Create: `gametheca/utils/http_retry.py`
- Modify: `gametheca/utils/secondary_scrapers.py`
- Create: `tests/test_utils_http_retry.py`
- Create: `tests/test_utils_secondary_scrapers.py`

**Interfaces:**
- Consumes: `requests.get`
- Produces: `request_with_backoff(url, *, host_key, params=None, timeout=5, max_retries=3) -> Response | None`

- [ ] **Step 1: Write failing unit tests for http_retry**

`tests/test_utils_http_retry.py`:

```python
from unittest.mock import patch, MagicMock
from gametheca.utils.http_retry import request_with_backoff


@patch('gametheca.utils.http_retry.time.sleep', return_value=None)
@patch('gametheca.utils.http_retry.requests.get')
def test_retries_on_429_then_succeeds(mock_get, mock_sleep):
    bad = MagicMock(status_code=429)
    good = MagicMock(status_code=200)
    mock_get.side_effect = [bad, good]

    resp = request_with_backoff('https://example.com/x', host_key='example')
    assert resp is good
    assert mock_get.call_count == 2
    assert mock_sleep.called


@patch('gametheca.utils.http_retry.time.sleep', return_value=None)
@patch('gametheca.utils.http_retry.requests.get')
def test_gives_up_after_max_retries(mock_get, mock_sleep):
    mock_get.return_value = MagicMock(status_code=503)
    resp = request_with_backoff('https://example.com/x', host_key='example', max_retries=3)
    assert resp is None
    assert mock_get.call_count == 3
```

- [ ] **Step 2: Run to verify fail**

Run: `pytest tests/test_utils_http_retry.py -v`

Expected: FAIL (import error)

- [ ] **Step 3: Implement `http_retry.py`**

```python
import time
import random
import threading
import requests

_last_request_at = {}
_lock = threading.Lock()
_MIN_INTERVAL_SEC = {
    'steam': 1.0,
    'rawg': 1.0,
}


def request_with_backoff(url, *, host_key, params=None, timeout=5, max_retries=3, headers=None):
    """GET with per-host min interval and exponential backoff on 429/5xx/timeout."""
    min_interval = _MIN_INTERVAL_SEC.get(host_key, 0.5)
    last_exc = None

    for attempt in range(max_retries):
        with _lock:
            now = time.monotonic()
            last = _last_request_at.get(host_key, 0.0)
            wait = min_interval - (now - last)
            if wait > 0:
                time.sleep(wait)
            _last_request_at[host_key] = time.monotonic()

        try:
            resp = requests.get(url, params=params, timeout=timeout, headers=headers)
        except requests.RequestException as exc:
            last_exc = exc
            time.sleep((2 ** attempt) + random.uniform(0, 0.25))
            continue

        if resp.status_code == 200:
            return resp
        if resp.status_code == 429 or resp.status_code >= 500:
            time.sleep((2 ** attempt) + random.uniform(0, 0.25))
            continue
        return None

    if last_exc:
        print(f"http_retry exhausted for {host_key}: {last_exc}")
    return None
```

- [ ] **Step 4: Refactor scrapers to use helper**

In `secondary_scrapers.py`, replace direct `requests.get` with:

```python
from gametheca.utils.http_retry import request_with_backoff

# Steam search:
resp = request_with_backoff(search_url, host_key='steam', timeout=5)
# Steam details:
details_resp = request_with_backoff(details_url, host_key='steam', timeout=5)
# RAWG:
resp = request_with_backoff("https://api.rawg.io/api/games", host_key='rawg', params=params, timeout=5)
```

Keep existing parse/merge logic; still return `None` on failure.

- [ ] **Step 5: Scraper smoke test**

`tests/test_utils_secondary_scrapers.py`:

```python
from unittest.mock import patch, MagicMock
from gametheca.utils.secondary_scrapers import fetch_steam_data


@patch('gametheca.utils.secondary_scrapers.request_with_backoff')
def test_fetch_steam_data_returns_none_on_http_failure(mock_req):
    mock_req.return_value = None
    assert fetch_steam_data('Some Game') is None
```

- [ ] **Step 6: Run tests**

Run: `pytest tests/test_utils_http_retry.py tests/test_utils_secondary_scrapers.py -v`

Expected: PASS

- [ ] **Step 7: Manual checklist (Phase 3)**

- Trigger scrape path (or log-level observation): failure does not abort scan worker

- [ ] **Step 8: Commit**

```bash
git add gametheca/utils/http_retry.py gametheca/utils/secondary_scrapers.py tests/test_utils_http_retry.py tests/test_utils_secondary_scrapers.py
git commit -m "Add Steam/RAWG HTTP backoff and rate limiting."
```

---

### Task 6: Metadata apply helper with savepoints

**Files:**
- Create: `gametheca/utils/metadata_enrichment.py`
- Modify: `gametheca/utilities.py` (both enrichment blocks ~196–245 and ~404–450)
- Create: `tests/test_utils_metadata_enrichment.py`

**Interfaces:**
- Consumes: `enriched: dict` from `enrich_game_metadata` (HTTP already completed)
- Produces: `apply_enriched_metadata(game_obj, enriched) -> bool` (True if applied / no-op success; False if rolled back)

- [ ] **Step 1: Write failing savepoint test**

```python
from unittest.mock import patch
from gametheca.utils.metadata_enrichment import apply_enriched_metadata


def test_apply_enriched_metadata_rolls_back_on_error(app, db_session, /* create game fixture inline */):
    # Create Library + Game with summary=None
    # Patch PlayerPerspective creation or genre append to raise mid-apply
    with patch('gametheca.utils.metadata_enrichment.db.session.flush', side_effect=RuntimeError('boom')):
        # OR raise inside after summary set by patching a helper
        ok = apply_enriched_metadata(game, {'summary': 'New', 'genres': ['Action'], 'player_perspectives': []})
    assert ok is False
    db_session.refresh(game)
    assert game.summary is None  # or previous value
```

Implement the test against a real nested transaction: set `game.summary` inside apply, then force exception before commit of nested block; after function returns, summary must be unchanged.

Minimal reliable pattern:

```python
def test_savepoint_rollback(app, db_session):
    # setup library+game with summary=None, commit
    enriched = {'summary': 'Should not stick', 'genres': [], 'player_perspectives': []}

    def boom(*args, **kwargs):
        raise RuntimeError('fail')

    with patch('gametheca.utils.metadata_enrichment._attach_named_relations', side_effect=boom):
        result = apply_enriched_metadata(game, enriched)

    assert result is False
    db_session.refresh(game)
    assert game.summary is None
```

- [ ] **Step 2: Run to verify fail**

Run: `pytest tests/test_utils_metadata_enrichment.py -v`

Expected: FAIL (module missing)

- [ ] **Step 3: Implement helper**

`gametheca/utils/metadata_enrichment.py`:

```python
from sqlalchemy import select
from gametheca import db
from gametheca.models import Genre, PlayerPerspective


def _attach_named_relations(game_obj, enriched):
    if enriched.get('player_perspectives'):
        for persp_name in enriched['player_perspectives']:
            persp_obj = db.session.execute(
                select(PlayerPerspective).filter_by(name=persp_name)
            ).scalar_one_or_none()
            if not persp_obj:
                persp_obj = PlayerPerspective(name=persp_name)
                db.session.add(persp_obj)
            if persp_obj not in game_obj.player_perspectives:
                game_obj.player_perspectives.append(persp_obj)

    if enriched.get('genres'):
        for genre_name in enriched['genres']:
            genre_obj = db.session.execute(
                select(Genre).filter_by(name=genre_name)
            ).scalar_one_or_none()
            if not genre_obj:
                genre_obj = Genre(name=genre_name)
                db.session.add(genre_obj)
            if genre_obj not in game_obj.genres:
                game_obj.genres.append(genre_obj)


def apply_enriched_metadata(game_obj, enriched):
    """Apply enrichment inside a SAVEPOINT. Returns False if rolled back."""
    if not game_obj or not enriched:
        return True
    try:
        with db.session.begin_nested():
            if not game_obj.summary and enriched.get('summary'):
                game_obj.summary = enriched['summary']
            _attach_named_relations(game_obj, enriched)
        db.session.commit()
        return True
    except Exception as e:
        print(f"Metadata enrichment savepoint rollback: {e}")
        return False
```

Note: If the surrounding scan already commits often, prefer `begin_nested()` without an extra outer `commit()` if that would commit unrelated pending state — match call-site behavior. At current call sites they `db.session.commit()` after apply; so helper should **not** call outer `commit()`, only savepoint:

```python
def apply_enriched_metadata(game_obj, enriched):
    if not game_obj or not enriched:
        return True
    try:
        with db.session.begin_nested():
            if not game_obj.summary and enriched.get('summary'):
                game_obj.summary = enriched['summary']
            _attach_named_relations(game_obj, enriched)
        return True
    except Exception as e:
        print(f"Metadata enrichment savepoint rollback: {e}")
        return False
```

Caller keeps `db.session.commit()` after successful apply (or always commit scan progress separately).

- [ ] **Step 4: Replace both utilities.py blocks**

Pattern at each site:

```python
enriched = enrich_game_metadata(game_name, current_meta)
apply_enriched_metadata(game_obj, enriched)
db.session.commit()
```

Remove duplicated summary/genre/perspective loops.

- [ ] **Step 5: Run tests**

Run: `pytest tests/test_utils_metadata_enrichment.py -v`

Expected: PASS

- [ ] **Step 6: Manual checklist (Phase 4)**

- One title failing enrichment does not wipe prior committed summary

- [ ] **Step 7: Commit**

```bash
git add gametheca/utils/metadata_enrichment.py gametheca/utilities.py tests/test_utils_metadata_enrichment.py
git commit -m "Apply secondary metadata inside DB savepoints."
```

---

### Task 7: Static cover URL hardening

**Files:**
- Modify: `gametheca/routes.py` (`browse_games` cover_url building)
- Modify: `gametheca/routes_discover.py` (bare filename branch)
- Modify: `gametheca/setup/default_theme/js/library_pagination.js` (`createGameCardHtml`)
- Test: `tests/test_routes.py`

**Interfaces:**
- Produces: `cover_url` in browse JSON is a full static URL from `url_for('static', filename=…)`
- JS uses `game.cover_url` directly (no hardcoded `/static/` prefix)

- [ ] **Step 1: Write failing test**

```python
@patch('flask_login.current_user')
def test_browse_games_cover_url_uses_static(self, mock_current_user, client, app, db_session, test_user, test_game, test_image):
    mock_current_user.is_authenticated = True
    mock_current_user.name = test_user.name
    mock_current_user.id = test_user.id
    with client.session_transaction() as sess:
        sess['_user_id'] = str(test_user.id)

    response = client.get('/browse_games')
    game = next(g for g in response.get_json()['games'] if g['uuid'] == test_game.uuid)
    assert game['cover_url'].startswith('/static/')
    assert 'library/images/test_cover.jpg' in game['cover_url'] or game['cover_url'].endswith('test_cover.jpg')
```

- [ ] **Step 2: Run to verify fail**

Run: `pytest tests/test_routes.py -k "cover_url_uses_static" -v`

Expected: FAIL (bare `test_cover.jpg`)

- [ ] **Step 3: Backend URL shaping**

In `browse_games`:

```python
        if cover_image and cover_image.url:
            cover_url = url_for('static', filename=f'library/images/{cover_image.url}')
        else:
            cover_url = url_for('static', filename='newstyle/default_cover.jpg')
```

In `routes_discover.py`, when `cover_image` exists, wrap the same way (default already uses `url_for`).

- [ ] **Step 4: JS card HTML**

In `createGameCardHtml`:

```javascript
        var defaultCoverPath = '/static/newstyle/default_cover.jpg';
        var fullCoverUrl = game.cover_url || defaultCoverPath;
```

Remove concatenation of `/static/library/images/` + filename.

- [ ] **Step 5: Run tests + manual checklist (Phase 5)**

Run: `pytest tests/test_routes.py -k "browse_games" -v`

Manual:

- Apply filters → AJAX cards show covers
- Game without image → default cover

- [ ] **Step 6: Commit**

```bash
git add gametheca/routes.py gametheca/routes_discover.py gametheca/setup/default_theme/js/library_pagination.js tests/test_routes.py
git commit -m "Return static url_for cover URLs for AJAX browse cards."
```

---

### Task 8: Phase 6 whole-diff review + final verification

**Files:**
- Review only (fix if issues found)

- [ ] **Step 1: Diff review checklist**

Verify across commits:

- [ ] No remaining ambiguous `platform` browse param
- [ ] `delete_folder` / `delete_full_game` always call `is_safe_path` before disk delete
- [ ] Scrapers use `request_with_backoff` only (no raw unprotected GETs in secondary scrapers)
- [ ] Both utilities enrichment sites call `apply_enriched_metadata`
- [ ] JS does not hardcode `/static/library/images/` + bare filename for browse cards
- [ ] API response shapes match `populateDropdown` field names

- [ ] **Step 2: Run combined automated suite**

Run:

```bash
pytest tests/test_routes_apis_filters.py tests/test_routes.py tests/test_utils_http_retry.py tests/test_utils_secondary_scrapers.py tests/test_utils_metadata_enrichment.py -v
```

Expected: all PASS

- [ ] **Step 3: Final manual E2E checklist**

- [ ] Browse: library + library_platform + igdb_platform + genre AND correctly
- [ ] Clear filters resets platform selects
- [ ] Safe delete under base works; unsafe denied
- [ ] Scan continues if Steam/RAWG fails
- [ ] Covers load after AJAX filter apply

- [ ] **Step 4: Fix any findings** (new focused commits; no scope expansion)

- [ ] **Step 5: Final commit only if fixes were needed**

```bash
git commit -m "Fix issues found in platform-filters hardening final review."
```

---

## Self-Review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Dual platform filters + used-only APIs | Tasks 1–3 |
| Remove broken `platform_id` join / explicit params | Task 2 |
| Path sanitization before rmtree | Task 4 |
| Scraper backoff / rate limit | Task 5 |
| Metadata savepoints (HTTP outside txn) | Task 6 |
| Static `url_for` covers for AJAX | Task 7 |
| Final whole review + tests | Task 8 |
| Non-goals respected | Global Constraints |

No TBD placeholders. Param names consistent: `library_platform`, `igdb_platform`. Helper names consistent: `request_with_backoff`, `apply_enriched_metadata`.
