import { errorFromResponse } from './envelopeError'

export async function fetchFavoriteGames(params = {}, { signal } = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  )
  const suffix = qs.toString() ? `?${qs}` : ''
  const response = await fetch(`/api/favorites${suffix}`, {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw await errorFromResponse(response, 'favorites')
  }

  return response.json()
}
