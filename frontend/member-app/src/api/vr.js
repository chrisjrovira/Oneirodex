import { errorFromResponse } from './envelopeError'

export async function fetchVrCatalog({ signal, page = 1, perPage = 48 } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  })
  const response = await fetch(`/api/vr/catalog?${params}`, {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw await errorFromResponse(response, 'vr/catalog')
  }

  return response.json()
}

export async function fetchVrGame(gameUuid, { signal } = {}) {
  const response = await fetch(`/api/vr/games/${encodeURIComponent(gameUuid)}`, {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw await errorFromResponse(response, 'vr/games')
  }

  return response.json()
}
