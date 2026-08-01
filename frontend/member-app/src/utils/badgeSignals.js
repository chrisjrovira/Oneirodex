import { ITEM_KIND_BADGE, resolveItemKind } from './itemKind'

/** Days after import that a game still counts as NEW (library default). */
export const NEW_IMPORT_WINDOW_DAYS = 14

/** Days after store/IGDB release that RELEASE badge may show. */
export const RELEASE_WINDOW_DAYS = 30

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Badge kinds ordered by display priority (highest first).
 * @typedef {'UPDATE' | 'OUT' | 'MISSING' | 'NEW' | 'EXP' | 'EMU' | 'TOOL' | 'RELEASE' | '~' | 'OWNED' | 'LANG' | 'PATCH' | 'VR' | 'L'} BadgeKind
 */

/** @type {Record<BadgeKind, number>} */
export const BADGE_PRIORITY = {
  UPDATE: 100,
  OUT: 90,
  MISSING: 85,
  NEW: 80,
  EXP: 74,
  EMU: 74,
  TOOL: 74,
  RELEASE: 70,
  '~': 60,
  LANG: 55,
  OWNED: 50,
  PATCH: 45,
  VR: 20,
  L: 10,
}

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
 * @param {{ now?: Date, newWindowDays?: number, releaseWindowDays?: number, maxVisible?: number }} [options]
 * @returns {{ kind: BadgeKind, label: string, title: string, tone: string }[]}
 */
export function collectBadgeSignals(game, options = {}) {
  const now = options.now || new Date()
  const newWindow = options.newWindowDays ?? NEW_IMPORT_WINDOW_DAYS
  const releaseWindow = options.releaseWindowDays ?? RELEASE_WINDOW_DAYS
  const badges = []

  const freshness = game.freshness_status
  if (freshness === 'behind') {
    badges.push({
      kind: 'OUT',
      label: 'OUT',
      title: 'Behind store version (high confidence)',
      tone: 'danger',
    })
    badges.push({
      kind: 'UPDATE',
      label: 'UPDATE',
      title: 'Update available vs store',
      tone: 'warn',
    })
  } else if (freshness === 'heuristic_behind') {
    badges.push({
      kind: '~',
      label: '~',
      title: 'Possibly behind store (heuristic)',
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

  const release =
    parseDate(game.first_release_date) || parseDate(game.release_date)
  if (isWithinDays(release, releaseWindow, now)) {
    badges.push({
      kind: 'RELEASE',
      label: 'RELEASE',
      title: 'Recent release window',
      tone: 'info',
    })
  }

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
 * Corner placement with collision fallbacks.
 * Prefer top-left (UPDATE/OUT/MISSING/NEW/VR) — hamburger + favorite now stack together
 * in the top-right band (hamburger on top, favorite directly under it), so
 * badges avoid that whole corner until top-left/bottom-left are unavailable.
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
  // VR / MISSING + transitional stack own top-left exclusively — never fall onto the system chip.
  if (hasVr || hasMissing) {
    return 'top-left'
  }
  const order = ['top-left', 'bottom-left', 'bottom-right', 'top-right'].filter(
    (corner) => !(hasPlatformChip && corner === 'bottom-left'),
  )
  if (!collidesWithTitle) {
    return order.includes(preferred) ? preferred : order[0]
  }
  const start = order.indexOf(preferred)
  const idx = start < 0 ? 0 : start
  return order[(idx + 1) % order.length]
}
