export async function fetchGameDetails(gameUuid, { signal } = {}) {
  const response = await fetch(`/api/games/${encodeURIComponent(gameUuid)}/details`, {
    signal,
    credentials: 'same-origin',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data.error || `game details ${response.status}`)
    error.status = response.status
    throw error
  }
  return data
}

export async function fetchGameVersions(gameUuid, { signal } = {}) {
  const response = await fetch(`/api/games/${encodeURIComponent(gameUuid)}/versions`, {
    signal,
    credentials: 'same-origin',
  })
  if (!response.ok) {
    throw new Error(`game versions ${response.status}`)
  }
  return response.json()
}

function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]')
  if (meta?.content) {
    return meta.content
  }
  return ''
}

export async function checkGameFreshness(gameUuid) {
  const response = await fetch(
    `/api/games/${encodeURIComponent(gameUuid)}/freshness/check`,
    {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: '{}',
    },
  )
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || `freshness check ${response.status}`)
  }
  return data
}
