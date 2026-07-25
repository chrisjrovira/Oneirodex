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

async function readError(response, label) {
  const data = await response.json().catch(() => ({}))
  return new Error(data?.error || `${label} ${response.status}`)
}

async function mutate(url, label, { method = 'POST', json, body } = {}) {
  const headers = json === undefined
    ? csrfHeaders()
    : csrfHeaders({ 'Content-Type': 'application/json' })

  const response = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers,
    ...(json === undefined ? {} : { body: JSON.stringify(json) }),
    ...(body === undefined ? {} : { body }),
  })

  if (!response.ok) {
    throw await readError(response, label)
  }

  return response.json()
}

export async function fetchOwnership({ signal } = {}) {
  const response = await fetch('/api/ownership', {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw new Error(`ownership ${response.status}`)
  }

  return response.json()
}

export async function connectSteam(steamId) {
  return mutate('/api/ownership/steam', 'connect_steam', {
    json: { steam_id: steamId },
  })
}

export async function disconnectSteam() {
  return mutate('/api/ownership/steam', 'disconnect_steam', { method: 'DELETE' })
}

export async function syncSteam() {
  return mutate('/api/ownership/steam/sync', 'sync_steam', { json: {} })
}

export async function connectGog(gogUserId) {
  return mutate('/api/ownership/gog', 'connect_gog', {
    json: { gog_user_id: gogUserId },
  })
}

export async function disconnectGog() {
  return mutate('/api/ownership/gog', 'disconnect_gog', { method: 'DELETE' })
}

export async function connectEpic(epicAccountId) {
  return mutate('/api/ownership/epic', 'connect_epic', {
    json: { epic_account_id: epicAccountId },
  })
}

export async function disconnectEpic() {
  return mutate('/api/ownership/epic', 'disconnect_epic', { method: 'DELETE' })
}

/**
 * The CSV endpoints accept either a JSON `csv` string or a multipart upload
 * under the `file` field, so pass whichever the member supplied.
 */
export async function importCsv(store, { csv, file } = {}) {
  const url = `/api/ownership/${store}/csv`
  const label = `import_${store}_csv`

  if (file) {
    const body = new FormData()
    body.append('file', file)
    const token = getCsrfToken()
    if (token) {
      body.append('csrf_token', token)
    }
    return mutate(url, label, { body })
  }

  return mutate(url, label, { json: { csv } })
}
