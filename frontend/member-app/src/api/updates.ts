import { getJson, postJson } from './client'

export async function fetchUpdatesInbox({ signal, limit = 100 }: LooseProps = {}) {
  return getJson(`/api/updates/inbox?limit=${limit}`, { signal, label: 'updates/inbox' })
}

/**
 * Re-probe library titles against the stores, oldest-checked first.
 *
 * One call is one bounded batch — see POST /api/updates/scan for why. The
 * response carries `remaining`, so the page can tell the member how much of
 * their library is still unswept rather than implying one press did all of it.
 */
export async function scanLibraryUpdates({ limit, libraryUuid, signal }: LooseProps = {}) {
  return postJson(
    '/api/updates/scan',
    {
      ...(limit ? { limit } : {}),
      ...(libraryUuid ? { library_uuid: libraryUuid } : {}),
    },
    { signal, label: 'updates/scan' },
  )
}

export async function fetchStoreSearch({ q, source = 'all', limit = 8, signal }: LooseProps = {}) {
  const params = new URLSearchParams({
    q: q || '',
    source,
    limit: String(limit),
  })
  return getJson(`/api/updates/store_search?${params}`, { signal, label: 'updates/store_search' })
}

export async function addWantedUpdate(payload: any) {
  return (await postJson('/api/updates/wanted', payload, { label: 'wanted' })) ?? {}
}

export async function fetchAcquireStatus({ signal }: LooseProps = {}) {
  return getJson('/api/acquire/status', { signal, label: 'acquire/status' })
}

export async function searchAcquire(q: any, { signal }: LooseProps = {}) {
  return getJson(`/api/acquire/search?q=${encodeURIComponent(q || '')}`, {
    signal,
    label: 'acquire/search',
  })
}

export async function sendAcquireDownload({ url, provider }: LooseProps = {}) {
  return (await postJson('/api/acquire/download', { url, provider }, { label: 'acquire' })) ?? {}
}
