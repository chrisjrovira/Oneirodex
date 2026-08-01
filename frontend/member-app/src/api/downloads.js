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

function raiseDownloadError(data, status, fallback) {
  const error = new Error(data?.hint || data?.error || fallback)
  error.status = status
  error.code = data?.code
  error.hint = data?.hint
  error.data = data
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

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw raiseDownloadError(data, response.status, `download ${response.status}`)
  }
  return data
}

export async function fetchMyDownloads({ signal } = {}) {
  const response = await fetch('/api/my_downloads', {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw new Error(`my_downloads ${response.status}`)
  }

  return response.json()
}

export async function checkStatus(id, { signal } = {}) {
  const response = await fetch(`/check_download_status/${id}`, {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw new Error(`check_download_status ${response.status}`)
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
    throw new Error(`delete_download ${response.status}`)
  }

  return true
}
