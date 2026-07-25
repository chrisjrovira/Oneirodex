export async function fetchFavoriteGames({ signal } = {}) {
  const response = await fetch('/api/favorites', {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw new Error(`favorites ${response.status}`)
  }

  return response.json()
}
