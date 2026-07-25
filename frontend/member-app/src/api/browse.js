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
    throw new Error(`browse_games ${response.status}`)
  }

  return response.json()
}
