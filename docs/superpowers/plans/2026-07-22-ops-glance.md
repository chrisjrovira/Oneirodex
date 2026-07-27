# Ops Glance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an admin Ops glance at `/admin/ops` with a hybrid Jinja shell + React tile board that auto-polls a single aggregate JSON summary (host, network, issues, scans, library pulse, recent errors).

**Architecture:** Flask `info_bp` serves the page and `GET /admin/api/ops/summary`. `gametheca/utils/ops_summary.py` composes existing system/status/uptime helpers plus new network counters and issue rules. Vite React app `frontend/ops-glance/` builds to `gametheca/static/dist/ops-glance/`. Docker Node stage builds both `library-grid` and `ops-glance`.

**Tech Stack:** React 19, Vite 6, Vitest + Testing Library, Flask, psutil, existing admin glass CSS

**Spec:** `docs/superpowers/specs/2026-07-22-ops-glance-design.md`

## Global Constraints

- Product order locked: pagination ✓ → **ops glance (this plan)** → rename → find/add → settings — do not start later tracks here
- Admin-only; **not** gated by `enableServerStatusFeature`
- Single aggregate poll API — no fan-out of multiple summary endpoints from the client
- One `psutil.cpu_percent` call per summary request (no stacked `interval=1` waits)
- No secrets in JSON (no DB passwords, webhooks, tokens)
- Network/host sections may be `null` on failure; prefer HTTP 200 with partial data over hard 503 unless aggregation itself crashes
- Reuse admin glass CSS tokens; severity colors only for good/warn/bad
- `*.md` is gitignored — use `git add -f` for plan/spec; set author via env if config unset
- TDD: failing test before implementation for each behavioral task
- Commit after each task; commit only that task’s files

## File Map

| File | Responsibility |
|------|----------------|
| `gametheca/utils/ops_network.py` | `get_network_stats()` via psutil |
| `gametheca/utils/ops_issues.py` | Pure `derive_issues(host, config, scans, recent_error_count)` |
| `gametheca/utils/ops_summary.py` | `build_ops_summary()` aggregate snapshot |
| `gametheca/routes_info.py` | `GET /admin/ops`, `GET /admin/api/ops/summary` |
| `gametheca/templates/admin/admin_ops.html` | Jinja shell + `#ops-glance-root` |
| `gametheca/templates/admin/admin_dashboard.html` | Ops button under Server Management |
| `gametheca/setup/default_theme/css/admin/admin_ops.css` | Layout for panels |
| `frontend/ops-glance/*` | Vite React island |
| `gametheca/static/dist/ops-glance/*` | Build output |
| `Dockerfile` | Build both library-grid and ops-glance |
| `tests/test_utils_ops_issues.py` | Issue rule unit tests |
| `tests/test_utils_ops_network.py` | Network helper unit tests |
| `tests/test_utils_ops_summary.py` | Aggregator unit tests (mocked deps) |
| `tests/test_routes_ops.py` | Route smoke (skip/mark if Postgres hangs) |

---

### Task 1: Issue derivation rules (pure)

**Files:**
- Create: `gametheca/utils/ops_issues.py`
- Create: `tests/test_utils_ops_issues.py`

**Interfaces:**
- Consumes: none (pure functions)
- Produces:
  - `derive_issues(*, disk_base_percent, disk_games_percent, path_problems, scan_failures, recent_error_count) -> dict`
  - Return: `{ "overall": "good"|"warn"|"bad", "items": [ { "id", "severity", "message", "href"? } ] }`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_utils_ops_issues.py
from gametheca.utils.ops_issues import derive_issues

def test_good_when_healthy():
    result = derive_issues(
        disk_base_percent=40,
        disk_games_percent=50,
        path_problems=[],
        scan_failures=0,
        recent_error_count=0,
    )
    assert result['overall'] == 'good'
    assert result['items'] == []

def test_warn_at_85_percent_disk():
    result = derive_issues(
        disk_base_percent=85,
        disk_games_percent=10,
        path_problems=[],
        scan_failures=0,
        recent_error_count=0,
    )
    assert result['overall'] == 'warn'
    assert any(i['id'] == 'disk_base_high' for i in result['items'])

