import { csrfHeaders } from './csrf'
import { errorFromResponse } from './envelopeError'

export async function fetchGameDetails(gameUuid, { signal } = {}) {
  const response = await fetch(`/api/games/${encodeURIComponent(gameUuid)}/details`, {
    signal,
    credentials: 'same-origin',
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'game details')
  }
  return response.json().catch(() => ({}))
}

export async function fetchGameMoreFrom(gameUuid, { signal } = {}) {
  const response = await fetch(`/api/games/${encodeURIComponent(gameUuid)}/more_from`, {
    signal,
    credentials: 'same-origin',
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'more from')
  }
  return response.json().catch(() => ({ sections: [] }))
}

export async function fetchGameVersions(gameUuid, { signal } = {}) {
  const response = await fetch(`/api/games/${encodeURIComponent(gameUuid)}/versions`, {
    signal,
    credentials: 'same-origin',
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'game versions')
  }
  return response.json()
}

export async function checkGameFreshness(gameUuid) {
  const response = await fetch(
    `/api/games/${encodeURIComponent(gameUuid)}/freshness/check`,
    {
      method: 'POST',
      credentials: 'same-origin',
      headers: csrfHeaders({ 'Content-Type': 'application/json' }),
      body: '{}',
    },
  )
  if (!response.ok) {
    throw await errorFromResponse(response, 'freshness check')
  }
  return response.json().catch(() => ({}))
}

/**
 * Librarian/admin: remove version rows whose files are missing on disk (Wave 14b).
 * @param {string} gameUuid
 * @returns {Promise<object>}
 */
export async function cleanupOrphanVersions(gameUuid) {
  const response = await fetch(
    `/api/games/${encodeURIComponent(gameUuid)}/versions/cleanup_orphans`,
    {
      method: 'POST',
      credentials: 'same-origin',
      headers: csrfHeaders({ 'Content-Type': 'application/json' }),
      body: '{}',
    },
  )
  if (!response.ok) {
    throw await errorFromResponse(response, 'cleanup orphans')
  }
  return response.json().catch(() => ({}))
}
