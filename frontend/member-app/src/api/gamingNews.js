import { errorFromResponse } from './envelopeError'

export async function fetchGamingNews({ signal } = {}) {
  const response = await fetch('/api/news/gaming?limit=12', {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw await errorFromResponse(response, 'gaming news')
  }

  return response.json()
}
