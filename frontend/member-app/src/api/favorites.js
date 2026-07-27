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
    throw new Error(`favorites ${response.status}`)
  }

  return response.json()
}
