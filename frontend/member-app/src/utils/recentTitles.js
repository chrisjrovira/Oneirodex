/** Recently opened titles for the command-palette empty state.

This browser only — no telemetry, no household broadcast. Played titles come
from the server; this list fills the gap while a vault is still scanning and
nobody has playtime yet.
*/

export const RECENT_TITLES_KEY = 'od.palette.recent'
export const RECENT_TITLES_MAX = 8

export function normalizeRecentTitle(row) {
  const uuid = String(row?.uuid || '').trim()
  const name = String(row?.name || '').trim()
  if (!uuid || !name) return null
  return { uuid, name, hint: row?.hint || 'Opened here' }
}

export function readRecentTitles() {
  try {
    const raw = window.localStorage?.getItem(RECENT_TITLES_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeRecentTitle).filter(Boolean).slice(0, RECENT_TITLES_MAX)
  } catch {
    return []
  }
}

export function recordRecentTitle(row) {
  const next = normalizeRecentTitle(row)
  if (!next) return readRecentTitles()
  const rest = readRecentTitles().filter((item) => item.uuid !== next.uuid)
  const list = [next, ...rest].slice(0, RECENT_TITLES_MAX)
  try {
    window.localStorage?.setItem(RECENT_TITLES_KEY, JSON.stringify(list))
  } catch {
    // Preference only.
  }
  return list
}

/** Server played-rows first; local opened-rows fill unused slots. */
export function mergeSuggestRecent(serverRows, localRows, limit = RECENT_TITLES_MAX) {
  const cap = Number(limit) > 0 ? Number(limit) : RECENT_TITLES_MAX
  const merged = []
  const seen = new Set()
  for (const row of [...(serverRows || []), ...(localRows || [])]) {
    const item = normalizeRecentTitle(row)
    if (!item || seen.has(item.uuid)) continue
    seen.add(item.uuid)
    merged.push({
      uuid: item.uuid,
      name: item.name,
      hint: row?.hint || item.hint,
      cover_url: row?.cover_url || null,
    })
    if (merged.length >= cap) break
  }
  return merged
}
