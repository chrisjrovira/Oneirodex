import { csrfHeaders, getCsrfToken } from './csrf'
import { errorFromResponse } from './envelopeError'

/**
 * Download failures carry an operator `hint` (e.g. "files were removed from
 * disk") that is a better sentence for a member than the generic `error`, so it
 * is promoted to the headline. Everything else — status, error_code, data —
 * comes from the shared helper rather than being rebuilt here.
 */
async function raiseDownloadError(response, fallback) {
  const error = await errorFromResponse(response, fallback)
  const hint = error.data?.hint
  if (typeof hint === 'string' && hint.trim()) {
    error.message = hint
  }
  error.code = error.data?.code
  error.hint = hint
  return error
}

/**
 * Initiate a library download via API (honors 410 path_missing honesty).
 * @param {string} gameUuid
 * @param {{ kind?: 'base' | 'update' | 'extra', versionUuid?: string, signal?: AbortSignal }} [options]
 */
export async function initiateGameDownload(gameUuid, { kind = 'base', versionUuid, signal } = {}) {
  const body = { kind: kind || 'base' }
  if (versionUuid) {
    body.version_uuid = versionUuid
  }

  const response = await fetch(`/api/downloads/games/${encodeURIComponent(gameUuid)}`, {
    method: 'POST',
    signal,
    credentials: 'same-origin',
    headers: csrfHeaders({
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }),
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw await raiseDownloadError(response, 'download')
  }
  return response.json().catch(() => ({}))
}

export async function fetchMyDownloads({ signal } = {}) {
  const response = await fetch('/api/my_downloads', {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw await errorFromResponse(response, 'my_downloads')
  }

  return response.json()
}

export async function checkStatus(id, { signal } = {}) {
  const response = await fetch(`/check_download_status/${id}`, {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw await errorFromResponse(response, 'check_download_status')
  }

  return response.json()
}

export async function deleteDownload(id) {
  const csrf = getCsrfToken()
  const body = new FormData()
  if (csrf) {
    body.append('csrf_token', csrf)
  }

  const response = await fetch(`/delete_download/${id}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders(),
    body,
  })

  if (!response.ok && response.status !== 302) {
    throw await errorFromResponse(response, 'delete_download')
  }

  return true
}
