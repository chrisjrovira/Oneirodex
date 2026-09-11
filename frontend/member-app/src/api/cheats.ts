/** Game library RetroArch `.cht` cheats — list / create / upload / delete. */

import { errorFromBody } from '@oneirodex/ui'
import { deleteJson, getJson, postJson, send } from './client'

/** Capability-language dialect hints (API values match Backend CHEAT_DIALECTS). */
export const CHEAT_DIALECTS = Object.freeze([
  { value: 'raw', label: 'Raw' },
  { value: 'game_genie', label: 'GG-style' },
  { value: 'action_replay', label: 'AR-style' },
  { value: 'gameshark', label: 'GS-style' },
])

function cheatsUrl(gameUuid: any, filename = undefined) {
  const base = `/api/games/${encodeURIComponent(gameUuid)}/cheats`
  if (!filename) {
    return base
  }
  return `${base}/${encodeURIComponent(filename)}`
}

function raiseApiError(data: any, fallback: any, status: any) {
  // `code` is cheats-specific (the panel branches on it); everything else is
  // the shared shape. Status comes from the response now — it used to be read
  // out of the body, which left it undefined whenever the body omitted it.
  const error: LooseProps = errorFromBody(data, status ?? data?.status, fallback)
  error.code = data?.code
  return error
}

function withCheatCode(err: any, fallback: string) {
  const data = err?.data && typeof err.data === 'object' ? err.data : {}
  const status = err?.status
  const error = raiseApiError({ ...data, status }, fallback, status)
  error.code = data.code ?? err?.code ?? error.code
  return error
}

/**
 * @returns {Promise<{ game_uuid: string, cheats: Array<{ name: string, size: number, url: string }> }>}
 */
export async function listCheats(gameUuid: any, { signal }: LooseProps = {}) {
  try {
    const data = (await getJson(cheatsUrl(gameUuid), { signal, label: 'cheats list' })) ?? {}
    return {
      game_uuid: data.game_uuid || gameUuid,
      cheats: Array.isArray(data.cheats) ? data.cheats : [],
    }
  } catch (err: any) {
    throw withCheatCode(err, 'cheats list')
  }
}

/**
 * Easy-create — Backend JSON body → `.cht`.
 * Payload: `{ name, codes: [{ desc?, code }], dialect? }`
 *
 * @throws {Error} with `code: 'create_unavailable'` when the create API is not shipped yet
 */
export async function createCheat(gameUuid: any, { name, codes, dialect }: LooseProps = {}) {
  try {
    return await postJson(
      cheatsUrl(gameUuid),
      {
        name,
        codes,
        ...(dialect ? { dialect } : {}),
      },
      { label: 'cheat create' },
    )
  } catch (err: any) {
    const data = err?.data && typeof err.data === 'object' ? err.data : {}
    const message = String(data.error || err?.message || '')
    const createMissing =
      data.code === 'create_unavailable' ||
      err?.status === 415 ||
      (err?.status === 400 && /^file required$/i.test(message))
    const error = withCheatCode(err, 'cheat create')
    if (createMissing) {
      error.code = 'create_unavailable'
      error.message =
        'Easy-create is not available on this server yet. Upload a .cht file, or wait for the create API.'
    }
    throw error
  }
}

/** Legacy / operator path — multipart `.cht` upload. */
export async function uploadCheat(gameUuid: any, file: any) {
  const body = new FormData()
  body.append('file', file)
  try {
    return (await send(cheatsUrl(gameUuid), { method: 'POST', body, label: 'cheat upload' })) ?? {}
  } catch (err: any) {
    throw withCheatCode(err, 'cheat upload')
  }
}

export async function deleteCheat(gameUuid: any, filename: any) {
  try {
    return (
      (await deleteJson(cheatsUrl(gameUuid, filename), undefined, { label: 'cheat delete' })) ?? {}
    )
  } catch (err: any) {
    throw withCheatCode(err, 'cheat delete')
  }
}
