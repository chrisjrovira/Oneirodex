import type { Requester } from './client.js'

/** Loose row shape — the SPA reads many optional fields; keep the known ones typed. */
export interface LibrarySummary {
  uuid: string
  name: string
  platform?: string | null
  game_count?: number
  [key: string]: unknown
}

export interface GetLibrariesResponse {
  libraries?: LibrarySummary[]
  [key: string]: unknown
}

export interface LibraryWatchState {
  watch_enabled?: boolean
  [key: string]: unknown
}

export function createLibraryApi(request: Requester) {
  return {
    /** All libraries visible to the caller (`GET /api/get_libraries`). */
    list(signal?: AbortSignal): Promise<GetLibrariesResponse> {
      return request<GetLibrariesResponse>('/api/get_libraries', { signal })
    },

    /** One library by uuid (`GET /api/library/{uuid}`). */
    get(libraryUuid: string, signal?: AbortSignal): Promise<LibrarySummary> {
      return request<LibrarySummary>(`/api/library/${encodeURIComponent(libraryUuid)}`, { signal })
    },

    /** Read the per-library freshness-watch flag (`GET /api/library/{uuid}/watch`). */
    getWatch(libraryUuid: string): Promise<LibraryWatchState> {
      return request<LibraryWatchState>(
        `/api/library/${encodeURIComponent(libraryUuid)}/watch`,
      )
    },

    /**
     * Set the per-library freshness-watch flag (`PUT /api/library/{uuid}/watch`).
     * `null` means "follow the global default"; `false` opts out even when the
     * env master switch is on. Librarian or admin only.
     */
    setWatch(libraryUuid: string, enabled: boolean | null): Promise<LibraryWatchState> {
      return request<LibraryWatchState>(`/api/library/${encodeURIComponent(libraryUuid)}/watch`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watch_enabled: enabled }),
      })
    },

    /** Persist a new library display order (`POST /api/reorder_libraries`). */
    reorder(orderedUuids: string[]): Promise<{ ok: boolean }> {
      return request<{ ok: boolean }>('/api/reorder_libraries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: orderedUuids }),
      })
    },
  }
}

export type LibraryApi = ReturnType<typeof createLibraryApi>
