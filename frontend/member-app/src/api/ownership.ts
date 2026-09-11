import { getCsrfToken } from '@oneirodex/ui'
import { deleteJson, getJson, postJson, send } from './client'

export async function fetchOwnership({ signal }: LooseProps = {}) {
  return getJson('/api/ownership', { signal, label: 'ownership' })
}

export async function connectSteam(steamId: any) {
  return postJson('/api/ownership/steam', { steam_id: steamId }, { label: 'connect_steam' })
}

export async function disconnectSteam() {
  return deleteJson('/api/ownership/steam', undefined, { label: 'disconnect_steam' })
}

export async function syncSteam() {
  return postJson('/api/ownership/steam/sync', {}, { label: 'sync_steam' })
}

export async function connectGog(gogUserId: any, { refreshToken, accessToken }: LooseProps = {}) {
  return postJson(
    '/api/ownership/gog',
    {
      gog_user_id: gogUserId,
      ...(refreshToken ? { refresh_token: refreshToken } : {}),
      ...(accessToken ? { access_token: accessToken } : {}),
    },
    { label: 'connect_gog' },
  )
}

export async function disconnectGog() {
  return deleteJson('/api/ownership/gog', undefined, { label: 'disconnect_gog' })
}

export async function syncGog() {
  return postJson('/api/ownership/gog/sync', {}, { label: 'sync_gog' })
}

export async function connectEpic(epicAccountId: any, { deviceAuth }: LooseProps = {}) {
  return postJson(
    '/api/ownership/epic',
    {
      epic_account_id: epicAccountId,
      ...(deviceAuth ? { device_auth: deviceAuth } : {}),
    },
    { label: 'connect_epic' },
  )
}

export async function disconnectEpic() {
  return deleteJson('/api/ownership/epic', undefined, { label: 'disconnect_epic' })
}

export async function syncEpic() {
  return postJson('/api/ownership/epic/sync', {}, { label: 'sync_epic' })
}

export async function connectAmazon(
  amazonUserId: any,
  { credential, refreshToken, deviceSerial }: LooseProps = {},
) {
  return postJson(
    '/api/ownership/amazon',
    {
      amazon_user_id: amazonUserId,
      ...(credential ? { credential } : {}),
      ...(refreshToken ? { refresh_token: refreshToken } : {}),
      ...(deviceSerial ? { device_serial: deviceSerial } : {}),
    },
    { label: 'connect_amazon' },
  )
}

export async function disconnectAmazon() {
  return deleteJson('/api/ownership/amazon', undefined, { label: 'disconnect_amazon' })
}

export async function syncAmazon() {
  return postJson('/api/ownership/amazon/sync', {}, { label: 'sync_amazon' })
}

/**
 * The CSV endpoints accept either a JSON `csv` string or a multipart upload
 * under the `file` field, so pass whichever the member supplied.
 */
export async function importCsv(store: any, { csv, file }: LooseProps = {}) {
  const url = `/api/ownership/${store}/csv`
  const label = `import_${store}_csv`

  if (file) {
    const body = new FormData()
    body.append('file', file)
    const token = getCsrfToken()
    if (token) {
      body.append('csrf_token', token)
    }
    return send(url, { method: 'POST', body, label })
  }

  return postJson(url, { csv }, { label })
}
