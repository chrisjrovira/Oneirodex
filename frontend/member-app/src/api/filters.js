export async function fetchFilterOptions({ signal } = {}) {
  const response = await fetch('/api/filters/bundle', {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw new Error(`/api/filters/bundle ${response.status}`)
  }

  const data = await response.json()
  return {
    libraries: Array.isArray(data.libraries) ? data.libraries : [],
    libraryPlatforms: Array.isArray(data.libraryPlatforms) ? data.libraryPlatforms : [],
    igdbPlatforms: Array.isArray(data.igdbPlatforms) ? data.igdbPlatforms : [],
    genres: Array.isArray(data.genres) ? data.genres : [],
    themes: Array.isArray(data.themes) ? data.themes : [],
    gameModes: Array.isArray(data.gameModes) ? data.gameModes : [],
    playerPerspectives: Array.isArray(data.playerPerspectives)
      ? data.playerPerspectives
      : [],
  }
}
