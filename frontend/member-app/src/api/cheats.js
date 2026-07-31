/** Game library RetroArch `.cht` cheats — list / create / upload / delete. */

/** Capability-language dialect hints (API values match Backend CHEAT_DIALECTS). */
export const CHEAT_DIALECTS = Object.freeze([
  { value: 'raw', label: 'Raw' },
  { value: 'game_genie', label: 'GG-style' },
  { value: 'action_replay', label: 'AR-style' },
  { value: 'gameshark', label: 'GS-style' },
])

function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]')
  if (meta?.content) {
    return meta.content
  }
  const input = document.querySelector('input[name="csrf_token"]')
  if (input?.value) {
    return input.value
  }
  return ''
}

function csrfHeaders(extra = {}) {
  if (typeof window !== 'undefined' && window.CSRFUtils?.getHeaders) {
    return window.CSRFUtils.getHeaders(extra)
  }
  return { 'X-CSRFToken': getCsrfToken(), ...extra }
}

function cheatsUrl(gameUuid, filename) {
  const base = `/api/games/${encodeURIComponent(gameUuid)}/cheats`
  if (!filename) {
    return base
  }
  return `${base}/${encodeURIComponent(filename)}`
}

function raiseApiError(data, fallback) {
  const error = new Error(data?.error || fallback)
  error.status = data?.status
  error.code = data?.code
  error.data = data
  return error
}

/**
 * @returns {Promise<{ game_uuid: string, cheats: Array<{ name: string, size: number, url: string }> }>}
 */
export async function listCheats(gameUuid, { signal } = {}) {
  const response = await fetch(cheatsUrl(gameUuid), {
    credentials: 'same-origin',
    signal,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw raiseApiError({ ...data, status: response.status }, `cheats list ${response.status}`)
  }
  return {
    game_uuid: data.game_uuid || gameUuid,
    cheats: Array.isArray(data.cheats) ? data.cheats : [],
  }
}

/**
 * Easy-create — Backend JSON body → `.cht`.
 * Payload: `{ name, codes: [{ desc?, code }], dialect? }`
 *
 * @throws {Error} with `code: 'create_unavailable'` when the create API is not shipped yet
 */
export async function createCheat(gameUuid, { name, codes, dialect } = {}) {
  const response = await fetch(cheatsUrl(gameUuid), {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
    body: JSON.stringify({
      name,
      codes,
      ...(dialect ? { dialect } : {}),
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = String(data.error || '')
    const createMissing =
      data.code === 'create_unavailable' ||
      response.status === 415 ||
      (response.status === 400 && /^file required$/i.test(message))
    const error = raiseApiError(
      { ...data, status: response.status, code: createMissing ? 'create_unavailable' : data.code },
      data.error || `cheat create ${response.status}`,
    )
    if (createMissing) {
      error.code = 'create_unavailable'
      error.message =
        'Easy-create is not available on this server yet. Upload a .cht file, or wait for the create API.'
    }
    throw error
  }
  return data
}

/** Legacy / operator path — multipart `.cht` upload. */
export async function uploadCheat(gameUuid, file) {
  const body = new FormData()
  body.append('file', file)
  const response = await fetch(cheatsUrl(gameUuid), {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders(),
    body,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw raiseApiError({ ...data, status: response.status }, data.error || `cheat upload ${response.status}`)
  }
  return data
}

export async function deleteCheat(gameUuid, filename) {
  const response = await fetch(cheatsUrl(gameUuid, filename), {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: csrfHeaders({ Accept: 'application/json' }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw raiseApiError({ ...data, status: response.status }, data.error || `cheat delete ${response.status}`)
  }
  return data
}
