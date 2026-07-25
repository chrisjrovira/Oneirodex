const FILTER_SOURCES = {
  libraries: '/api/get_libraries',
  libraryPlatforms: '/api/library_platforms',
  igdbPlatforms: '/api/igdb_platforms',
  genres: '/api/genres',
  themes: '/api/themes',
  gameModes: '/api/game_modes',
  playerPerspectives: '/api/player_perspectives',
}

async function fetchFilterSource(url, signal) {
  const response = await fetch(url, {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw new Error(`${url} ${response.status}`)
  }

  return response.json()
}

export async function fetchFilterOptions({ signal } = {}) {
  const entries = await Promise.all(
    Object.entries(FILTER_SOURCES).map(async ([name, url]) => [
      name,
      await fetchFilterSource(url, signal),
    ]),
  )

  return Object.fromEntries(entries)
}
