import type { Requester } from './client.js'

export interface GameRequestRow {
  id: number
  title: string
  notes?: string | null
  status: string
  linked_game_uuid?: string | null
  created_at?: string
  [key: string]: unknown
}

export interface ListRequestsResponse {
  requests: GameRequestRow[]
  [key: string]: unknown
}

export interface CreateRequestBody {
  title: string
  notes?: string
}

export interface ListRequestsOptions {
  /** Librarian: every member's queue, not just the caller's. */
  all?: boolean
  signal?: AbortSignal
}

export interface ResolveRequestBody {
  status: string
  notes?: string
  linked_game_uuid?: string
}

export interface BatchWishlistResponse {
  updated: Array<{ uuid: string; [key: string]: unknown }>
  skipped: Array<{ uuid: string; reason?: string }>
  errors: Array<{ uuid: string; error?: string }>
  limit: number
  action?: 'add' | 'remove'
  [key: string]: unknown
}

export interface FavoritesPage {
  games?: Array<{ uuid: string; name: string; [key: string]: unknown }>
  page?: number
  per_page?: number
  total?: number
  [key: string]: unknown
}

export interface FavoritesOptions {
  page?: number
  perPage?: number
  /** Title substring filter (server `apply_name_filter`). */
  name?: string
  /** `game` / `tool` / … (server `apply_item_kind_filter`). */
  itemKind?: string
  signal?: AbortSignal
}

export function createWishlistApi(request: Requester) {
  return {
    /**
     * This member's wishlist / request queue (`GET /api/requests`). A librarian
     * passes `all: true` for every member's queue (`?all=1`); the server still
     * decides whether the caller may see it.
     */
    listRequests(opts: ListRequestsOptions | AbortSignal = {}): Promise<ListRequestsResponse> {
      const o: ListRequestsOptions = opts instanceof AbortSignal ? { signal: opts } : opts
      return request<ListRequestsResponse>(o.all ? '/api/requests?all=1' : '/api/requests', {
        signal: o.signal,
      })
    },

    /** Add a free-text wishlist request (`POST /api/requests`). */
    createRequest(body: CreateRequestBody): Promise<GameRequestRow> {
      return request<GameRequestRow>('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    },

    /** Cancel an own pending request (`DELETE /api/requests/{id}`). */
    cancelRequest(requestId: number): Promise<{ ok: boolean; id: number }> {
      return request<{ ok: boolean; id: number }>(`/api/requests/${requestId}`, {
        method: 'DELETE',
      })
    },

    /**
     * Librarian resolve (`PATCH /api/requests/{id}`): set `status`, optionally a
     * note and the library title it was fulfilled by. Was the one TODO on this
     * module; the member SPA's `resolveRequest` sits on it now.
     */
    resolveRequest(requestId: number, body: ResolveRequestBody): Promise<GameRequestRow> {
      return request<GameRequestRow>(`/api/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    },

    /**
     * Queue / unqueue wishlist rows for library titles by uuid
     * (`POST /api/games/batch/wishlist`). Cap 50. `action` defaults to `add`.
     */
    setBatch(uuids: string[], action: 'add' | 'remove' = 'add'): Promise<BatchWishlistResponse> {
      return request<BatchWishlistResponse>('/api/games/batch/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuids, action }),
      })
    },

    /** Paginated favorites list (`GET /api/favorites`). */
    listFavorites(opts: FavoritesOptions = {}): Promise<FavoritesPage> {
      const params = new URLSearchParams()
      if (opts.page) params.set('page', String(opts.page))
      if (opts.perPage) params.set('per_page', String(opts.perPage))
      if (opts.name) params.set('name', opts.name)
      if (opts.itemKind) params.set('item_kind', opts.itemKind)
      const qs = params.toString()
      return request<FavoritesPage>(`/api/favorites${qs ? `?${qs}` : ''}`, { signal: opts.signal })
    },

    /** Is this game a favorite? (`GET /api/check_favorite/{uuid}`). */
    checkFavorite(gameUuid: string): Promise<{ is_favorite: boolean }> {
      return request<{ is_favorite: boolean }>(
        `/api/check_favorite/${encodeURIComponent(gameUuid)}`,
      )
    },

    /** Toggle favorite state (`POST /api/toggle_favorite/{uuid}`). */
    toggleFavorite(gameUuid: string): Promise<{ ok: boolean; is_favorite: boolean }> {
      return request<{ ok: boolean; is_favorite: boolean }>(
        `/api/toggle_favorite/${encodeURIComponent(gameUuid)}`,
        { method: 'POST' },
      )
    },
  }
}

export type WishlistApi = ReturnType<typeof createWishlistApi>
