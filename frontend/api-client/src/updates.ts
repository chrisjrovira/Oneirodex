import type { Requester } from './client.js'
import type { UpdatesInboxResponse } from './types.js'

export interface UpdatesInboxOptions {
  /** Server default is 100. */
  limit?: number
  signal?: AbortSignal
}

export interface UpdatesScanBody {
  /** Bounded batch size; the server caps it. */
  limit?: number
  /** Restrict the sweep to one library. */
  library_uuid?: string
}

export interface UpdatesScanResponse {
  /** Titles still unswept after this batch — one press is never the whole library. */
  remaining?: number
  [key: string]: unknown
}

export interface StoreSearchOptions {
  q: string
  /** `all` (default) or one store id. */
  source?: string
  limit?: number
  signal?: AbortSignal
}

export interface StoreSearchResponse {
  results?: Array<{ [key: string]: unknown }>
  [key: string]: unknown
}

export interface WantedUpdateBody {
  game_uuid?: string
  source?: string
  [key: string]: unknown
}

export function createUpdatesApi(request: Requester) {
  return {
    /** Freshness inbox (`GET /api/updates/inbox`). */
    inbox(opts: UpdatesInboxOptions = {}): Promise<UpdatesInboxResponse> {
      const qs = opts.limit != null ? `?limit=${encodeURIComponent(String(opts.limit))}` : ''
      return request<UpdatesInboxResponse>(`/api/updates/inbox${qs}`, { signal: opts.signal })
    },

    /**
     * Re-probe library titles against the stores, oldest-checked first
     * (`POST /api/updates/scan`). One call is one bounded batch.
     */
    scan(body: UpdatesScanBody = {}, signal?: AbortSignal): Promise<UpdatesScanResponse> {
      return request<UpdatesScanResponse>('/api/updates/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      })
    },

    /** Store-side title search for the wanted list (`GET /api/updates/store_search`). */
    storeSearch(opts: StoreSearchOptions): Promise<StoreSearchResponse> {
      const params = new URLSearchParams({
        q: opts.q ?? '',
        source: opts.source ?? 'all',
        limit: String(opts.limit ?? 8),
      })
      return request<StoreSearchResponse>(`/api/updates/store_search?${params}`, {
        signal: opts.signal,
      })
    },

    /** Add a title to the wanted list (`POST /api/updates/wanted`). */
    addWanted(body: WantedUpdateBody): Promise<{ [key: string]: unknown }> {
      return request('/api/updates/wanted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    },
  }
}

export type UpdatesApi = ReturnType<typeof createUpdatesApi>
