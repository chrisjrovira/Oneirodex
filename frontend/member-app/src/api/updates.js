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

function csrfToken() {
  return (
    document.querySelector('meta[name="csrf-token"]')?.content ||
    document.querySelector('input[name="csrf_token"]')?.value ||
    ''
  )
}

export async function addWantedUpdate(payload) {
  const response = await fetch('/api/updates/wanted', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken(),
    },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || `wanted ${response.status}`)
  }
  return data
}

export async function fetchAcquireStatus({ signal } = {}) {
  const response = await fetch('/api/acquire/status', {
    signal,
    credentials: 'same-origin',
  })
  if (!response.ok) {
    throw new Error(`acquire/status ${response.status}`)
  }
  return response.json()
}

export async function searchAcquire(q, { signal } = {}) {
  const response = await fetch(`/api/acquire/search?q=${encodeURIComponent(q || '')}`, {
    signal,
    credentials: 'same-origin',
  })
  if (!response.ok) {
    throw new Error(`acquire/search ${response.status}`)
  }
  return response.json()
}
