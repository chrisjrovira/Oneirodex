import { createUpdatesApi } from '@oneirodex/api-client'

import { getJson, memberResource, postJson, withMemberError } from './client'

const updates = memberResource(createUpdatesApi)

export async function fetchUpdatesInbox({
  signal,
  limit = 100,
}: { signal?: AbortSignal; limit?: number } = {}) {
  return withMemberError(updates.inbox({ limit, signal }), 'updates/inbox')
}

/**
 * Re-probe library titles against the stores, oldest-checked first.
 *
 * One call is one bounded batch — see POST /api/updates/scan for why. The
 * response carries `remaining`, so the page can tell the member how much of
 * their library is still unswept rather than implying one press did all of it.
 */
export async function scanLibraryUpdates({
  limit,
  libraryUuid,
  signal,
}: { limit?: number; libraryUuid?: string; signal?: AbortSignal } = {}) {
  return withMemberError(
    updates.scan(
      {
        ...(limit ? { limit } : {}),
        ...(libraryUuid ? { library_uuid: libraryUuid } : {}),
      },
      signal,
    ),
    'updates/scan',
  )
}

export async function fetchStoreSearch({
  q,
  source = 'all',
  limit = 8,
  signal,
}: { q?: string; source?: string; limit?: number; signal?: AbortSignal } = {}) {
  return withMemberError(
    updates.storeSearch({ q: q || '', source, limit, signal }),
    'updates/store_search',
  )
}

export async function addWantedUpdate(payload: Record<string, unknown>) {
  return (await withMemberError(updates.addWanted(payload), 'wanted')) ?? {}
}

// Acquire is a different surface (`/api/acquire/*`, Arr/debrid) and has no
// typed module yet — these three stay on the raw verbs until it does.

export async function fetchAcquireStatus({ signal }: { signal?: AbortSignal } = {}) {
  return getJson('/api/acquire/status', { signal, label: 'acquire/status' })
}

export async function searchAcquire(q: string, { signal }: { signal?: AbortSignal } = {}) {
  return getJson(`/api/acquire/search?q=${encodeURIComponent(q || '')}`, {
    signal,
    label: 'acquire/search',
  })
}

export async function sendAcquireDownload({
  url,
  provider,
}: { url?: string; provider?: string } = {}) {
  return (await postJson('/api/acquire/download', { url, provider }, { label: 'acquire' })) ?? {}
}
