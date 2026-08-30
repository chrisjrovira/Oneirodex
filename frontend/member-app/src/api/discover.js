import { errorFromResponse } from './envelopeError'

export async function fetchDiscoverSections({ signal } = {}) {
  const response = await fetch('/api/discover/sections', {
    credentials: 'same-origin',
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'discover sections')
  }
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new Error('discover sections returned non-JSON (session expired or server error)')
  }
  const data = await response.json()
  const sections = Array.isArray(data.sections) ? data.sections : []
  // The token names this feed's dedupe record. Rows hand it back when they page
  // so their later tiles skip what the rows above already showed.
  const feedToken = data.feed_token || ''
  if (feedToken) {
    for (const section of sections) {
      section.feed_token = feedToken
    }
  }
  return sections
}

/**
 * One row's games, windowed.
 *
 * Backs both halves of a deep row: the shelf asking for the tiles past its
 * first window, and the row page paging through the whole thing.
 */
export async function fetchDiscoverRow(
  identifier,
  { offset = 0, limit, feedToken, signal } = {},
) {
  const params = new URLSearchParams({ offset: String(offset) })
  if (limit) {
    params.set('limit', String(limit))
  }
  if (feedToken) {
    params.set('feed_token', feedToken)
  }
  const response = await fetch(
    `/api/discover/rows/${encodeURIComponent(identifier)}?${params}`,
    {
      credentials: 'same-origin',
      signal,
      headers: { Accept: 'application/json' },
    },
  )
  if (!response.ok) {
    throw await errorFromResponse(response, 'discover row')
  }
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new Error('discover row returned non-JSON (session expired or server error)')
  }
  const data = await response.json()
  return {
    identifier: data.identifier || identifier,
    title: data.title || '',
    itemKind: data.item_kind || 'games',
    offset: Number(data.offset) || 0,
    limit: Number(data.limit) || 0,
    // Game rows answer with `games`, other kinds with `items`. Normalised to
    // one name here so callers do not repeat the branch.
    items: Array.isArray(data.games)
      ? data.games
      : Array.isArray(data.items)
        ? data.items
        : [],
    hasMore: Boolean(data.has_more),
    moreHref: data.more_href || '',
  }
}

/**
 * Virtual Discover shelves for one genre (unplayed / newest / loved).
 */
export async function fetchGenreHub(genre, { signal } = {}) {
  const response = await fetch(
    `/api/discover/hubs/genre/${encodeURIComponent(genre)}`,
    {
      credentials: 'same-origin',
      signal,
      headers: { Accept: 'application/json' },
    },
  )
  if (!response.ok) {
    throw await errorFromResponse(response, 'genre hub')
  }
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new Error('genre hub returned non-JSON (session expired or server error)')
  }
  const data = await response.json()
  return {
    genre: data.genre || genre,
    title: data.title || data.genre || 'Genre',
    catalogHref: data.catalog_href || '',
    sections: Array.isArray(data.sections) ? data.sections : [],
  }
}
