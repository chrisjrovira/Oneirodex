# Hardlinks · AI · VR · Custom layouts — design

**Date:** 2026-07-24  
**Status:** Approved (user chose wave **B**, delivery shape **A**)  
**Branch:** `feature/roadmap-q1-foundation`

## Goals (this wave)

| Track | Depth |
|---|---|
| **Custom detail layouts** | Full MVP — section order + visibility only |
| **AI assist (Ollama)** | Full MVP — unmatched triage + library-doctor notes (suggestions only) |
| **Hardlinks** | Dry-run always; real apply behind extra admin flag |
| **VR browse** | API contract + mobile `/vr` catalog/detail page (Quest browser bar) |

## Non-goals

- Native Quest/Unity/Godot client or WebXR controller input  
- AI auto-applying IGDB matches or disk renames  
- *arr download → hardlink import pipeline  
- Hardlinks across Docker bind mounts that are not truly same volume  
- Live Authentik smoke / desktop code signing  

## Architecture (four modules)

Independent packages/routes, each feature-flagged like *arr / OIDC:

| Module | Flags | Key surfaces |
|---|---|---|
| Detail layouts | Always readable when authenticated; admin mutates | `GlobalSettings.detail_layout`, `GET/PUT /api/layouts/detail`, `/admin/detail_layout` |
| AI assist | `ENABLE_AI_ASSIST`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL` | `POST /api/ai/triage`, `POST /api/ai/doctor-notes`, Integrations UI |
| Hardlinks | `ENABLE_HARDLINK_HELPERS`, `ALLOW_HARDLINK_APPLY` | `POST /api/storage/hardlink/preview`, `…/apply`, `/admin/storage` |
| VR browse | `ENABLE_VR_BROWSE` | `GET /api/vr/catalog`, `GET /api/vr/games/<uuid>`, `/vr` |

Shared rules:

- Mutating settings / hardlink apply / AI ops endpoints are **admin-only**  
- AI never writes library or disk state  
- Hardlink apply re-validates preview checks and refuses RO / cross-volume  
- VR reuses existing library ACL; no download/install URLs in this wave  

## Custom layouts

### Section catalog (fixed IDs)

`hero`, `actions`, `summary`, `metadata`, `screenshots`, `videos`, `downloads`, `updates`, `extras`, `playtime`, `related`

### Storage

`GlobalSettings.detail_layout` JSON:

```json
{
  "sections": [
    { "id": "hero", "visible": true },
    { "id": "actions", "visible": true },
    { "id": "summary", "visible": true }
  ]
}
```

### Behavior

- `GET /api/layouts/detail` — any logged-in user; merges missing IDs from defaults (append, visible true)  
- `PUT /api/layouts/detail` — admin; reject unknown IDs (`400`); empty `sections` resets to defaults  
- Admin UI `/admin/detail_layout` — reorder + visibility toggles  
- Game details Jinja + `GameDetailsApp` island honor order/visibility (hide `visible: false`)  

## AI assist

### Client

`gametheca/utils/ai_assist.py` — HTTP to Ollama (`/api/chat`), configurable timeout, fail closed.

### Endpoints

- `POST /api/ai/triage` — input: unmatched folder id or path; output: ranked title suggestions + brief rationale. Context: folder basename, library platform. **No writes.**  
- `POST /api/ai/doctor-notes` — input: game uuid and/or health issue codes; output: plain-language explanation + suggested next steps. Context: existing health/doctor payload. **No writes.**  

### Admin

Integrations (or dedicated AI panel): enable flag, base URL, model, Test connection.  
If disabled or Ollama unreachable → `403` / `503` with clear message. Never blocks scan jobs.

## Hardlinks

### Preview

`POST /api/storage/hardlink/preview` with `{ "source": "...", "dest": "..." }` returns:

```json
{
  "ok": false,
  "same_volume": true,
  "would_succeed": false,
  "bytes_saved_estimate": 123456,
  "reasons": ["destination parent not writable"]
}
```

Checks: source exists; dest absent; same volume (Unix `st_dev` / Windows volume serial); dest parent writable.

### Apply

`POST /api/storage/hardlink/apply` requires **both** `ENABLE_HARDLINK_HELPERS` and `ALLOW_HARDLINK_APPLY`. Re-runs preview; then `os.link` (POSIX) / Windows hardlink API. Audit via system event log.

### Admin UI

`/admin/storage` — path fields, Preview, Apply (disabled unless apply flag on). Show Docker RO guidance when preview fails on writability.

## VR browse

### API

- `GET /api/vr/catalog?page=&per_page=` — ACL-filtered slim cards: `uuid`, `name`, `cover_url`  
- `GET /api/vr/games/<uuid>` — `name`, `cover_url`, `summary`, `size` (no download URLs)  

### UI

Member page `/vr` (flag on): large-tap cover grid → detail. Sidebar link when enabled. Mobile / Quest browser viewport; no WebXR controllers required.

When flag off: `/vr` redirects to library; VR APIs return `403`.

## Error handling

| Area | Behavior |
|---|---|
| AI off / unreachable | `403` / `503` |
| AI bad input | `400` |
| Hardlink preview | Always 200 with structured `reasons[]` when request valid |
| Hardlink apply blocked | `403` if flags off; `400` if preview would fail |
| Layout invalid IDs | `400` |
| VR ACL / missing | `403` / `404` |

## Tests

- Layout get/put + default merge + unknown id rejection  
- AI triage/doctor with mocked Ollama HTTP; disabled path  
- Hardlink preview same-volume / cross-volume / not-writable; apply gated by flag (tmp dirs on same FS)  
- VR catalog ACL + flag-off behavior  

## Implementation order

1. Detail layouts (model/schema + API + admin + game_details wiring)  
2. AI assist (client + endpoints + integrations UI + tests with mocks)  
3. Hardlink helpers (preview/apply + admin storage page)  
4. VR API + `/vr` page + sidebar flag  
5. Docs (`progress.md`, private competitive vault) + canvas refresh  

## Open operator notes

- Ollama must be reachable from the GameTheca host (`OLLAMA_BASE_URL`)  
- Hardlink apply is off by default even when helpers are enabled  
- VR is browse-only; companion install remains desktop/web  
