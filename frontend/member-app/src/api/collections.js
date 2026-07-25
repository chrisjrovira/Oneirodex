function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]')
  if (meta?.content) {
    return meta.content
  }

  const input = document.querySelector('input[name="csrf_token"]')
  if (input?.value) {
    return input.value
  }

  return document.getElementById('csrf_token')?.textContent || ''
}

function csrfHeaders(additionalHeaders = {}) {
  if (window.CSRFUtils?.getHeaders) {
    return window.CSRFUtils.getHeaders(additionalHeaders)
  }

  return {
    'X-CSRFToken': getCsrfToken(),
    ...additionalHeaders,
  }
}

function requestError(label, response, data) {
  const error = new Error(data?.error || `${label} ${response.status}`)
  error.status = response.status
  return error
}

export async function fetchCollections({ signal } = {}) {
  const response = await fetch('/api/collections', {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw requestError('collections', response)
  }

  return response.json()
}

export async function fetchCollection(collectionUuid, { signal } = {}) {
  const response = await fetch(`/api/collections/${encodeURIComponent(collectionUuid)}`, {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw requestError('collection', response)
  }

  return response.json()
}

export async function createCollection({ name, description = '', isPublic = true }) {
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

export async function addCollectionItem(collectionUuid, gameUuid) {
  const response = await fetch(
    `/api/collections/${encodeURIComponent(collectionUuid)}/items`,
    {
      method: 'POST',
      credentials: 'same-origin',
      headers: csrfHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ game_uuid: gameUuid }),
    },
  )

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw requestError('add_collection_item', response, data)
  }

  return data
}
