/** Catalog / hub hrefs for details taxonomy chips. */

const PC_LIBRARY_PLATFORMS = new Set(['PCWIN', 'PCDOS', 'MAC', 'OTHER'])

/**
 * @param {'genre' | 'theme' | 'game_mode' | 'player_perspective'} kind
 * @param {string} name
 */
export function taxonomyHref(kind, name) {
  const value = encodeURIComponent(name)
  switch (kind) {
    case 'genre':
      return `/discover/hub/genre/${value}`
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
