/* Helpers moved out of TrailersPage (v11 cycle, H-D.2) — unchanged. */

export const SETTINGS_STORAGE_KEY = 'trailerAutoplaySettings'
export const ATTRACT_RETURN_KEY = 'attractModeReturnUrl'
export const DEFAULT_SETTINGS = { enabled: true, skipFirst: 0, skipAfter: 0 }
export const EMPTY_FILTERS: TrailerFilters = {
  library: '',
  genres: [],
  themes: [],
  dateFrom: '',
  dateTo: '',
}

/** Mirrors the server-side whitelist in convert_to_embed_url; anything else is rejected. */
export const YOUTUBE_ID_PATTERNS = [
  /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
  /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
  /youtu\.be\/([a-zA-Z0-9_-]+)/,
]

export function youTubeVideoId(url: unknown): string | null {
  if (typeof url !== 'string') {
    return null
  }
  for (const pattern of YOUTUBE_ID_PATTERNS) {
    const match = url.match(pattern)
    if (match?.[1]) {
      return match[1]
    }
  }
  return null
}

export function buildEmbedSrc(videoId: string, skipFirst: number): string {
  const params = new URLSearchParams({
    autoplay: '1',
    rel: '0',
    modestbranding: '1',
    enablejsapi: '1',
  })
  if (skipFirst > 0) {
    params.set('start', String(skipFirst))
  }
  if (window.location?.origin) {
    params.set('origin', window.location.origin)
  }
  return `https://www.youtube.com/embed/${videoId}?${params}`
}

export let youTubeApiPromise: any = null

export function loadYouTubeApi() {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT)
  }
  if (youTubeApiPromise) {
    return youTubeApiPromise
  }

  youTubeApiPromise = new Promise((resolve) => {
    const previousCallback = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousCallback === 'function') {
        previousCallback()
      }
      resolve(window.YT)
    }

    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => resolve(null)
    document.head.appendChild(script)
  })

  return youTubeApiPromise
}

export interface TrailerSettings {
  enabled: boolean
  skipFirst: number
  skipAfter: number
}

export function normalizeSettings(raw: unknown): TrailerSettings {
  const r = (raw ?? {}) as Partial<Record<keyof TrailerSettings, unknown>>
  return {
    enabled: r.enabled !== false,
    skipFirst: Math.max(0, Number(r.skipFirst) || 0),
    skipAfter: Math.max(0, Number(r.skipAfter) || 0),
  }
}

export function readStoredSettings() {
  try {
    const saved = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    return saved ? normalizeSettings(JSON.parse(saved)) : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export interface TrailerFilters {
  library: string
  genres: string[]
  themes: string[]
  dateFrom: string
  dateTo: string
}

export function fromServerFilters(raw: unknown): TrailerFilters {
  const r = (raw ?? {}) as Record<string, unknown>
  return {
    library: r.library_uuid ? String(r.library_uuid) : '',
    genres: Array.isArray(r.genres) ? r.genres.map(String) : [],
    themes: Array.isArray(r.themes) ? r.themes.map(String) : [],
    dateFrom: r.date_from ? String(r.date_from) : '',
    dateTo: r.date_to ? String(r.date_to) : '',
  }
}

export function toServerFilters(filters: TrailerFilters) {
  return {
    library_uuid: filters.library || null,
    genres: filters.genres.map((id) => Number(id)),
    themes: filters.themes.map((id) => Number(id)),
    date_from: filters.dateFrom ? Number(filters.dateFrom) : null,
    date_to: filters.dateTo ? Number(filters.dateTo) : null,
  }
}

export function selectedValues(select: EventTarget | null) {
  if (!(select instanceof HTMLSelectElement)) return []
  return Array.from(select.selectedOptions).map((option) => option.value)
}

export interface TrailerOption {
  id: string | number
  name: string
}

export function labelsFor(
  options: TrailerOption[] | null | undefined,
  ids: Array<string | number>,
) {
  const wanted = new Set(ids.map(String))
  return (options || [])
    .filter((option) => wanted.has(String(option.id)))
    .map((option) => option.name)
}

/**
 * Renders the embed as a plain iframe so playback works even when the IFrame API
 * is unavailable, then binds a YT.Player to that same frame for the auto-advance
 * behaviour the Jinja page relied on.
 */
