/**
 * Soft-detect “N games added to Library X” notifications from watch/scan.
 * Backend may send `kind` / `type` or only title/body — tolerate either.
 *
 * Shared by member-app and admin-app (UX-B7): staff watching a scan live on
 * admin pages, members browsing the library.
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

const COUNT_RE = /(\d+)\s+games?\s+added/i
const LIBRARY_RE = /added\s+to\s+library\s+(.+?)\s*$/i

/** Library a notification belongs to, for grouping. Falls back to its own id
 *  so an unattributable row still toasts once rather than merging with others. */
export function libraryKeyOf(row) {
  const named =
    row?.library ||
    row?.library_name ||
    row?.library_uuid ||
    row?.data?.library ||
    row?.data?.library_name
  if (named) return String(named)

  const text = `${row?.title || ''} ${row?.body || ''} ${row?.message || ''}`
  const match = LIBRARY_RE.exec(text.trim())
  if (match) return match[1].trim()

  return `__row_${row?.id ?? row?.uuid ?? row?.created_at ?? Math.random()}`
}

/** Games added, for summing a burst into one figure. Unknown counts as 1 so a
 *  countless notification still contributes rather than reading as zero. */
export function addedCountOf(row) {
  const explicit = Number(row?.count ?? row?.added ?? row?.data?.count)
  if (Number.isFinite(explicit) && explicit > 0) return explicit

  const text = `${row?.title || ''} ${row?.body || ''} ${row?.message || ''}`
  const match = COUNT_RE.exec(text)
  return match ? Number(match[1]) : 1
}

/**
 * Collapse a batch of notifications to one entry per library (GT-B11).
 *
 * A scan emits a notification per increment, so a library of any size produced
 * a stream of near-identical toasts — "3 games added", "2 games added", "5
 * games added" — which is noise standing in for one useful fact. Grouping by
 * library and summing gives a single toast per library per poll, which is the
 * granularity anyone actually wants.
 *
 * @returns {Array<{key: string, rows: object[], total: number, library: string}>}
 */
export function groupLibraryScanToasts(rows) {
  const groups = new Map()
  for (const row of rows) {
    const key = libraryKeyOf(row)
    if (!groups.has(key)) {
      groups.set(key, { key, rows: [], total: 0, library: key.startsWith('__row_') ? '' : key })
    }
    const group = groups.get(key)
    group.rows.push(row)
    group.total += addedCountOf(row)
  }
  return [...groups.values()]
}

/** One line for a whole library's batch. */
export function groupedToastMessage(group) {
  if (group.rows.length === 1) {
    return libraryGamesAddedToastMessage(group.rows[0])
  }
  const games = `${group.total} game${group.total === 1 ? '' : 's'}`
  return group.library ? `${games} added to ${group.library}` : `${games} added`
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
  const limit = options.limit ?? 50
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
