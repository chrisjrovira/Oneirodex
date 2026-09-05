import { fetchBrowseGames } from '../api/browse'
import { fetchFilterOptions } from '../api/filters'

/** Covers per genre shelf. A shelf is a sample you scroll, not the genre. */
export const SHELF_SIZE = 30

/**
 * Filter keys a genre shelf inherits from the catalog bar.
 *
 * Deliberately a list rather than a spread of `filters`: `page`, `per_page`
 * and `sort` belong to the paged Tile view, and passing them through would
 * page a shelf — which is the bug this module exists to remove.
 */
const INHERITED_FILTER_KEYS = [
  'library_uuid',
  'library_platform',
  'igdb_platform',
  'item_kind',
  'name',
  'q',
  'theme',
  'game_mode',
  'player_perspective',
  'favorites',
  'signal',
]

export function shelfQuery(filters, genre) {
  const query = { genre, page: 1, per_page: SHELF_SIZE }
  for (const key of INHERITED_FILTER_KEYS) {
    const value = filters?.[key]
    if (value !== undefined && value !== null && value !== '') {
      query[key] = value
    }
  }
  return query
}

/**
 * Genre names for the shelves, in the order they should appear.
 *
 * `/api/filters/bundle` is the same list the Filters popover uses, so a genre
 * with nothing behind it never reaches the page and Grid cannot invent a shelf
 * the catalog cannot filter to.
 */
export async function fetchShelfGenres({ signal } = {}) {
  const options = await fetchFilterOptions({ signal })
  return (options.genres || [])
    .map((entry) => (typeof entry === 'string' ? entry : entry?.name))
    .filter((name) => typeof name === 'string' && name.trim() !== '')
}

export async function fetchShelfGames(filters, genre, { signal } = {}) {
  const payload = await fetchBrowseGames(shelfQuery(filters, genre), { signal })
  return {
    games: Array.isArray(payload?.games) ? payload.games : [],
    total: Number.isFinite(payload?.total) ? payload.total : 0,
  }
}
