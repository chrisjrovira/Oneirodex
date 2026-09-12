import { createCollectionsApi } from '@oneirodex/api-client'

import { getJson, memberResource, withMemberError } from './client'

const collections = memberResource(createCollectionsApi)

export async function fetchCollections({ signal }: LooseProps = {}) {
  return withMemberError(collections.list(signal), 'collections')
}

export async function fetchCollection(collectionUuid: any, { signal }: LooseProps = {}) {
  return withMemberError(collections.get(collectionUuid, signal), 'collection')
}

export async function createCollection({ name, description = '', isPublic = true }: LooseProps) {
  return withMemberError(
    collections.create({
      name,
      description,
      is_public: isPublic,
    }),
    'create_collection',
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

  return withMemberError(collections.update(collectionUuid, body), 'update_collection')
}

export async function deleteCollection(collectionUuid: any) {
  return withMemberError(collections.remove(collectionUuid), 'delete_collection')
}

export async function reorderCollectionItems(collectionUuid: any, gameUuids: any) {
  return withMemberError(
    collections.reorderItems(collectionUuid, gameUuids),
    'reorder_collection_items',
  )
}

export async function addCollectionItem(collectionUuid: any, gameUuid: any) {
  return withMemberError(collections.addItem(collectionUuid, gameUuid), 'add_collection_item')
}

export async function removeCollectionItem(collectionUuid: any, gameUuid: any) {
  return withMemberError(collections.removeItem(collectionUuid, gameUuid), 'remove_collection_item')
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
