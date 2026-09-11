import { csrfHeaders, errorFromBody } from '@oneirodex/ui'
function requestError(label: any, response: any, data = undefined) {
  return errorFromBody(data, response.status, label)
}

export async function fetchCollections({ signal }: LooseProps = {}) {
  const response = await fetch('/api/collections', {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw requestError('collections', response)
  }

  return response.json()
}

export async function fetchCollection(collectionUuid: any, { signal }: LooseProps = {}) {
  const response = await fetch(`/api/collections/${encodeURIComponent(collectionUuid)}`, {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw requestError('collection', response)
  }

  return response.json()
}

export async function createCollection({ name, description = '', isPublic = true }: LooseProps) {
  const response = await fetch('/api/collections', {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      name,
      description,
      is_public: isPublic,
    }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw requestError('create_collection', response, data)
  }

  return data
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

  const response = await fetch(`/api/collections/${encodeURIComponent(collectionUuid)}`, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: csrfHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw requestError('update_collection', response, data)
  }

  return data
}

export async function deleteCollection(collectionUuid: any) {
  const response = await fetch(`/api/collections/${encodeURIComponent(collectionUuid)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: csrfHeaders(),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw requestError('delete_collection', response, data)
  }

  return data
}

export async function reorderCollectionItems(collectionUuid: any, gameUuids: any) {
  const response = await fetch(
    `/api/collections/${encodeURIComponent(collectionUuid)}/items/order`,
    {
      method: 'PUT',
      credentials: 'same-origin',
      headers: csrfHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ game_uuids: gameUuids }),
    },
  )

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw requestError('reorder_collection_items', response, data)
  }

  return data
}

export async function addCollectionItem(collectionUuid: any, gameUuid: any) {
  const response = await fetch(`/api/collections/${encodeURIComponent(collectionUuid)}/items`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ game_uuid: gameUuid }),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw requestError('add_collection_item', response, data)
  }

  return data
}

export async function removeCollectionItem(collectionUuid: any, gameUuid: any) {
  const response = await fetch(
    `/api/collections/${encodeURIComponent(collectionUuid)}/items/${encodeURIComponent(gameUuid)}`,
    {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: csrfHeaders(),
    },
  )

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw requestError('remove_collection_item', response, data)
  }

  return data
}

export async function searchGames(query: any, { signal, limit = 20 }: LooseProps = {}) {
  const trimmed = (query || '').trim()
  if (!trimmed) {
    return []
  }

  const params = new URLSearchParams({ query: trimmed })
  const response = await fetch(`/api/search?${params.toString()}`, {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw requestError('search_games', response)
  }

  const data = await response.json()
  const rows = Array.isArray(data) ? data : []
  return rows.slice(0, limit)
}
