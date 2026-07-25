function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]')
  if (meta?.content) {
    return meta.content
  }

  const input = document.querySelector('input[name="csrf_token"]')
  if (input?.value) {
    return input.value
  }

  return document.getElementById('csrf_token')?.textContent || ''
}

function csrfHeaders(additionalHeaders = {}) {
  if (window.CSRFUtils?.getHeaders) {
    return window.CSRFUtils.getHeaders(additionalHeaders)
  }

  return {
    'X-CSRFToken': getCsrfToken(),
    ...additionalHeaders,
  }
}

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
    throw new Error(`trailers/filters ${response.status}`)
  }

  return response.json()
}

/**
 * A 404 here means "nothing matched the filters", which is an empty result the
 * page renders rather than a failure, so it is returned instead of thrown.
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
      message: data.message || 'No games with trailers found matching your filters',
    }
  }

  if (!response.ok) {
    throw new Error(`trailers/random ${response.status}`)
  }

  return response.json()
}

export async function fetchAttractModeSettings({ signal } = {}) {
  const response = await fetch('/api/attract-mode/settings', {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw new Error(`attract-mode/settings ${response.status}`)
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
    throw new Error(`attract-mode/user-override ${response.status}`)
  }

  return response.json()
}
