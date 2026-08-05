import { ITEM_KIND_BADGE, resolveItemKind } from './itemKind'

/** Days after import that a game still counts as NEW (library default). */
export const NEW_IMPORT_WINDOW_DAYS = 14

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Badge kinds ordered by display priority (highest first).
 * Retired tile labels (2026-08-01): OUT · ~ · RELEASE — client omit only.
 * @typedef {'UPDATE' | 'MISSING' | 'NEW' | 'EXP' | 'EMU' | 'TOOL' | 'OWNED' | 'LANG' | 'PATCH' | 'VR' | 'L'} BadgeKind
 */

/** @type {Record<BadgeKind, number>} */
export const BADGE_PRIORITY = {
  UPDATE: 100,
  MISSING: 85,
  NEW: 80,
  EXP: 74,
  EMU: 74,
  TOOL: 74,
  LANG: 55,
  OWNED: 50,
  PATCH: 45,
  VR: 20,
  L: 10,
}

/** Preferred corner per kind (operator layout map for UID-001). */
export const BADGE_CORNER_PREFERENCE = {
  UPDATE: 'top-left',
  MISSING: 'top-left',
  NEW: 'top-left',
  VR: 'top-left',
  EXP: 'bottom-right',
  EMU: 'bottom-right',
  TOOL: 'bottom-right',
  LANG: 'bottom-right',
  OWNED: 'bottom-right',
  PATCH: 'top-right',
  L: 'top-right',
}

/** Corner visit order when preferred is taken or unavailable. */
export const BADGE_CORNER_FALLBACK = [
  'top-left',
  'bottom-left',
  'bottom-right',
  'top-right',
]

/**
 * True when browse/details payload marks the title as removed from disk.
 * Accepts `path_status=missing` or boolean `path_missing`.
 * @param {object | null | undefined} game
 */
export function isPathMissing(game) {
  if (!game || typeof game !== 'object') {
    return false
  }
  if (game.path_missing === true || game.path_missing === 1 || game.path_missing === '1') {
    return true
  }
  const status = String(game.path_status || '').trim().toLowerCase()
  return status === 'missing'
}

/**
 * @param {string | number | Date | null | undefined} value
 * @returns {Date | null}
 */
