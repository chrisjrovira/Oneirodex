/**
 * Soft-detect “N games added to Library X” notifications from watch/scan.
 * Backend may send `kind` / `type` or only title/body — tolerate either.
 */

const KIND_HINTS = new Set([
  'library_games_added',
  'library_added',
  'library_scan_added',
  'games_added',
  'library_incremental',
])

const TITLE_BODY_RE = /\d+\s+games?\s+added\s+to\s+library/i

const SEEN_KEY = 'gametheca.libraryScanToasts.seen.v1'

/**
 * @param {object | null | undefined} row
 */
export function isLibraryGamesAddedNotification(row) {
  if (!row || typeof row !== 'object') {
    return false
  }
  const kind = String(row.kind || row.type || row.category || '')
    .trim()
    .toLowerCase()
  if (KIND_HINTS.has(kind)) {
    return true
  }
  const text = `${row.title || ''} ${row.body || ''} ${row.message || ''}`
  return TITLE_BODY_RE.test(text)
}

/**
 * @param {object} row
 * @returns {string}
 */
export function libraryGamesAddedToastMessage(row) {
  const title = String(row?.title || '').trim()
  if (title) {
    return title
  }
  const body = String(row?.body || row?.message || '').trim()
  if (body) {
    return body
  }
  return 'Games added to library'
}

function readSeenIds() {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY)
    if (!raw) {
      return new Set()
    }
    const parsed = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed.map(String) : [])
  } catch {
    return new Set()
  }
}

function writeSeenIds(ids) {
  try {
    const list = [...ids].slice(-80)
    sessionStorage.setItem(SEEN_KEY, JSON.stringify(list))
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Mark a notification id as toasted this session.
 * @param {string | number} id
 */
export function markLibraryScanToastSeen(id) {
  if (id == null || id === '') {
    return
  }
  const seen = readSeenIds()
  seen.add(String(id))
  writeSeenIds(seen)
}

/**
 * @param {string | number} id
 */
export function wasLibraryScanToastSeen(id) {
  if (id == null || id === '') {
    return false
  }
  return readSeenIds().has(String(id))
}

/**
 * Pick unseen library-added rows to toast (newest first, capped).
 * @param {object[]} notifications
 * @param {{ limit?: number }} [options]
 */
export function pickUnseenLibraryScanToasts(notifications, options = {}) {
  const limit = options.limit ?? 3
  const rows = Array.isArray(notifications) ? notifications : []
  const out = []
  for (const row of rows) {
    if (!isLibraryGamesAddedNotification(row)) {
      continue
    }
    const id = row.id ?? row.uuid ?? row.created_at ?? row.title
    if (wasLibraryScanToastSeen(id)) {
      continue
    }
    out.push(row)
    if (out.length >= limit) {
      break
    }
  }
  return out
}
