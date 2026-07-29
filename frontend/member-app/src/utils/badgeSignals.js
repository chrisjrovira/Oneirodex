/** Days after import that a game still counts as NEW (library default). */
export const NEW_IMPORT_WINDOW_DAYS = 14

/** Days after store/IGDB release that RELEASE badge may show. */
export const RELEASE_WINDOW_DAYS = 30

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Badge kinds ordered by display priority (highest first).
 * @typedef {'UPDATE' | 'OUT' | 'NEW' | 'RELEASE' | '~' | 'OWNED' | 'LANG' | 'PATCH' | 'VR' | 'L'} BadgeKind
 */

/** @type {Record<BadgeKind, number>} */
export const BADGE_PRIORITY = {
  UPDATE: 100,
  OUT: 90,
  NEW: 80,
  RELEASE: 70,
  '~': 60,
  LANG: 55,
  OWNED: 50,
  PATCH: 45,
  VR: 20,
  L: 10,
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
 * Prefer top-left (UPDATE/OUT/NEW/VR) — hamburger is top-right, favorite bottom-right.
 * VR lives in the same top-left transitional stack (never dismissable).
 * Order: top-left → bottom-left → top-right → bottom-right
 *
 * @param {'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'} preferred
 * @param {boolean} [collidesWithTitle]
 */
export function resolveBadgeCorner(preferred = 'top-left', collidesWithTitle = false) {
  const order = ['top-left', 'bottom-left', 'top-right', 'bottom-right']
  if (!collidesWithTitle) {
    return preferred
  }
  const start = order.indexOf(preferred)
  const idx = start < 0 ? 0 : start
  return order[(idx + 1) % order.length]
}
