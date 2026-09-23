import { BADGE_FILTER_PARAMS, badgeFiltersFromSearchParams } from './components/BadgeFilterChips'
import { itemKindFromSearchParams } from './components/ItemKindFilterChips'

/** Every filter the catalog reads from the URL.
 *
 * Values are optional because the chip helpers spread in a key only when the
 * param is present, and `cleanFilters` strips the empties before they reach
 * the browse request anyway. */
export type LibraryFilters = Record<string, string | undefined>

/**
 * URL query params -> the library's filter object, and back again.
 *
 * Lifted out of `LibraryApp` when adding `filter_tree` (INSP-29) pushed that
 * file past the 600-line component ratchet. They are pure functions over
 * `URLSearchParams` with no React in them, so they belong beside the chips
 * they compose rather than inside a page component.
 *
 * Both are **allow-lists**, which is the thing to remember when adding a
 * param: one missing from them is not an error anywhere -- the page simply
 * opens unfiltered, which reads as "the filter matched everything" rather
 * than as a bug.
 */

export function filtersFromSearchParams(searchParams: URLSearchParams): LibraryFilters {
  const next: LibraryFilters = {
    ...badgeFiltersFromSearchParams(searchParams),
    ...itemKindFromSearchParams(searchParams),
  }
  const libraryPlatform = searchParams.get('library_platform')
  if (libraryPlatform) {
    next.library_platform = libraryPlatform
  }
  const playMode = searchParams.get('play_mode')
  if (playMode) {
    next.play_mode = playMode
  }
  const genre = searchParams.get('genre')
  if (genre) {
    next.genre = genre
  }
  const theme = searchParams.get('theme')
  if (theme) {
    next.theme = theme
  }
  const gameMode = searchParams.get('game_mode')
  if (gameMode) {
    next.game_mode = gameMode
  }
  const perspective = searchParams.get('player_perspective')
  if (perspective) {
    next.player_perspective = perspective
  }
  const name = (searchParams.get('name') || searchParams.get('q') || '').trim()
  if (name) {
    next.name = name
  }
  // INSP-29: a smart collection is a saved filter opened as a link, so the
  // tree has to survive the URL. Passed through verbatim -- the server is the
  // one that validates it, and a tree it refuses comes back as a 400 naming
  // the offending part rather than being quietly ignored here.
  const filterTree = (searchParams.get('filter_tree') || '').trim()
  if (filterTree) {
    next.filter_tree = filterTree
  }
  return next
}

export function searchParamsHaveLibraryFilters(searchParams: URLSearchParams): boolean {
  if (
    searchParams.has('library_platform') ||
    searchParams.has('play_mode') ||
    searchParams.has('genre') ||
    searchParams.has('theme') ||
    searchParams.has('game_mode') ||
    searchParams.has('player_perspective') ||
    searchParams.has('item_kind') ||
    searchParams.has('content_kind') ||
    searchParams.has('name') ||
    searchParams.has('q') ||
    searchParams.has('filter_tree')
  ) {
    return true
  }
  return BADGE_FILTER_PARAMS.some((param) => searchParams.has(param))
}
