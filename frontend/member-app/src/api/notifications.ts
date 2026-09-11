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
import { getJson, sendResult } from './client'

function httpFailure(err: any) {
  return typeof err?.status === 'number'
}

/**
 * @param {'inbox'|'archive'} view  the inbox is server-side "unread=1"; archive
 *   takes a deeper page because the read rows are the bulk of it.
 */
export async function fetchNotifications({ view = 'inbox', signal }: LooseProps = {}) {
  const query = view === 'inbox' ? '?unread=1&limit=100' : '?limit=100'
  return getJson(`/api/notifications${query}`, { signal, label: 'notifications' })
}

/** Soft poll for library-scan toasts — HTTP failures resolve to null. */
export async function fetchNotificationSnapshot({ limit = 20, signal }: LooseProps = {}) {
  try {
    return await getJson(`/api/notifications?limit=${encodeURIComponent(limit)}`, {
      signal,
      label: 'notifications',
    })
  } catch (err: any) {
    if (httpFailure(err)) return null
    throw err
  }
}

export async function fetchNotificationPreferences({ signal }: LooseProps = {}) {
  return getJson('/api/notifications/preferences', { signal, label: 'preferences' })
}

export async function markNotificationsRead({ all = false, ids }: LooseProps = {}) {
  const body = all ? { all: true } : { ids: ids || [] }
  const result = await sendResult('/api/notifications/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return result.ok
}

export async function saveNotificationPreferences(patch: any) {
  const result = await sendResult('/api/notifications/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  return result.ok
}
