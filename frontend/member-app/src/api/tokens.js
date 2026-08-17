import { csrfHeaders } from './csrf'
import { errorFromResponse } from './envelopeError'

/**
 * @returns {Promise<{
 *   tokens: Array<Record<string, unknown>>,
 *   valid_scopes: string[],
 *   scope_presets: Record<string, { label?: string, scopes?: string[] }>,
 * }>}
 */
export async function listTokens({ signal } = {}) {
  const response = await fetch('/api/tokens', {
    credentials: 'same-origin',
    signal,
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'List tokens')
  }
  return response.json()
}

/**
 * One-time create payload secret only — never labels, prefix ellipsis, or HTML.
 * Prefers `raw`, then `secret`, then a string `token`. Outer whitespace only;
 * do not truncate at `-` (urlsafe secrets may include `-` / `_`).
 *
 * @param {unknown} data
 * @returns {string}
 */
export function extractOneTimeSecret(data) {
  if (!data || typeof data !== 'object') {
    return ''
  }
  const record = /** @type {Record<string, unknown>} */ (data)
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

/**
 * @param {{ name: string, preset?: 'companion' | 'thin', scopes?: string[] }} body
 * @returns {Promise<{
 *   token: Record<string, unknown>,
 *   secret: string,
 *   raw?: string,
 *   warning?: string,
 * }>}
 */
export async function createToken(body) {
  const response = await fetch('/api/tokens', {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'Create token')
  }
  const data = await response.json()
  const secret = extractOneTimeSecret(data)
  return {
    ...data,
    secret,
  }
}

/** @param {number} tokenId */
export async function revokeToken(tokenId) {
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
