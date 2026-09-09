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
  signal?: AbortSignal
}

export function createWishlistApi(request: Requester) {
  return {
    /** This member's wishlist / request queue (`GET /api/requests`). */
    listRequests(signal?: AbortSignal): Promise<ListRequestsResponse> {
      return request<ListRequestsResponse>('/api/requests', { signal })
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
      return request<{ ok: boolean; id: number }>(`/api/requests/${requestId}`, { method: 'DELETE' })
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