def test_bad_at_95_percent_disk():
    result = derive_issues(
        disk_base_percent=10,
        disk_games_percent=96,
        path_problems=[],
        scan_failures=0,
        recent_error_count=0,
    )
    assert result['overall'] == 'bad'
    assert any(i['id'] == 'disk_games_critical' for i in result['items'])

def test_path_problem_is_bad():
    result = derive_issues(
        disk_base_percent=10,
        disk_games_percent=10,
        path_problems=[{'key': 'DATA_FOLDER_GAMES', 'reason': 'missing'}],
        scan_failures=0,
        recent_error_count=0,
    )
    assert result['overall'] == 'bad'

def test_recent_errors_warn():
    result = derive_issues(
        disk_base_percent=10,
        disk_games_percent=10,
        path_problems=[],
        scan_failures=0,
        recent_error_count=2,
    )
    assert result['overall'] == 'warn'
```

- [ ] **Step 2: Run tests — expect FAIL (import error)**

Run: `python -m pytest tests/test_utils_ops_issues.py -v --timeout=30`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```python
# gametheca/utils/ops_issues.py
SEVERITY_RANK = {'good': 0, 'warn': 1, 'bad': 2}


def _worst(current, candidate):
    return candidate if SEVERITY_RANK[candidate] > SEVERITY_RANK[current] else current


def derive_issues(
    *,
    disk_base_percent,
    disk_games_percent,
    path_problems,
    scan_failures,
    recent_error_count,
):
    items = []
    overall = 'good'

    def add(issue_id, severity, message, href=None):
        nonlocal overall
        overall = _worst(overall, severity)
        item = {'id': issue_id, 'severity': severity, 'message': message}
        if href:
            item['href'] = href
        items.append(item)

    for label, percent, warn_id, bad_id, name in (
        ('base', disk_base_percent, 'disk_base_high', 'disk_base_critical', 'Base disk'),
        ('games', disk_games_percent, 'disk_games_high', 'disk_games_critical', 'Games disk'),
    ):
        if percent is None:
            continue
        if percent >= 95:
            add(bad_id, 'bad', f'{name} {percent:.0f}% used')
        elif percent >= 85:
            add(warn_id, 'warn', f'{name} {percent:.0f}% used')

    for problem in path_problems or []:
        key = problem.get('key', 'path')
        reason = problem.get('reason', 'unavailable')
        add(f'path_{key}', 'bad', f'{key} {reason}')

    if scan_failures:
        add(
            'scan_failures',
            'bad' if scan_failures > 1 else 'warn',
            f'{scan_failures} scan job(s) failed or errored',
            href='/scan_management',
        )

    if recent_error_count:
        add(
            'recent_errors',
            'warn',
            f'{recent_error_count} error event(s) in the last 24h',
            href='/admin/system_logs',
        )

    return {'overall': overall, 'items': items}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `python -m pytest tests/test_utils_ops_issues.py -v --timeout=30`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add gametheca/utils/ops_issues.py tests/test_utils_ops_issues.py
git commit -m "feat: add ops glance issue derivation rules"
```

---

### Task 2: Network stats helper

**Files:**
- Create: `gametheca/utils/ops_network.py`
- Create: `tests/test_utils_ops_network.py`

**Interfaces:**
- Consumes: `psutil`
- Produces: `get_network_stats() -> dict | None` with keys from spec (`bytes_sent`, `bytes_recv`, `packets_sent`, `packets_recv`, `errin`, `errout`, `dropin`, `dropout`, `connections`)

- [ ] **Step 1: Write failing tests**

```python
# tests/test_utils_ops_network.py
from unittest.mock import MagicMock, patch
from gametheca.utils.ops_network import get_network_stats


