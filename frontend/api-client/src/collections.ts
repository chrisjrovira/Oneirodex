import type { Requester } from './client.js'
import type { CollectionSummary } from './types.js'

export interface CollectionDetail extends CollectionSummary {
  uuid: string
  description?: string | null
  is_public?: boolean
  is_system?: boolean
  item_count?: number
  items?: Array<{ game_uuid: string; position?: number; [key: string]: unknown }>
}

export interface ListCollectionsResponse {
  collections: CollectionDetail[]
  [key: string]: unknown
}

export interface CreateCollectionRequest {
  name: string
  description?: string
  is_public?: boolean
}

export interface UpdateCollectionRequest {
  name?: string
  description?: string | null
  is_public?: boolean
}

export function createCollectionsApi(request: Requester) {
  return {
    /** Every collection visible to the caller (`GET /api/collections`). */
    list(signal?: AbortSignal): Promise<ListCollectionsResponse> {
      return request<ListCollectionsResponse>('/api/collections', { signal })
    },

    /** Create a collection (`POST /api/collections`). */
    create(body: CreateCollectionRequest): Promise<CollectionDetail> {
      return request<CollectionDetail>('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    },

    /** One collection with its items (`GET /api/collections/{uuid}`). */
    get(collectionUuid: string, signal?: AbortSignal): Promise<CollectionDetail> {
      return request<CollectionDetail>(
        `/api/collections/${encodeURIComponent(collectionUuid)}`,
        { signal },
      )
    },

    /** Rename / re-describe / toggle visibility (`PATCH /api/collections/{uuid}`). */
    update(collectionUuid: string, body: UpdateCollectionRequest): Promise<CollectionDetail> {
      return request<CollectionDetail>(`/api/collections/${encodeURIComponent(collectionUuid)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    },

    /** Delete a collection (`DELETE /api/collections/{uuid}`). */
    remove(collectionUuid: string): Promise<{ ok: boolean; uuid: string }> {
      return request<{ ok: boolean; uuid: string }>(
        `/api/collections/${encodeURIComponent(collectionUuid)}`,
        { method: 'DELETE' },
      )
    },

    /** Add a game to a collection (`POST /api/collections/{uuid}/items`). */
    addItem(collectionUuid: string, gameUuid: string): Promise<{ [key: string]: unknown }> {
      return request(`/api/collections/${encodeURIComponent(collectionUuid)}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_uuid: gameUuid }),
      })
    },

    /** Remove a game (`DELETE /api/collections/{uuid}/items/{gameUuid}`). */
    removeItem(
      collectionUuid: string,
      gameUuid: string,
    ): Promise<{ ok: boolean; game_uuid: string }> {
      return request<{ ok: boolean; game_uuid: string }>(
        `/api/collections/${encodeURIComponent(collectionUuid)}/items/${encodeURIComponent(
          gameUuid,
        )}`,
        { method: 'DELETE' },
      )
    },

    /**
     * Reorder items (`PUT /api/collections/{uuid}/items/order`). `gameUuids`
     * must list every current item exactly once.
     */
    reorderItems(collectionUuid: string, gameUuids: string[]): Promise<CollectionDetail> {
      return request<CollectionDetail>(
        `/api/collections/${encodeURIComponent(collectionUuid)}/items/order`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ game_uuids: gameUuids }),
        },
      )
    },
  }
}

export type CollectionsApi = ReturnType<typeof createCollectionsApi>
