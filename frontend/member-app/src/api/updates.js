import { csrfHeaders } from './csrf'
import { errorFromResponse } from './envelopeError'

export async function fetchUpdatesInbox({ signal, limit = 100 } = {}) {
  const response = await fetch(`/api/updates/inbox?limit=${limit}`, {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw await errorFromResponse(response, 'updates/inbox')
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
    throw await errorFromResponse(response, 'updates/store_search')
  }

  return response.json()
}

export async function addWantedUpdate(payload) {
  const response = await fetch('/api/updates/wanted', {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'wanted')
  }
  return response.json().catch(() => ({}))
}

export async function fetchAcquireStatus({ signal } = {}) {
  const response = await fetch('/api/acquire/status', {
    signal,
    credentials: 'same-origin',
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'acquire/status')
  }
  return response.json()
}

export async function searchAcquire(q, { signal } = {}) {
  const response = await fetch(`/api/acquire/search?q=${encodeURIComponent(q || '')}`, {
    signal,
    credentials: 'same-origin',
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'acquire/search')
  }
  return response.json()
}
