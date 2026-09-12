# Architecture (maintainer map)

Oneirodex is one Flask app (`oneirodex/`) plus three React SPAs and a typed HTTP client. This page is the map, not a rewrite of [ADR 0005](../adr/0005-api-client-is-the-requester.md) or [agent-locks.md](agent-locks.md).

## Runtime

| Piece                   | Role                                                                           |
| ----------------------- | ------------------------------------------------------------------------------ |
| Flask (`oneirodex/`)    | Session cookie, Jinja shells, `/api/**` + `/admin/api/**`, scans, play, social |
| member-app              | Household SPA (`frontend/member-app`)                                          |
| admin-app               | Operator SPA (`frontend/admin-app`)                                            |
| ops-glance              | Ops pulse widgets (`frontend/ops-glance`)                                      |
| `@oneirodex/api-client` | One requester, two transports (Bearer `gt_…` / browser cookie + CSRF)          |
| `@oneirodex/ui`         | Shared chrome, envelope helpers, CSRF lookup                                   |
| Desktop companion       | Tauri client on the Bearer transport                                           |

JSON errors go through `api_ok` / `api_error` (`oneirodex/utils/api_response.py`). Eleven sites stay off that helper on purpose — [api-envelope-keeps.md](api-envelope-keeps.md).

## SPA fetch

Admin, member, and ops sit on `createBrowserRequester`: `credentials: 'include'`, `X-CSRFToken` on mutating verbs, `onUnauthorized` → `/login`. Wrappers keep their exported names. Member collections CRUD now calls `createCollectionsApi` through that same requester (`memberResource`); search still uses `getJson` on `/api/search`. Other resource groups still call `getJson`/`postJson` directly.

Member leftovers that are not JSON verbs:

- `preferences.ts` — HTML `POST /settings_panel` (FormData)
- Activity / scan toasts — `EventSource` (`/api/activity/stream`)

Request bodies adopt `@validate_body` **file-by-file** — [pydantic-adoption.md](pydantic-adoption.md). Partial-success batch routes use `@validate_batch_body` so the 422 keeps `updated` / `skipped` / `errors` / `limit`. Do not wrap those with the flat helper.

## Identifiers (ADR 0003)

Runtime env is **`ONEIRODEX_*` only**. `GT_*` is not read. `LEGACY_NAME = 'GameTheca'` stays so stock themes authored by older versions are still recognised. On-wire API tokens keep the `gt_` prefix. Danger-zone confirm is `RESET ONEIRODEX` (no legacy alias).

## Frozen / do not drive-by

- `oneirodex/updateschema.py` — historical SQL; Alembic is the migrator
- Shims: `oneirodex/utilities.py`, `oneirodex/utils/functions.py`, `oneirodex/utils/game_core.py`
- Envelope keep-list of 11
- Mega pages (GameDetails, Library, Chat, Discover) stay typed in place — no decomposition PRs