export function parseDate(value) {
  if (value == null || value === '') {
    return null
  }
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * @param {Date | null} date
 * @param {number} windowDays
 * @param {Date} [now]
 */
export function isWithinDays(date, windowDays, now = new Date()) {
  if (!date) {
    return false
  }
  const ageMs = now.getTime() - date.getTime()
  return ageMs >= 0 && ageMs <= windowDays * MS_PER_DAY
}

/**
 * Build ordered badge descriptors for a browse/API game object.
 *
 * @param {object} game
 * @param {{ now?: Date, newWindowDays?: number }} [options]
 * @returns {{ kind: BadgeKind, label: string, title: string, tone: string }[]}
 */
export function collectBadgeSignals(game, options = {}) {
  const now = options.now || new Date()
  const newWindow = options.newWindowDays ?? NEW_IMPORT_WINDOW_DAYS
  const badges = []

  const freshness = game.freshness_status
  // OUT / ~ retired — UPDATE alone when store is behind or local update flags fire.
  if (freshness === 'behind') {
    badges.push({
      kind: 'UPDATE',
      label: 'UPDATE',
      title: 'Update available vs store',
      tone: 'warn',
    })
  }

  if (game.has_updates || game.update_available) {
    if (!badges.some((b) => b.kind === 'UPDATE')) {
      badges.push({
        kind: 'UPDATE',
        label: 'UPDATE',
        title: 'Local update or extras available',
        tone: 'warn',
      })
    }
  }

  if (isPathMissing(game)) {
    badges.push({
      kind: 'MISSING',
      label: 'MISSING',
      title: 'Removed from disk — game files are no longer on disk',
      tone: 'missing',
    })
  }

  const identified =
    parseDate(game.date_identified) ||
    parseDate(game.date_created) ||
    parseDate(game.created_at)
  if (isWithinDays(identified, newWindow, now)) {
    badges.push({
      kind: 'NEW',
      label: 'NEW',
      title: 'Newly added to library',
      tone: 'accent',
    })
  }

  // RELEASE retired — first_release_date ignored for tile badges.

  if (game.owned || game.store_owned) {
    badges.push({
      kind: 'OWNED',
      label: 'OWNED',
      title: 'Matched to store ownership',
      tone: 'owned',
    })
  }

  if (game.needs_translation) {
    const locale = game.preferred_game_locale || 'en-US'
    const regionBit = game.rom_region ? `${game.rom_region} · ` : ''
    badges.push({
      kind: 'LANG',
      label: 'LANG',
      title: `${regionBit}ROM language may not match ${locale}`,
      tone: 'warn',
    })
  }

  if (game.has_translation_patch) {
    badges.push({
      kind: 'PATCH',
      label: 'PATCH',
      title: 'Translation patch available in extras',
      tone: 'info',
    })
  }

  const itemKind = resolveItemKind(game)
  const kindBadge = ITEM_KIND_BADGE[itemKind]
  if (kindBadge) {
    badges.push({ ...kindBadge })
  }

  if (game.is_vr) {
    badges.push({
      kind: 'VR',
      label: 'VR',
      title: 'Virtual Reality',
      tone: 'muted',
    })
  }

  if (game.has_local_override) {
    badges.push({
      kind: 'L',
      label: 'L',
      title: 'Uses local metadata or images',
      tone: 'meta',
    })
  }

  const byKind = new Map()
  for (const badge of badges) {
    const existing = byKind.get(badge.kind)
    if (!existing || BADGE_PRIORITY[badge.kind] > BADGE_PRIORITY[existing.kind]) {
      byKind.set(badge.kind, badge)
    }
  }

  return [...byKind.values()].sort(
    (a, b) => (BADGE_PRIORITY[b.kind] || 0) - (BADGE_PRIORITY[a.kind] || 0),
  )
}

/**
 * Cap visible badges and return overflow count.
 * @param {ReturnType<typeof collectBadgeSignals>} badges
 * @param {number} [maxVisible=2]
 */
export function capBadges(badges, maxVisible = 2) {
  if (badges.length <= maxVisible) {
    return { visible: badges, overflow: 0 }
  }
  return {
    visible: badges.slice(0, maxVisible),
    overflow: badges.length - maxVisible,
  }
}

/**
 * Available corners for tile badges (skips bottom-left when platform chip owns it).
 * @param {{ hasPlatformChip?: boolean }} [options]
 * @returns {Array<'top-left' | 'top-right' | 'bottom-right' | 'bottom-left'>}
 */
export function availableBadgeCorners(options = {}) {
  const { hasPlatformChip = false } = options
  return BADGE_CORNER_FALLBACK.filter(
    (corner) => !(hasPlatformChip && corner === 'bottom-left'),
  )
}

/**
 * Place badges into corners only — one tight stack per occupied corner.
 * Empty corners are omitted (no spacers / reserved slots).
 * Overflow `+N` is a corner occupant when present.
 *
 * @param {ReturnType<typeof collectBadgeSignals>} badges
 * @param {{
 *   hasPlatformChip?: boolean,
 *   collidesWithTitle?: boolean,
 *   maxPerCorner?: number,
 * }} [options]
 * @returns {{
 *   corners: Array<{
 *     corner: 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left',
 *     badges: ReturnType<typeof collectBadgeSignals>,
 *     overflow: number,
 *   }>,
 *   hasVr: boolean,
 *   hasMissing: boolean,
 * }}
 */
export function layoutBadgesByCorner(badges, options = {}) {
  const {
    hasPlatformChip = false,
    collidesWithTitle = false,
    maxPerCorner = 2,
  } = options

  const corners = availableBadgeCorners({ hasPlatformChip })
  /** @type {Map<string, ReturnType<typeof collectBadgeSignals>>} */
  const buckets = new Map()
  let overflow = 0
  /** @type {string | null} */
  let overflowAt = null

  function room(corner) {
    return (buckets.get(corner)?.length || 0) < maxPerCorner
  }

  function pickCorner(preferred, forceTopLeft = false) {
    if (forceTopLeft && corners.includes('top-left') && room('top-left')) {
      return 'top-left'
    }
    let start = corners.includes(preferred) ? preferred : corners[0]
    if (collidesWithTitle && start === 'top-left' && !forceTopLeft && corners.length > 1) {
      start = corners.find((c) => c !== 'top-left') || start
    }
    const ordered = [start, ...corners.filter((c) => c !== start)]
    for (const corner of ordered) {
      if (room(corner)) return corner
    }
    return null
  }

  function place(badge, forceTopLeft = false) {
    const preferred = BADGE_CORNER_PREFERENCE[badge.kind] || 'top-left'
    const corner = pickCorner(preferred, forceTopLeft)
    if (!corner) {
      overflow += 1
      return
    }
    const list = buckets.get(corner) || []
    list.push(badge)
    buckets.set(corner, list)
  }

  const sorted = [...badges].sort(
    (a, b) => (BADGE_PRIORITY[b.kind] || 0) - (BADGE_PRIORITY[a.kind] || 0),
  )
  const pinned = sorted.filter((b) => b.kind === 'VR' || b.kind === 'MISSING')
  const flexible = sorted.filter((b) => b.kind !== 'VR' && b.kind !== 'MISSING')

  for (const badge of pinned) {
    place(badge, true)
  }
  for (const badge of flexible) {
    place(badge, false)
  }

  if (overflow > 0) {
    overflowAt =
      corners.find((c) => room(c)) ||
      [...buckets.keys()][0] ||
      corners[0] ||
      null
    if (overflowAt && !buckets.has(overflowAt)) {
      buckets.set(overflowAt, [])
    }
  }

  const hasVr = sorted.some((b) => b.kind === 'VR')
  const hasMissing = sorted.some((b) => b.kind === 'MISSING')

  const result = []
  for (const corner of BADGE_CORNER_FALLBACK) {
    const list = buckets.get(corner)
    const cornerOverflow = overflow > 0 && overflowAt === corner ? overflow : 0
    if ((!list || list.length === 0) && cornerOverflow === 0) {
      continue
    }
    result.push({
      corner,
      badges: list || [],
      overflow: cornerOverflow,
    })
  }

  return { corners: result, hasVr, hasMissing }
}

/**
 * Corner placement with collision fallbacks (legacy single-stack helper).
 * Prefer top-left (UPDATE/MISSING/NEW/VR) — hamburger + favorite stack top-right.
 * VR / MISSING always stay top-left (never overlap the system/platform chip at bottom-left).
 * When a platform chip occupies bottom-left, skip that corner.
 * Order: top-left → bottom-left → bottom-right → top-right
 *
 * @param {'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'} preferred
 * @param {boolean} [collidesWithTitle]
 * @param {{ hasVr?: boolean, hasMissing?: boolean, hasPlatformChip?: boolean }} [options]
 */
export function resolveBadgeCorner(preferred = 'top-left', collidesWithTitle = false, options = {}) {
  const { hasVr = false, hasMissing = false, hasPlatformChip = false } = options
  if (hasVr || hasMissing) {
    return 'top-left'
  }
  const cascade = hasPlatformChip
    ? availableBadgeCorners({ hasPlatformChip })
    : ['top-left', 'bottom-left', 'bottom-right', 'top-right']
  if (!collidesWithTitle) {
    return cascade.includes(preferred) ? preferred : cascade[0]
  }
  const start = cascade.indexOf(preferred)
  const idx = start < 0 ? 0 : start
  return cascade[(idx + 1) % cascade.length]
}
