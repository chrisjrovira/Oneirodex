/** Catalog / hub hrefs for details taxonomy chips. */

const PC_LIBRARY_PLATFORMS = new Set(['PCWIN', 'PCDOS', 'MAC', 'OTHER'])

/**
 * Every taxonomy chip goes to the catalog, filtered.
 *
 * Genre used to divert to `/discover/hub/genre/…`, which is a curated set of
 * shelves rather than the list — so the one chip people reach for to answer
 * "what else do I have like this" was the one that could not answer it, and
 * the way out was a link buried in a sentence of body copy. The hub still
 * exists and Discover's own See all still reaches it.
 *
 * @param {'genre' | 'theme' | 'game_mode' | 'player_perspective'} kind
 * @param {string} name
 */
export function taxonomyHref(kind, name) {
  const value = encodeURIComponent(name)
  switch (kind) {
    case 'genre':
      return `/library?genre=${value}`
    case 'theme':
      return `/library?theme=${value}`
    case 'game_mode':
      return `/library?game_mode=${value}`
    case 'player_perspective':
      return `/library?player_perspective=${value}`
    default:
      return '/library'
  }
}

export function detailsRootCrumb(game) {
  const key = String(game?.library_platform || '').toUpperCase()
  if (key && !PC_LIBRARY_PLATFORMS.has(key)) {
    return { to: '/systems', label: 'Systems' }
  }
  return { to: '/library', label: 'Game Catalog' }
}

export function primaryGenreName(game) {
  const names = Array.isArray(game?.genres) ? game.genres : []
  return names[0] || ''
}
