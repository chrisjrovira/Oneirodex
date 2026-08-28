import { csrfHeaders, getCsrfToken } from './csrf'
import { errorFromResponse } from './envelopeError'


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
    throw await errorFromResponse(response, label)
  }

  return response.json()
}

export async function fetchOwnership({ signal } = {}) {
  const response = await fetch('/api/ownership', {
    signal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw await errorFromResponse(response, 'ownership')
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

export async function connectGog(gogUserId, { refreshToken, accessToken } = {}) {
  return mutate('/api/ownership/gog', 'connect_gog', {
    json: {
      gog_user_id: gogUserId,
      ...(refreshToken ? { refresh_token: refreshToken } : {}),
      ...(accessToken ? { access_token: accessToken } : {}),
    },
  })
}

export async function disconnectGog() {
  return mutate('/api/ownership/gog', 'disconnect_gog', { method: 'DELETE' })
}

export async function syncGog() {
  return mutate('/api/ownership/gog/sync', 'sync_gog', { json: {} })
}

export async function connectEpic(epicAccountId, { deviceAuth } = {}) {
  return mutate('/api/ownership/epic', 'connect_epic', {
    json: {
      epic_account_id: epicAccountId,
      ...(deviceAuth ? { device_auth: deviceAuth } : {}),
    },
  })
}

export async function disconnectEpic() {
  return mutate('/api/ownership/epic', 'disconnect_epic', { method: 'DELETE' })
}

export async function syncEpic() {
  return mutate('/api/ownership/epic/sync', 'sync_epic', { json: {} })
}

export async function connectAmazon(amazonUserId, { credential, refreshToken, deviceSerial } = {}) {
  return mutate('/api/ownership/amazon', 'connect_amazon', {
    json: {
      amazon_user_id: amazonUserId,
      ...(credential ? { credential } : {}),
      ...(refreshToken ? { refresh_token: refreshToken } : {}),
      ...(deviceSerial ? { device_serial: deviceSerial } : {}),
    },
  })
}

export async function disconnectAmazon() {
  return mutate('/api/ownership/amazon', 'disconnect_amazon', { method: 'DELETE' })
}

export async function syncAmazon() {
  return mutate('/api/ownership/amazon/sync', 'sync_amazon', { json: {} })
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