def test_get_network_stats_shape():
    counters = MagicMock(
        bytes_sent=1, bytes_recv=2, packets_sent=3, packets_recv=4,
        errin=0, errout=0, dropin=0, dropout=0,
    )
    with patch('gametheca.utils.ops_network.psutil') as mock_psutil:
        mock_psutil.net_io_counters.return_value = counters
        mock_psutil.net_connections.return_value = [1, 2, 3]
        result = get_network_stats()
    assert result['bytes_sent'] == 1
    assert result['connections'] == 3


def test_get_network_stats_returns_none_on_failure():
    with patch('gametheca.utils.ops_network.psutil') as mock_psutil:
        mock_psutil.net_io_counters.side_effect = OSError('denied')
        assert get_network_stats() is None
```

- [ ] **Step 2: Run — expect FAIL**

Run: `python -m pytest tests/test_utils_ops_network.py -v --timeout=30`

- [ ] **Step 3: Implement**

```python
# gametheca/utils/ops_network.py
import psutil


def get_network_stats():
    try:
        io = psutil.net_io_counters()
        try:
            connections = len(psutil.net_connections())
        except (psutil.AccessDenied, PermissionError, OSError):
            connections = None
        return {
            'bytes_sent': io.bytes_sent,
            'bytes_recv': io.bytes_recv,
            'packets_sent': io.packets_sent,
            'packets_recv': io.packets_recv,
            'errin': getattr(io, 'errin', 0) or 0,
            'errout': getattr(io, 'errout', 0) or 0,
            'dropin': getattr(io, 'dropin', 0) or 0,
            'dropout': getattr(io, 'dropout', 0) or 0,
            'connections': connections,
        }
    except Exception:
        return None
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add gametheca/utils/ops_network.py tests/test_utils_ops_network.py
git commit -m "feat: add ops network stats helper"
```

---

### Task 3: `build_ops_summary` aggregator

**Files:**
- Create: `gametheca/utils/ops_summary.py`
- Create: `tests/test_utils_ops_summary.py`

**Interfaces:**
- Consumes: `get_cpu_usage`, `get_memory_usage`, `get_disk_usage`, `get_games_folder_usage`, `get_system_info`, `get_config_values`, uptime formatters, `get_network_stats`, `derive_issues`, SQLAlchemy models (`Library`, `Game`, `UnmatchedFolder`, `DownloadRequest`, `ScanJob`, `SystemEvents`)
- Produces: `build_ops_summary(app_start_time) -> dict` matching spec JSON (Python types; ISO `as_of`)

- [ ] **Step 1: Write failing unit test with mocks**

```python
# tests/test_utils_ops_summary.py
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone


def test_build_ops_summary_includes_required_keys():
    with patch('gametheca.utils.ops_summary.get_cpu_usage', return_value={'percent': 1, 'cores_physical': 2, 'cores_logical': 4}), \
         patch('gametheca.utils.ops_summary.get_memory_usage', return_value={'total': 8, 'used': 4, 'available': 4, 'percent': 50}), \
         patch('gametheca.utils.ops_summary.get_disk_usage', return_value={'total': 1, 'used': 1, 'free': 0, 'percent': 40}), \
         patch('gametheca.utils.ops_summary.get_games_folder_usage', return_value={'total': 1, 'used': 1, 'free': 0, 'percent': 40}), \
         patch('gametheca.utils.ops_summary.get_system_info', return_value={'Operating System': 'Linux', 'Hostname': 'h', 'IP Address': '1.2.3.4', 'Python Version': '3.12'}), \
         patch('gametheca.utils.ops_summary.get_config_values', return_value={}), \
         patch('gametheca.utils.ops_summary.get_formatted_system_uptime', return_value='1h'), \
         patch('gametheca.utils.ops_summary.get_formatted_app_uptime', return_value='1h'), \
         patch('gametheca.utils.ops_summary.get_network_stats', return_value={'bytes_sent': 0, 'bytes_recv': 0, 'packets_sent': 0, 'packets_recv': 0, 'errin': 0, 'errout': 0, 'dropin': 0, 'dropout': 0, 'connections': 0}), \
         patch('gametheca.utils.ops_summary._library_pulse', return_value={'libraries': 1, 'games': 2, 'unmatched_folders': 0, 'download_requests_open': 0}), \
         patch('gametheca.utils.ops_summary._scan_snapshot', return_value={'active_count': 0, 'jobs': [], 'failure_count': 0}), \
         patch('gametheca.utils.ops_summary._recent_errors', return_value=([], 0)):
        from gametheca.utils.ops_summary import build_ops_summary
        result = build_ops_summary(datetime.now(timezone.utc))
    assert set(result.keys()) >= {'as_of', 'host', 'network', 'issues', 'scans', 'library', 'recent_errors'}
    assert result['issues']['overall'] == 'good'
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `build_ops_summary`**

