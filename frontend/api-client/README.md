# @oneirodex/api-client

Hand-written TypeScript client for Oneirodex REST endpoints described in `docs/openapi/openapi.json`. No OpenAPI codegen or network-dependent tooling.

`createOneirodexClient` remains a same-factory alias of `createOneirodexClient` for one release.

## Usage (Bearer — desktop / thin client)

```typescript
import { createOneirodexClient } from '@oneirodex/api-client'

const client = createOneirodexClient({
  baseUrl: 'https://oneirodex.example.com',
  getToken: () => 'gt_abc123_secret',
})

const tokens = await client.tokens.list()
const results = await client.browse.search({ query: 'doom' })
const details = await client.game.details(gameUuid)
const feed = await client.discover.sections()
await client.playtime.startSession({ game_uuid: '…' })
```

## Usage (browser — same-origin SPA)

The SPAs authenticate with a session cookie, not a Bearer token.
`createBrowserRequester` sends `credentials: 'include'`, sets `X-CSRFToken` on
mutating requests from an injected getter, and calls `onUnauthorized` on a 401.
It does **not** import a SPA's token store — the SPA passes the getter in.

```typescript
import { createBrowserRequester, createCollectionsApi } from '@oneirodex/api-client'

const request = createBrowserRequester({
  baseUrl: '', // same origin
  csrfToken: () => readCsrfTokenFromMeta(),
  onUnauthorized: () => {
    location.href = '/login'
  },
})
const collections = createCollectionsApi(request)
```

## The response envelope

Every route replies through the `api_ok` / `api_error` envelope
(`oneirodex/utils/api_response.py`): `{ ok, error, error_code, detail?, message?
}`. The client models it:

- `ApiOk<T>` — `T & { ok: true; error: null; error_code: null }`
- `ApiErrorEnvelope` — `{ ok: false; error: string; error_code: string | null; detail?; message? }`
- `isApiError(body)` — discriminates the two
- `OneirodexApiError` (thrown on any non-2xx) carries `.status`, `.error_code`
  (the stable `snake_case` token from `ERROR_CODES`, or `null`), `.message` (the
  human `error` string) and `.body` (the parsed envelope).

## Auth

Bearer transport: pass a token via `getToken`, server format
`gt_<prefix>_<secret>` (OpenAPI `bearerAuth`). Browser transport: session
cookie + `X-CSRFToken`.

## Covered endpoints

`tokens`, `playtime`, `browse`, `updates`, `downloads`, `device`, `library`,
`game`, `collections`, `discover`, `account`, `wishlist`. See
[`COVERAGE.md`](./COVERAGE.md) for the per-group method list, partial/TODO
status, and what a Phase 3 SPA adoption still has to add.

## Development

```bash
cd frontend/api-client
npm install
npm test
npm run build
```

Types mirror OpenAPI component schemas where present; response bodies for list endpoints are typed loosely until schemas are expanded in `openapi.json`.
