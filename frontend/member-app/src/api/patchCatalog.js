import { csrfHeaders } from './csrf'
import { errorFromResponse } from './envelopeError'

export async function searchPatchCatalog({ gameUuid, q, signal } = {}) {
  const params = new URLSearchParams()
  if (gameUuid) {
    params.set('game_uuid', gameUuid)
  }
  if (q) {
    params.set('q', q)
  }
  const response = await fetch(`/api/patch-catalog/search?${params}`, {
    credentials: 'same-origin',
    signal,
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'patch-catalog search')
  }
  return response.json().catch(() => ({}))
}

export async function attachPatchCatalogGuide(body) {
  const response = await fetch('/api/patch-catalog/attach', {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'patch-catalog attach')
  }
  return response.json().catch(() => ({}))
}
