import { createWishlistApi } from '@oneirodex/api-client'

import { memberResource, withMemberError } from './client'

const wishlist = memberResource(createWishlistApi)

type FavoritesQuery = {
  page?: number | string
  per_page?: number | string
  name?: string
  item_kind?: string
}

const num = (v: number | string | undefined) =>
  v !== undefined && v !== '' ? Number(v) : undefined

/**
 * Favourited titles, paged and filtered. `params` keeps the pre-typed call
 * shape (`{ page, per_page, name, item_kind }`) so callers do not move; empty
 * values are dropped the way the old query builder dropped them.
 */
export async function fetchFavoriteGames(
  params: FavoritesQuery = {},
  { signal }: { signal?: AbortSignal } = {},
) {
  return withMemberError(
    wishlist.listFavorites({
      page: num(params.page),
      perPage: num(params.per_page),
      name: params.name || undefined,
      itemKind: params.item_kind || undefined,
      signal,
    }),
    'favorites',
  )
}
