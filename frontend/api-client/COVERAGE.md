# `@oneirodex/api-client` endpoint coverage

What the typed client wraps today, and what a SPA adopting it in Phase 3
(Track B) will have to add. "Covered" means a `create<Name>Api` module with at
least a happy-path + error-path test; "partial" means some verbs of a group are
wrapped; "TODO" means no wrapper yet — call it through `client.request<T>(path,
init)` directly, or add a module.

The client models the real response envelope (`ok` / `error` / `error_code` /
`detail` / `message`) — see `src/types.ts` (`ApiErrorEnvelope`, `ApiOk<T>`,
`isApiError`) and `OneirodexApiError` (`.status`, `.error_code`, `.body`).

## Transports

| Transport | Factory | Auth | Use |
| --- | --- | --- | --- |
| Bearer (default) | `createRequester` / `createOneirodexClient` | `Authorization: Bearer gt_…` via `getToken` | desktop companion, thin client |
| Browser | `createBrowserRequester` | session cookie + `X-CSRFToken` (`credentials: 'include'`, `csrfToken()` injected), `onUnauthorized()` on 401 | member / admin / ops SPAs (Phase 3) |

## Resource modules

| Group | Module | Status | Methods | Notes |
| --- | --- | --- | --- | --- |
| Tokens | `tokens` | covered | `list`, `create`, `revoke` | `/api/tokens` |
| Playtime | `playtime` | covered | `startSession`, `heartbeatSession`, `stopSession`, `me` | |
| Browse / search | `browse` | partial | `search`, `listCollections` | search filters/facets not modelled |
| Updates | `updates` | covered | `inbox` | freshness inbox only; `/api/updates/wanted` TODO |
| Downloads | `downloads` | covered | `initiateGameDownload`, `listGameVersions` | Bearer + `write:download` |
| Device / presence | `device` | covered | `heartbeat`, `capabilities`, `ackCommands`, `nackCommands` | companion command transport |
| Library | `library` | covered | `list`, `get`, `getWatch`, `setWatch`, `reorder` | admin batch scan/edit/delete TODO |
| Game details | `game` | covered | `details`, `moreFrom`, `editions`, `screenshots` | freshness, saves, mods, cheats TODO |
| Collections | `collections` | covered | `list`, `create`, `get`, `update`, `remove`, `addItem`, `removeItem`, `reorderItems` | full CRUD |
| Discover | `discover` | covered | `sections`, `row`, `zone`, `genreHub`, `getPins`, `setPins` | |
| Account | `account` | partial | `summary`, `changePassword`, `setStockAvatar`, `listInvites`, `createInvite`, `deleteInvite` | multipart `POST /api/account/avatar` (file upload) TODO |
| Wishlist / favorites | `wishlist` | partial | `listRequests`, `createRequest`, `cancelRequest`, `setBatch`, `listFavorites`, `checkFavorite`, `toggleFavorite` | librarian resolve (`PATCH /api/requests/{id}`) TODO |

## Not yet wrapped (call `client.request` directly)

Chat / social (`/api/chat/**`), notifications, ownership imports
(`/api/ownership/**`), game servers, emulator profiles / BIOS / saves / cheats,
layouts, quality profiles, providers / metadata search, AI triage, admin
surfaces (`/api/admin/**`), activity / events SSE, RTC tokens.

Types are intentionally loose (`[key: string]: unknown` with the known fields
typed) matching the `src/types.ts` house style — tighten per group as
`docs/openapi/openapi.json` schemas expand.

## Follow-ups

- `docs/openapi/openapi.json` regen was out of scope for wave C3.7-client — the
  new groups above are not yet in the spec.
