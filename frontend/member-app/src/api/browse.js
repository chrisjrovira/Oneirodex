import { errorFromResponse } from './envelopeError'

export async function fetchBrowseGames(params, { signal } = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, value]) =>
      value !== undefined && value !== null && value !== ''),
  )
  const response = await fetch(`/browse_games?${qs}`, {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw await errorFromResponse(response, 'browse_games')
  }

  return response.json()
}
