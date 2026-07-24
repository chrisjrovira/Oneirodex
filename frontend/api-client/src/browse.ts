import type { Requester } from './client.js'
import type { CollectionSummary, SearchResponse } from './types.js'

export interface SearchOptions {
  query: string
  signal?: AbortSignal
}

export function createBrowseApi(request: Requester) {
  return {
    search({ query, signal }: SearchOptions): Promise<SearchResponse> {
      const params = new URLSearchParams({ query })
      return request<SearchResponse>(`/api/search?${params}`, { signal })
    },

    listCollections(signal?: AbortSignal): Promise<CollectionSummary[]> {
      return request<CollectionSummary[]>('/api/collections', { signal })
    },
  }
}

export type BrowseApi = ReturnType<typeof createBrowseApi>
