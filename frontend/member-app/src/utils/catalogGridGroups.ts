import { primaryGenreName } from './detailsTaxonomy'

/**
 * Group catalog games into Steam-style genre shelves for Grid view.
 * Order of sections follows first appearance in the current page.
 */
export function groupCatalogGamesByGenre(games) {
  const list = Array.isArray(games) ? games : []
  const order = []
  const buckets = new Map()

  for (const game of list) {
    const label = primaryGenreName(game) || 'Uncategorized'
    if (!buckets.has(label)) {
      buckets.set(label, [])
      order.push(label)
    }
    buckets.get(label).push(game)
  }

  return order.map((title) => ({
    title,
    games: buckets.get(title) || [],
  }))
}
