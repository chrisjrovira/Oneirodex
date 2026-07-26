export async function fetchUpdatesInbox({ signal, limit = 100 } = {}) {
  const response = await fetch(`/api/updates/inbox?limit=${limit}`, {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw new Error(`updates/inbox ${response.status}`)
  }

  return response.json()
}

export async function fetchStoreSearch({ q, source = 'all', limit = 8, signal } = {}) {
  const params = new URLSearchParams({
    q: q || '',
    source,
    limit: String(limit),
  })
  const response = await fetch(`/api/updates/store_search?${params}`, {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw new Error(`updates/store_search ${response.status}`)
  }

  return response.json()
}
