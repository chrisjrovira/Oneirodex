/**
 * Notifications surface: the inbox/archive list, the per-member preference
 * toggles, and the mark-read writes.
 *
 * These were inlined in NotificationsPage — the list/preferences reads as
 * `fetch().then()` pairs inside a `Promise.all`, the writes as bare `fetch()`
 * in click handlers. Consolidated here in wave B1.4 so the reads report through
 * the shared envelope builder. The writes are fire-and-forget by existing
 * design — the handler calls `load()` again afterwards — so they resolve to the
 * response's `ok` flag rather than throwing into a `void`-ed handler.
 */
import { csrfHeaders, errorFromResponse } from '@oneirodex/ui'

/**
 * @param {'inbox'|'archive'} view  the inbox is server-side "unread=1"; archive
 *   takes a deeper page because the read rows are the bulk of it.
 */
export async function fetchNotifications({ view = 'inbox', signal }: LooseProps = {}) {
  const query = view === 'inbox' ? '?unread=1&limit=100' : '?limit=100'
  const response = await fetch(`/api/notifications${query}`, {
    credentials: 'same-origin',
    signal,
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'notifications')
  }
  return response.json()
}

export async function fetchNotificationPreferences({ signal }: LooseProps = {}) {
  const response = await fetch('/api/notifications/preferences', {
    credentials: 'same-origin',
    signal,
  })
  if (!response.ok) {
    throw await errorFromResponse(response, 'preferences')
  }
  return response.json()
}

export async function markNotificationsRead({ all = false, ids }: LooseProps = {}) {
  const body = all ? { all: true } : { ids: ids || [] }
  const response = await fetch('/api/notifications/read', {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  return response.ok
}

export async function saveNotificationPreferences(patch: any) {
  const response = await fetch('/api/notifications/preferences', {
    method: 'POST',
    credentials: 'same-origin',
    headers: csrfHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(patch),
  })
  return response.ok
}