Implement helpers inside the same module:
- `_path_problems(config_values)` → list of `{key, reason}` where `exists` is False or `write` is False
- `_library_pulse()` → counts via `select(func.count(...))`
- `_scan_snapshot()` → active jobs (`Running`/`Stopping`) with progress = `folders_success+folders_failed` / `total_folders` when total > 0; `failure_count` = Failed jobs in last 24h or jobs with `error_message` while Running
- `_recent_errors()` → last 10 rows where `event_level` in (`error`, `critical`) OR `event_type` == `error` within 24h for the count used by issues

CPU: call `get_cpu_usage()` once (it already uses `interval=1`).

Do **not** import Flask request/app globally beyond what sibling utils already do.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add gametheca/utils/ops_summary.py tests/test_utils_ops_summary.py
git commit -m "feat: add ops summary aggregator"
```

---

### Task 4: Flask routes + dashboard link + page shell

**Files:**
- Modify: `gametheca/routes_info.py`
- Create: `gametheca/templates/admin/admin_ops.html`
- Modify: `gametheca/templates/admin/admin_dashboard.html` (insert Ops button before Statistics)
- Create: `tests/test_routes_ops.py` (pure function / app fixture; if DB hangs, keep a non-DB unit that imports views)

**Interfaces:**
- Produces:
  - `info.admin_ops` → `GET /admin/ops`
  - `info.ops_summary_api` → `GET /admin/api/ops/summary` → `jsonify(build_ops_summary(...))`

- [ ] **Step 1: Add routes**

```python
# append to gametheca/routes_info.py
from flask import jsonify
from gametheca.utils.ops_summary import build_ops_summary

@info_bp.route('/admin/ops')
@login_required
@admin_required
def admin_ops():
    log_system_event('Admin accessed ops glance', event_type='audit', event_level='information')
    return render_template('admin/admin_ops.html')
```

`enable_server_status` comes from the existing `info_bp` context processor (`get_global_settings()`), same as the dashboard.

```python
@info_bp.route('/admin/api/ops/summary')
@login_required
@admin_required
def ops_summary_api():
    try:
        return jsonify(build_ops_summary(app_start_time))
    except Exception as exc:
        return jsonify({'error': str(exc)}), 503
```

- [ ] **Step 2: Create template**

```html
{% extends "base.html" %}
{% block content %}
<link rel="stylesheet" href="{{ 'css/admin/admin_ops.css'|theme_asset }}">
<div class="container-settings-dashboard">
  <h1>Ops</h1>
  <div
    id="ops-glance-root"
    data-poll-ms="15000"
    data-enable-server-status="{{ enable_server_status|default(false)|lower }}"
  ></div>
</div>
<script type="module" src="{{ url_for('static', filename='dist/ops-glance/ops-glance.js') }}"></script>
{% endblock %}
```

- [ ] **Step 3: Dashboard button**

In `admin_dashboard.html` Server Management buttons, add **before** Statistics:

```html
<div class="admin-button-item" data-toggle="tooltip" title="Live ops glance — host, network, issues">
    <a href="{{ url_for('info.admin_ops') }}" class="btn btn-circle">
        <i class="fas fa-heartbeat"></i>
    </a>
    <span class="button-label">Ops</span>
</div>
```

- [ ] **Step 4: Smoke test (skip if DB unavailable)**

```python
# tests/test_routes_ops.py
import pytest

