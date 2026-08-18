import { csrfHeaders } from './csrf'
import { errorFromResponse } from './envelopeError'

export function buildTrailerParams(filters = {}) {
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

export async function fetchTrailerFilters({ signal } = {}) {
  const response = await fetch('/api/trailers/filters', {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw await errorFromResponse(response, 'trailers/filters')
  }

  return response.json()
}

/**
 * A 404 here means "nothing matched the filters", which is an empty result the
 * page renders rather than a failure, so it is returned instead of thrown.
 * Backend empty library also returns 200 with has_videos:false + empty/cta.
 */
export async function fetchRandomTrailer({ signal, filters } = {}) {
  const query = buildTrailerParams(filters).toString()
  const response = await fetch(`/api/trailers/random${query ? `?${query}` : ''}`, {
    signal,
    credentials: 'same-origin',
  })

  if (response.status === 404) {
    const data = await response.json().catch(() => ({}))
    return {
      has_videos: false,
      empty: true,
      code: data.code || 'no_trailers',
      message: data.message || 'No games with trailers found matching your filters',
      cta: data.cta || null,
    }
  }

  if (!response.ok) {
    throw await errorFromResponse(response, 'trailers/random')
  }

  return response.json()
}

export async function fetchAttractModeSettings({ signal } = {}) {
  const response = await fetch('/api/attract-mode/settings', {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw await errorFromResponse(response, 'attract-mode/settings')
  }

  return response.json()
}

export async function saveAttractModePreferences({ autoplay, filters }) {
  const response = await fetch('/api/attract-mode/user-override', {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ autoplay, filters }),
  })

  if (!response.ok) {
    throw await errorFromResponse(response, 'attract-mode/user-override')
  }

  return response.json()
}
