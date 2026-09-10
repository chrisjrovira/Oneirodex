import { csrfHeaders } from './csrf.js'
import { errorFromResponse } from './envelopeError.js'

/** One API token as the server lists it. Extra fields are tolerated. */
export interface ApiToken {
  id: number
  name: string
  /** Short non-secret prefix shown in the list, e.g. `gt_ab12`. */
  token_prefix?: string
  created_at?: string | null
  last_used_at?: string | null
  scopes?: string[]
  [key: string]: unknown
}

/** One named scope preset the create form offers. */
export interface ScopePreset {
  label?: string
  scopes?: string[]
}

/** `GET /api/tokens` payload. */
export interface ListTokensResponse {
  tokens: ApiToken[]
  valid_scopes: string[]
  scope_presets: Record<string, ScopePreset>
}

/** Body for `POST /api/tokens`. */
export interface CreateTokenBody {
  name: string
  preset?: 'companion' | 'thin'
  scopes?: string[]
}

/** `POST /api/tokens` payload, with the one-time secret pulled onto `secret`. */
export interface CreateTokenResponse {
  token: ApiToken
  /** The one-time plaintext secret, normalised by {@link extractOneTimeSecret}. */
  secret: string
  raw?: string
  warning?: string
  [key: string]: unknown
}

export async function listTokens({
  signal,
}: { signal?: AbortSignal } = {}): Promise<ListTokensResponse> {
  const response = await fetch('/api/tokens', {
    credentials: 'same-origin',
    signal,
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'List tokens')
  }
  return response.json() as Promise<ListTokensResponse>
}

/**
 * One-time create payload secret only — never labels, prefix ellipsis, or HTML.
 * Prefers `raw`, then `secret`, then a string `token`. Outer whitespace only;
 * do not truncate at `-` (urlsafe secrets may include `-` / `_`).
 */
export function extractOneTimeSecret(data: unknown): string {
  if (!data || typeof data !== 'object') {
    return ''
  }
  const record = data as Record<string, unknown>
  const candidates = [record.raw, record.secret, record.token]
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const trimmed = candidate.trim()
    if (trimmed.startsWith('gt_')) {
      return trimmed
    }
  }
  return ''
}

export async function createToken(body: CreateTokenBody): Promise<CreateTokenResponse> {
  const response = await fetch('/api/tokens', {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'Create token')
  }
  const data = (await response.json()) as Record<string, unknown>
  const secret = extractOneTimeSecret(data)
  return {
    ...data,
    secret,
  } as CreateTokenResponse
}

export async function revokeToken(tokenId: number): Promise<unknown> {
  const response = await fetch(`/api/tokens/${tokenId}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: csrfHeaders(),
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'Revoke token')
  }
  return response.json()
}
