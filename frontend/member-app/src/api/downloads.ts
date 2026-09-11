import { getCsrfToken } from '@oneirodex/ui'
import { getJson, postJson, send } from './client'

/**
 * Download failures carry an operator `hint` (e.g. "files were removed from
 * disk") that is a better sentence for a member than the generic `error`, so it
 * is promoted to the headline. Everything else — status, error_code, data —
 * comes from the shared helper rather than being rebuilt here.
 */
function raiseDownloadError(err: any) {
  const error: LooseProps = err
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
export async function initiateGameDownload(
  gameUuid: any,
  { kind = 'base', versionUuid, signal }: LooseProps = {},
) {
  const body: LooseProps = { kind: kind || 'base' }
  if (versionUuid) {
    body.version_uuid = versionUuid
  }

  try {
    return (
      (await postJson(`/api/downloads/games/${encodeURIComponent(gameUuid)}`, body, {
        signal,
        label: 'download',
      })) ?? {}
    )
  } catch (err: any) {
    throw raiseDownloadError(err)
  }
}

export async function fetchMyDownloads({ signal }: LooseProps = {}) {
  return getJson('/api/my_downloads', { signal, label: 'my_downloads' })
}

export async function checkStatus(id: any, { signal }: LooseProps = {}) {
  return getJson(`/check_download_status/${id}`, { signal, label: 'check_download_status' })
}

export async function deleteDownload(id: any) {
  const csrf = getCsrfToken()
  const body = new FormData()
  if (csrf) {
    body.append('csrf_token', csrf)
  }

  try {
    await send(`/delete_download/${id}`, { method: 'POST', body, label: 'delete_download' })
  } catch (err: any) {
    if (err?.status !== 302) {
      throw err
    }
  }

  return true
}