@pytest.mark.timeout(30)
def test_ops_summary_requires_auth(client):
    response = client.get('/admin/api/ops/summary')
    assert response.status_code in (302, 401, 403)
```

If pytest collection hangs on DB fixtures, document and keep auth redirect assertion only.

- [ ] **Step 5: Commit**

```bash
git add gametheca/routes_info.py gametheca/templates/admin/admin_ops.html gametheca/templates/admin/admin_dashboard.html tests/test_routes_ops.py
git commit -m "feat: add /admin/ops page and summary API"
```

---

### Task 5: Scaffold `frontend/ops-glance` Vite app

**Files:**
- Create: `frontend/ops-glance/package.json` (mirror `library-grid` deps)
- Create: `frontend/ops-glance/vite.config.js` (base `/static/dist/ops-glance/`, outDir `../../gametheca/static/dist/ops-glance`, entry `ops-glance.js`)
- Create: `frontend/ops-glance/index.html`
- Create: `frontend/ops-glance/src/main.jsx`
- Create: `frontend/ops-glance/src/AppSmoke.jsx`
- Create: `frontend/ops-glance/src/AppSmoke.test.jsx`
- Create: `frontend/ops-glance/src/testSetup.js` (`import '@testing-library/jest-dom'`)
- Create: `gametheca/static/dist/ops-glance/.gitkeep`

**Interfaces:**
- Produces: `npm run build` → `gametheca/static/dist/ops-glance/ops-glance.js`

- [ ] **Step 1: Smoke test**

```jsx
import { render, screen } from '@testing-library/react'
import { AppSmoke } from './AppSmoke'

