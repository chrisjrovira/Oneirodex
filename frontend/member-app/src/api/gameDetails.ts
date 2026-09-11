import { getJson, postJson } from './client'

export async function fetchGameDetails(gameUuid: any, { signal }: LooseProps = {}) {
  return (
    (await getJson(`/api/games/${encodeURIComponent(gameUuid)}/details`, {
      signal,
      label: 'game details',
    })) ?? {}
  )
}

export async function fetchGameMoreFrom(gameUuid: any, { signal }: LooseProps = {}) {
  return (
    (await getJson(`/api/games/${encodeURIComponent(gameUuid)}/more_from`, {
      signal,
      label: 'more from',
    })) ?? { sections: [] }
  )
}

export async function fetchGameVersions(gameUuid: any, { signal }: LooseProps = {}) {
  return getJson(`/api/games/${encodeURIComponent(gameUuid)}/versions`, {
    signal,
    label: 'game versions',
  })
}

export async function checkGameFreshness(gameUuid: any) {
  return (
    (await postJson(
      `/api/games/${encodeURIComponent(gameUuid)}/freshness/check`,
      {},
      {
        label: 'freshness check',
      },
    )) ?? {}
  )
}

/**
 * Librarian/admin: remove version rows whose files are missing on disk (Wave 14b).
 * @param {string} gameUuid
 * @returns {Promise<object>}
 */
export async function cleanupOrphanVersions(gameUuid: any) {
  return (
    (await postJson(
      `/api/games/${encodeURIComponent(gameUuid)}/versions/cleanup_orphans`,
      {},
      { label: 'cleanup orphans' },
    )) ?? {}
  )
}

export async function fetchRelatedMedia(gameUuid: any) {
  return (
    (await getJson(`/api/games/${gameUuid}/related_media`, { label: 'related media' })) ?? {
      items: [],
      kinds: [],
    }
  )
}
