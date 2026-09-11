import { getJson, postJson } from './client'

export function buildTrailerParams(filters: LooseProps = {}) {
  const params = new URLSearchParams()
  const { library, genres, themes, dateFrom, dateTo } = filters

  if (library) {
    params.append('library_uuid', library)
  }
  if (Array.isArray(genres) && genres.length > 0) {
    params.append('genres', genres.join(','))
  }
  if (Array.isArray(themes) && themes.length > 0) {
    params.append('themes', themes.join(','))
  }
  if (dateFrom) {
    params.append('date_from', String(dateFrom))
  }
  if (dateTo) {
    params.append('date_to', String(dateTo))
  }

  return params
}

export async function fetchTrailerFilters({ signal }: LooseProps = {}) {
  return getJson('/api/trailers/filters', { signal, label: 'trailers/filters' })
}

/**
 * A 404 here means "nothing matched the filters", which is an empty result the
 * page renders rather than a failure, so it is returned instead of thrown.
 * Backend empty library also returns 200 with has_videos:false + empty/cta.
 */
export async function fetchRandomTrailer({ signal, filters }: LooseProps = {}) {
  const query = buildTrailerParams(filters).toString()
  try {
    return await getJson(`/api/trailers/random${query ? `?${query}` : ''}`, {
      signal,
      label: 'trailers/random',
    })
  } catch (err: any) {
    if (err?.status === 404) {
      const data = err.data && typeof err.data === 'object' ? err.data : {}
      return {
        has_videos: false,
        empty: true,
        code: data.code || 'no_trailers',
        message: data.message || 'No games with trailers found matching your filters',
        cta: data.cta || null,
      }
    }
    throw err
  }
}

export async function fetchAttractModeSettings({ signal }: LooseProps = {}) {
  return getJson('/api/attract-mode/settings', { signal, label: 'attract-mode/settings' })
}

export async function saveAttractModePreferences({ autoplay, filters }: LooseProps) {
  return postJson(
    '/api/attract-mode/user-override',
    { autoplay, filters },
    { label: 'attract-mode/user-override' },
  )
}
