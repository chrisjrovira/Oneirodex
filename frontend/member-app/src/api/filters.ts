import { getJson } from './client'

export async function fetchFilterOptions({ signal }: LooseProps = {}) {
  const data = await getJson('/api/filters/bundle', { signal, label: '/api/filters/bundle' })
  return {
    libraries: Array.isArray(data.libraries) ? data.libraries : [],
    libraryPlatforms: Array.isArray(data.libraryPlatforms) ? data.libraryPlatforms : [],
    igdbPlatforms: Array.isArray(data.igdbPlatforms) ? data.igdbPlatforms : [],
    genres: Array.isArray(data.genres) ? data.genres : [],
    themes: Array.isArray(data.themes) ? data.themes : [],
    gameModes: Array.isArray(data.gameModes) ? data.gameModes : [],
    playerPerspectives: Array.isArray(data.playerPerspectives) ? data.playerPerspectives : [],
  }
}
