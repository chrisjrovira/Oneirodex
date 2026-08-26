# Hardlinks · AI · VR · Custom layouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship feature-flagged detail-page layouts, Ollama AI triage/doctor-notes, hardlink preview/apply helpers, and a mobile VR browse page per `docs/superpowers/specs/2026-07-24-hardlinks-ai-vr-layouts-design.md`.

**Architecture:** Four independent modules (layouts, AI, hardlinks, VR), each with utils + API (+ admin/member UI). Flags mirror *arr/OIDC. AI and hardlink apply never run unless explicitly enabled.

**Tech Stack:** Flask, SQLAlchemy, pytest, requests (Ollama HTTP), Jinja admin/member pages, existing library-grid React island for details meta only (Jinja still owns most sections).

## Global Constraints

- AI never writes library/disk state (suggestions only).
- Hardlink apply requires both `ENABLE_HARDLINK_HELPERS` and `ALLOW_HARDLINK_APPLY`.
- VR APIs omit download/install URLs.
- No inline imports (repo rule) except documented optional circular cases.
- Do **not** git commit unless the user explicitly asks (user rule overrides plan commit steps).
- Workspace: `C:\Users\cephyrix_zyth\Desktop\gametheca`.

## File map

| Path | Responsibility |
|---|---|
| `gametheca/utils/detail_layouts.py` | Default section catalog, merge, validate |
| `gametheca/routes_apis/layouts.py` | GET/PUT `/api/layouts/detail` |
| `gametheca/templates/admin/detail_layout.html` | Admin reorder/toggles |
| `gametheca/utils/ai_assist.py` | Ollama client + triage/doctor prompts |
| `gametheca/routes_apis/ai_assist.py` | `/api/ai/triage`, `/api/ai/doctor-notes`, `/api/ai/status` |
| `gametheca/utils/hardlinks.py` | Preview + apply |
| `gametheca/routes_apis/storage.py` | `/api/storage/hardlink/preview\|apply` |
| `gametheca/templates/admin/storage.html` | Admin hardlink UI |
| `gametheca/routes_apis/vr.py` | `/api/vr/catalog`, `/api/vr/games/<uuid>` |
| `gametheca/templates/site/vr_browse.html` | Mobile catalog/detail |
| `gametheca/models.py` / `updateschema.py` / `config.py` / `.env.example` | Columns + flags |
| `tests/test_hardlinks_ai_vr_layouts.py` | Module tests |

---

### Task 1: Detail layouts (MVP)

**Files:**
- Create: `gametheca/utils/detail_layouts.py`
- Create: `gametheca/routes_apis/layouts.py`
- Create: `gametheca/templates/admin/detail_layout.html`
- Modify: `gametheca/models.py` (add `detail_layout` JSON on `GlobalSettings`)
- Modify: `gametheca/updateschema.py` (ADD COLUMN)
- Modify: `gametheca/routes_apis/__init__.py` (import `layouts`)
- Modify: `gametheca/routes_admin_ext/settings.py` (admin page route + settings shell entry)
- Modify: `gametheca/templates/games/game_details.html` (wrap sections with layout order/visibility)
- Modify: `gametheca/templates/admin/admin_dashboard.html` (Layouts button)
- Test: `tests/test_hardlinks_ai_vr_layouts.py`

**Interfaces:**
- Produces: `DEFAULT_SECTIONS: list[str]`, `get_detail_layout() -> dict`, `save_detail_layout(payload: dict) -> dict`, `merge_with_defaults(raw) -> dict`

- [ ] **Step 1: Write failing tests for layout merge + API**

```python
from gametheca.utils.detail_layouts import merge_with_defaults, DEFAULT_SECTIONS

def test_merge_appends_missing_sections():
    merged = merge_with_defaults({'sections': [{'id': 'summary', 'visible': False}]})
    ids = [s['id'] for s in merged['sections']]
    assert ids[0] == 'summary'
    assert set(ids) == set(DEFAULT_SECTIONS)
    assert next(s for s in merged['sections'] if s['id'] == 'summary')['visible'] is False
```

- [ ] **Step 2: Run test — expect FAIL (module missing)**

Run: `pytest tests/test_hardlinks_ai_vr_layouts.py::test_merge_appends_missing_sections -v`

- [ ] **Step 3: Implement `detail_layouts.py`**

```python
DEFAULT_SECTIONS = [
    'hero', 'actions', 'summary', 'metadata', 'screenshots', 'videos',
    'downloads', 'updates', 'extras', 'playtime', 'related',
]

def merge_with_defaults(raw: dict | None) -> dict:
    sections = []
    seen = set()
    for item in (raw or {}).get('sections') or []:
        sid = item.get('id')
        if sid in DEFAULT_SECTIONS and sid not in seen:
            sections.append({'id': sid, 'visible': bool(item.get('visible', True))})
            seen.add(sid)
    for sid in DEFAULT_SECTIONS:
        if sid not in seen:
            sections.append({'id': sid, 'visible': True})
    return {'sections': sections}

def validate_layout_payload(payload: dict) -> dict:
    # raise ValueError on unknown ids; empty sections => defaults
    ...
```