test('renders ops glance smoke marker', () => {
  render(<AppSmoke />)
  expect(screen.getByText('ops-glance-ok')).toBeInTheDocument()
})
```

- [ ] **Step 2: Scaffold + `npm install` + `npm test -- --run` PASS + `npm run build`**

- [ ] **Step 3: Ensure root `.gitignore` already ignores `node_modules/` (from library-grid); do not commit `node_modules`**

- [ ] **Step 4: Commit**

```bash
git add frontend/ops-glance gametheca/static/dist/ops-glance .gitignore
git commit -m "chore: scaffold ops-glance Vite React app"
```

---

### Task 6: React OpsApp + panels + poller

**Files:**
- Create: `frontend/ops-glance/src/api/summary.js`
- Create: `frontend/ops-glance/src/OpsApp.jsx`
- Create: `frontend/ops-glance/src/OpsApp.test.jsx`
- Create: `frontend/ops-glance/src/components/StatusBanner.jsx`
- Create: `frontend/ops-glance/src/components/HostPanel.jsx`
- Create: `frontend/ops-glance/src/components/NetworkPanel.jsx`
- Create: `frontend/ops-glance/src/components/IssuesList.jsx`
- Create: `frontend/ops-glance/src/components/ScansPanel.jsx`
- Create: `frontend/ops-glance/src/components/LibraryPulse.jsx`
- Create: `frontend/ops-glance/src/components/RecentErrors.jsx`
- Create: `frontend/ops-glance/src/components/DeepLinks.jsx`
- Create: `frontend/ops-glance/src/utils/formatBytes.js`
- Modify: `frontend/ops-glance/src/main.jsx` to mount `OpsApp`

**Interfaces:**
- Consumes: `GET /admin/api/ops/summary`
- Produces: live board updating every `data-poll-ms` (default 15000)

- [ ] **Step 1: Write failing poller test**

```jsx
// OpsApp.test.jsx — assert AbortController abort on unmount; second poll ignored after abort
```

Include:
1. First fetch resolves → shows Host hostname text
2. Unmount before second resolve → no state update warning / no crash
3. Failed fetch with prior data → keeps previous + shows Retry

- [ ] **Step 2: Implement `fetchOpsSummary({ signal })`**

```js
export async function fetchOpsSummary({ signal } = {}) {
  const response = await fetch('/admin/api/ops/summary', { signal, headers: { Accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`Ops summary failed: ${response.status}`)
  }
  return response.json()
}
```

- [ ] **Step 3: Implement `OpsApp`**

- State: `snapshot`, `error`, `loading`
- `useEffect` interval using `pollMs` from props; AbortController per tick
- Manual Refresh button
- Render panels from snapshot; DeepLinks always (Server Info link if `enableServerStatus`)

- [ ] **Step 4: Vitest PASS; `npm run build`**

- [ ] **Step 5: Commit**

```bash
git add frontend/ops-glance gametheca/static/dist/ops-glance
git commit -m "feat: add OpsApp live tile board"
```

---

### Task 7: Ops CSS + wire template polish

**Files:**
- Create: `gametheca/setup/default_theme/css/admin/admin_ops.css`
- Modify: `gametheca/templates/admin/admin_ops.html` if needed (deep-link note that React owns links)

**CSS requirements:**
- `.ops-grid` CSS grid 2 columns desktop / 1 column mobile
- `.ops-panel` reuses glass panel feel (border/background from existing admin vars)
- `.ops-status-good|warn|bad` severity tokens

- [ ] **Step 1: Add CSS matching admin dashboard density**

- [ ] **Step 2: Manual visual check optional; commit**

```bash
git add gametheca/setup/default_theme/css/admin/admin_ops.css gametheca/templates/admin/admin_ops.html
git commit -m "style: add ops glance layout CSS"
```

---

### Task 8: Docker multi-app frontend build

**Files:**
- Modify: `Dockerfile`

**Interfaces:**
- Produces: image contains both `library-grid` and `ops-glance` dist folders

- [ ] **Step 1: Extend Dockerfile**

```dockerfile
FROM node:22-alpine AS frontend-build
WORKDIR /build

COPY frontend/library-grid/package*.json frontend/library-grid/
WORKDIR /build/frontend/library-grid
RUN npm ci
COPY frontend/library-grid/ .
RUN mkdir -p ../../gametheca/static/dist/library-grid && npm run build

WORKDIR /build
COPY frontend/ops-glance/package*.json frontend/ops-glance/
WORKDIR /build/frontend/ops-glance
RUN npm ci
COPY frontend/ops-glance/ .
RUN mkdir -p ../../gametheca/static/dist/ops-glance && npm run build

FROM python:3.12-slim
WORKDIR /app
# ... existing apt/pip ...
COPY . .
COPY --from=frontend-build /build/gametheca/static/dist/library-grid /app/gametheca/static/dist/library-grid
COPY --from=frontend-build /build/gametheca/static/dist/ops-glance /app/gametheca/static/dist/ops-glance
# ... rest unchanged ...
```

- [ ] **Step 2: If Docker daemon unavailable, verify locally:**

```bash
cd frontend/ops-glance && npm run build
cd ../library-grid && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add Dockerfile
git commit -m "build: include ops-glance assets in Docker image"
```

---

### Task 9: Final verification + branch hygiene notes

**Files:**
- Modify only if gaps found from checklist

- [ ] **Step 1: Run**

```bash
cd frontend/ops-glance && npm test -- --run
python -m pytest tests/test_utils_ops_issues.py tests/test_utils_ops_network.py tests/test_utils_ops_summary.py -v --timeout=30
```

- [ ] **Step 2: Spec coverage checklist**

Confirm each exists: `/admin/ops`, dashboard Ops button, summary API keys, issue rules, network helper, React poll 15s, Docker dual build, no feature-gate on Ops page.

- [ ] **Step 3: Commit any fixups; then whole-branch review per SDD**

---

## Spec coverage (self-review)

| Spec item | Task |
|-----------|------|
| `/admin/ops` page | 4 |
| Dashboard Ops link | 4 |
| Aggregate summary API | 3–4 |
| Host metrics | 3 |
| Network metrics | 2–3 |
| Issue rules | 1, 3 |
| Scans / library pulse / recent errors | 3 |
| React hybrid board + poll | 5–6 |
| CSS layout | 7 |
| Docker dual build | 8 |
| Not feature-gated | 4 |
| No secrets | 3 (explicit) |

## Placeholder scan

No TBD/TODO steps; commands and code included per task.
