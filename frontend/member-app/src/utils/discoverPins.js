/**
 * Pinned Discover shelves.
 *
 * Stored per-device in localStorage rather than in member preferences: this is
 * "keep this row where I can see it on this screen", which is the same class of
 * setting as the rail's collapsed state, and adding it to the preferences form
 * would mean a schema column and a round trip for a choice that has to survive
 * exactly one reload.
 *
 * Everything here degrades to "nothing is pinned" when storage is unavailable
 * (private windows, embedded webviews, the Tauri client's stricter contexts) —
 * a shelf order is not worth a thrown exception on page load.
 */

const KEY = 'gt.discover.pinned'

function readRaw() {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

/** @returns {string[]} shelf identifiers, in the order they were pinned. */
export function loadPinnedShelves() {
  if (typeof window === 'undefined') return []
  return readRaw()
}

/** @returns {string[]} the list as it now stands, so callers need not re-read. */
export function togglePinnedShelf(id) {
  if (typeof window === 'undefined' || !id) return []
  const current = readRaw()
  const next = current.includes(id)
    ? current.filter((entry) => entry !== id)
    : [...current, id]
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Storage refused (quota, private mode). The in-memory list below still
    // reorders the page for this session, which is the visible half.
  }
  return next
}

/**
 * Pinned shelves first, in pin order; everything else keeps its server order.
 *
 * A stable partition rather than a sort: the server's `display_order` is an
 * admin's deliberate arrangement, and a comparator that only knows "pinned"
 * would be free to shuffle the rest.
 *
 * @param {Array<{identifier?: string, title?: string}>} sections
 * @param {string[]} pinned
 */
export function orderShelves(sections, pinned) {
  if (!Array.isArray(sections) || !pinned?.length) return sections || []
  const idOf = (section) => String(section.identifier || section.title || '')
  const pinnedSet = new Set(pinned)
  const head = pinned
    .map((id) => sections.find((section) => idOf(section) === id))
    .filter(Boolean)
  const tail = sections.filter((section) => !pinnedSet.has(idOf(section)))
  return [...head, ...tail]
}