Persist via `GlobalSettings.detail_layout` (same pattern as `quality_profiles` / `arr_settings`).

- [ ] **Step 4: Wire API + admin page + game_details**

`GET /api/layouts/detail` → login_required, return `get_detail_layout()`.  
`PUT /api/layouts/detail` → admin_required, `save_detail_layout`.  
Admin template: fetch layout, up/down buttons + checkboxes, PUT on save.  
In `game_details.html`: load layout server-side (pass `detail_layout` from route that renders details) and wrap each major block in `{% if section_visible('summary') %}` using a small Jinja helper or precomputed ordered list of visible section ids.

- [ ] **Step 5: Run layout tests — expect PASS**

Run: `pytest tests/test_hardlinks_ai_vr_layouts.py -k layout -v`

---

### Task 2: AI assist (Ollama)

**Files:**
- Create: `gametheca/utils/ai_assist.py`
- Create: `gametheca/routes_apis/ai_assist.py`
- Modify: `config.py`, `.env.example` (`ENABLE_AI_ASSIST`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`)
- Modify: `gametheca/models.py` optional `enable_ai_assist` bool OR env-only (prefer env + GlobalSettings enable flag for consistency: `enable_ai_assist`, `ollama_base_url`, `ollama_model`)
- Modify: `gametheca/updateschema.py`
- Modify: integrations template or add `/admin/ai` page with test button
- Modify: `gametheca/routes_apis/__init__.py`
- Test: same test file (mocked `requests.post`)

**Interfaces:**
- Produces: `ai_enabled() -> bool`, `ollama_status() -> dict`, `triage_folder(name: str, platform: str | None) -> dict`, `doctor_notes(context: dict) -> dict`

- [ ] **Step 1: Failing tests with monkeypatched HTTP**

```python
def test_triage_parses_suggestions(app, monkeypatch):
    def fake_post(url, json=None, timeout=None):
        class R:
            status_code = 200
            def json(self):
                return {'message': {'content': '1. Celeste\n2. Celeste (2018)'}}
            text = 'ok'
        return R()
    monkeypatch.setattr('gametheca.utils.ai_assist.requests.post', fake_post)
    monkeypatch.setitem(app.config, 'ENABLE_AI_ASSIST', True)
    monkeypatch.setitem(app.config, 'OLLAMA_BASE_URL', 'http://ollama.test')
    with app.app_context():
        from gametheca.utils.ai_assist import triage_folder
        out = triage_folder('Celeste-[Repack]', 'PCWIN')
    assert out['suggestions']
```

- [ ] **Step 2: Implement client**

`requests.post(f'{base}/api/chat', json={'model': model, 'messages': [...], 'stream': False}, timeout=30)`.  
Parse numbered lines into `suggestions: [{rank, title}]`.  
`ai_enabled()`: config/env OR GlobalSettings.  
Status endpoint returns `{enabled, reachable, model}`.

- [ ] **Step 3: Routes**

`POST /api/ai/triage` — admin; resolve `UnmatchedFolder` by id or accept `folder_path`/`name`; call `triage_folder`; 403 if disabled; 503 on connection error.  
`POST /api/ai/doctor-notes` — admin; accept `game_uuid` and/or `issues: []`; build context from `Game` + optional health codes; call `doctor_notes`.  
`GET /api/ai/status` — admin.

- [ ] **Step 4: Admin UI** — enable toggle fields + Test connection calling `/api/ai/status`. Hook “Suggest matches” on unmatched UI if a simple button can call triage (optional minimal: status page only is OK if unmatched UI is hard to find — prefer add button near scan unmatched list if present).

- [ ] **Step 5: Run AI tests — PASS**

Run: `pytest tests/test_hardlinks_ai_vr_layouts.py -k ai -v`

---

### Task 3: Hardlink helpers

**Files:**
- Create: `gametheca/utils/hardlinks.py`
- Create: `gametheca/routes_apis/storage.py`
- Create: `gametheca/templates/admin/storage.html`
- Modify: `config.py`, `.env.example` (`ENABLE_HARDLINK_HELPERS`, `ALLOW_HARDLINK_APPLY`)
- Modify: admin dashboard + settings shell
- Modify: `gametheca/routes_apis/__init__.py`
- Test: hardlink preview/apply on `tmp_path` (same FS)

**Interfaces:**
- Produces: `preview_hardlink(source: str, dest: str) -> dict`, `apply_hardlink(source: str, dest: str) -> dict`

Preview dict keys exactly: `ok`, `same_volume`, `would_succeed`, `bytes_saved_estimate`, `reasons` (list[str]).

- [ ] **Step 1: Failing unit tests**

```python
def test_preview_missing_source(tmp_path):
    from gametheca.utils.hardlinks import preview_hardlink
    r = preview_hardlink(str(tmp_path / 'nope'), str(tmp_path / 'out'))
    assert r['would_succeed'] is False
    assert any('source' in x.lower() for x in r['reasons'])

def test_apply_requires_flags(app, tmp_path, monkeypatch):
    src = tmp_path / 'a.bin'; src.write_bytes(b'1234')
    dest = tmp_path / 'b.bin'
    monkeypatch.setitem(app.config, 'ENABLE_HARDLINK_HELPERS', True)
    monkeypatch.setitem(app.config, 'ALLOW_HARDLINK_APPLY', False)
    # API apply should 403
```

- [ ] **Step 2: Implement `hardlinks.py`**

Same-volume: compare `os.stat(source).st_dev` vs `os.stat(dest_parent).st_dev`.  
Writability: `os.access(dest_parent, os.W_OK)`.  
Apply: `os.link(source, dest)` after re-preview; on Windows use `os.link` (3.8+) or raise clear error.  
Log success via existing system event helper if available.

- [ ] **Step 3: Routes + admin `/admin/storage`**

Preview always available to admin when `ENABLE_HARDLINK_HELPERS`; apply needs both flags. Restrict paths with `is_safe_path` + `get_allowed_base_directories` like library_tools.

- [ ] **Step 4: Run hardlink tests — PASS**

Run: `pytest tests/test_hardlinks_ai_vr_layouts.py -k hardlink -v`

---

### Task 4: VR browse API + page

**Files:**
- Create: `gametheca/routes_apis/vr.py`
- Create: `gametheca/templates/site/vr_browse.html`
- Create: theme CSS `css/site/vr_browse.css` (default + setup/default_theme copy)
- Modify: `config.py`, `.env.example` (`ENABLE_VR_BROWSE`)
- Modify: `gametheca/routes_member.py` (`/vr`)
- Modify: `gametheca/templates/base.html` (sidebar link when flag on — pass `enable_vr_browse` via context processor or template check)
- Modify: `gametheca/routes_apis/__init__.py`
- Test: catalog + flag off

**Interfaces:**
- Produces: JSON catalog `{ games: [{uuid, name, cover_url}], page, pages, total }` and detail `{ uuid, name, cover_url, summary, size }`

- [ ] **Step 1: Failing API tests**

```python
def test_vr_catalog_flag_off(client, app, admin):
    app.config['ENABLE_VR_BROWSE'] = False
    # login admin
    assert client.get('/api/vr/catalog').status_code == 403
```

- [ ] **Step 2: Implement routes using `apply_game_access_filters` / cover lookup like browse API**

Reuse patterns from `routes_apis/browse.py` for cover URLs and pagination. No download fields.

- [ ] **Step 3: `/vr` page** — fetch catalog client-side; large cover cards; tap opens detail panel/page using `/api/vr/games/<uuid>`. Redirect to library if flag off.

- [ ] **Step 4: Sidebar + dashboard note**

- [ ] **Step 5: Run VR tests — PASS**

Run: `pytest tests/test_hardlinks_ai_vr_layouts.py -k vr -v`

---

### Task 5: Docs + verification

**Files:**
- Modify: `docs/strategy/progress.md` (private vault for competitive notes if needed)
- Modify: canvas `gametheca-competitive-roadmap.canvas.tsx`
- Modify: `.env.example` (all new flags documented)

- [ ] **Step 1: Run full new suite**

Run: `pytest tests/test_hardlinks_ai_vr_layouts.py -v`  
Expected: all PASS

- [ ] **Step 2: Update progress/competitive** — mark hardlinks/AI/VR/layouts as shipped at designed depth; note apply flag default off; VR browse-only.

- [ ] **Step 3: Update canvas rows** for those four features to success tones with accurate labels.

---

## Spec coverage check

| Spec requirement | Task |
|---|---|
| Layout order/visibility + admin UI + game_details | 1 |
| AI triage + doctor-notes + Ollama flags | 2 |
| Hardlink preview + gated apply + admin storage | 3 |
| VR catalog/detail API + `/vr` page | 4 |
| Tests + docs | 1–5 |
| Non-goals (native VR, AI writes, arr→hardlink) | Explicitly omitted |

## Placeholder scan

No TBD/TODO left in task steps. Commit steps omitted (user rule: commit only when asked).

---

Plan complete and saved to `docs/superpowers/plans/2026-07-24-hardlinks-ai-vr-layouts.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — implement in this session with checkpoints  

Which approach?
