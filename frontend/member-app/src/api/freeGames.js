import { csrfHeaders } from './csrf'
import { errorFromResponse } from './envelopeError'

export async function fetchFreeGames({ signal, store } = {}) {
  const params = new URLSearchParams({ limit: '40' })
  if (store) {
    params.set('store', store)
  }
  const response = await fetch(`/api/news/free-games?${params}`, {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw await errorFromResponse(response, 'free games')
  }

  return response.json()
}

export async function claimFreeGameAssist(offerId) {
  const response = await fetch(`/api/news/free-games/${offerId}/claim-assist`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders({ 'Content-Type': 'application/json' }),
    body: '{}',
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'claim assist')
  }
  return response.json().catch(() => ({}))
}
