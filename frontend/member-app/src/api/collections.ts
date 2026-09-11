import { deleteJson, getJson, patchJson, postJson, putJson } from './client'

export async function fetchCollections({ signal }: LooseProps = {}) {
  return getJson('/api/collections', { signal, label: 'collections' })
}

export async function fetchCollection(collectionUuid: any, { signal }: LooseProps = {}) {
  return getJson(`/api/collections/${encodeURIComponent(collectionUuid)}`, {
    signal,
    label: 'collection',
  })
}

export async function createCollection({ name, description = '', isPublic = true }: LooseProps) {
  return postJson(
    '/api/collections',
    {
      name,
      description,
      is_public: isPublic,
    },
    { label: 'create_collection' },
  )
}

export async function updateCollection(
  collectionUuid: any,
  { name, description, isPublic }: LooseProps = {},
) {
  const body: LooseProps = {}
  if (name !== undefined) {
    body.name = name
  }
  if (description !== undefined) {
    body.description = description
  }
  if (isPublic !== undefined) {
    body.is_public = isPublic
  }

  return patchJson(`/api/collections/${encodeURIComponent(collectionUuid)}`, body, {
    label: 'update_collection',
  })
}

export async function deleteCollection(collectionUuid: any) {
  return deleteJson(`/api/collections/${encodeURIComponent(collectionUuid)}`, undefined, {
    label: 'delete_collection',
  })
}

export async function reorderCollectionItems(collectionUuid: any, gameUuids: any) {
  return putJson(
    `/api/collections/${encodeURIComponent(collectionUuid)}/items/order`,
    { game_uuids: gameUuids },
    { label: 'reorder_collection_items' },
  )
}

export async function addCollectionItem(collectionUuid: any, gameUuid: any) {
  return postJson(
    `/api/collections/${encodeURIComponent(collectionUuid)}/items`,
    { game_uuid: gameUuid },
    { label: 'add_collection_item' },
  )
}

export async function removeCollectionItem(collectionUuid: any, gameUuid: any) {
  return deleteJson(
    `/api/collections/${encodeURIComponent(collectionUuid)}/items/${encodeURIComponent(gameUuid)}`,
    undefined,
    { label: 'remove_collection_item' },
  )
}

export async function searchGames(query: any, { signal, limit = 20 }: LooseProps = {}) {
  const trimmed = (query || '').trim()
  if (!trimmed) {
    return []
  }

  const params = new URLSearchParams({ query: trimmed })
  const data = await getJson(`/api/search?${params.toString()}`, {
    signal,
    label: 'search_games',
  })
  const rows = Array.isArray(data) ? data : []
  return rows.slice(0, limit)
}
