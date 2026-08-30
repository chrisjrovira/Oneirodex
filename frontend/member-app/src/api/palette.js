import { errorFromResponse } from './envelopeError'

/**
 * Empty-state titles for the command palette: recently played + favourited here.
 */
export async function fetchPaletteSuggest({ signal, limit = 8 } = {}) {
  const params = new URLSearchParams()
  if (limit) params.set('limit', String(limit))
  const response = await fetch(`/api/palette/suggest?${params}`, {
    signal,
    credentials: 'same-origin',
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'palette suggest')
  }
  const data = await response.json()
  return {
    recent: Array.isArray(data.recent) ? data.recent : [],
    popular: Array.isArray(data.popular) ? data.popular : [],
  }
}
