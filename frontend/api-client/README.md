# @gametheca/api-client

Hand-written TypeScript client for GameTheca REST endpoints described in `docs/openapi/openapi.json`. No OpenAPI codegen or network-dependent tooling.

## Usage

```typescript
import { createGamethecaClient } from '@gametheca/api-client'

const client = createGamethecaClient({
  baseUrl: 'https://gametheca.example.com',
  getToken: () => 'gt_abc123_secret',
})

const tokens = await client.tokens.list()
const results = await client.browse.search('doom')
const inbox = await client.updates.inbox()
await client.playtime.startSession({ game_uuid: '…' })
```

## Covered endpoints

| Module | OpenAPI path | Notes |
|---|---|---|
| `tokens` | `GET/POST /api/tokens`, `DELETE /api/tokens/{id}` | Personal API tokens |
| `playtime` | `POST /api/playtime/sessions`, `POST /api/playtime/sessions/{id}/heartbeat`, `POST /api/playtime/sessions/{id}/stop`, `GET /api/playtime/me` | Session tracking; any authenticated API token (no extra scope beyond login) |
| `browse` | `GET /api/search`, `GET /api/collections` | Search + collection listing |
| `updates` | `GET /api/updates/inbox` | Freshness inbox |

## Auth

Pass a Bearer token via `getToken`. Tokens use the server format `gt_<prefix>_<secret>` (see OpenAPI `bearerAuth`).

## Development

```bash
cd frontend/api-client
npm install
npm test
npm run build
```

Types mirror OpenAPI component schemas where present; response bodies for list endpoints are typed loosely until schemas are expanded in `openapi.json`.
