/**
 * Locked Library-tile platform abbreviations (Wave 15a / @agent-gamemaster).
 * Display abbrev on tiles; keep full name in title/tooltip.
 */

const PLATFORM_ABBREV = Object.freeze({
  NES: 'NES',
  SNES: 'SNES',
  N64: 'N64',
  NGC: 'GC',
  GB: 'GB',
  GBC: 'GBC',
  GBA: 'GBA',
  NDS: 'NDS',
  VB: 'VB',
  WII: 'WII',
  N3DS: '3DS',
  SWITCH: 'NSW',
  SEGA_MD: 'MD',
  SEGA_MS: 'SMS',
  SEGA_CD: 'SCD',
  SEGA_32X: '32X',
  SEGA_GG: 'GG',
  SEGA_SATURN: 'SAT',
  SEGA_DC: 'DC',
  PSX: 'PS1',
  PS2: 'PS2',
  PS3: 'PS3',
  PS4: 'PS4',
  PS5: 'PS5',
  PSP: 'PSP',
  PSVITA: 'VITA',
  XBOX: 'XB',
  X360: '360',
  XONE: 'XONE',
  XSX: 'XSX',
  PCWIN: 'PC',
  PCDOS: 'DOS',
  MAC: 'MAC',
  ARCADE: 'ARC',
  NEOGEO: 'AES',
  NEOGEO_CD: 'NCD',
  PCE: 'PCE',
  PCFX: 'PCFX',
  ATARI_2600: '2600',
  ATARI_5200: '5200',
  ATARI_7800: '7800',
  LYNX: 'LYNX',
  JAGUAR: 'JAG',
  WS: 'WS',
  NGP: 'NGP',
  COLECO: 'COL',
  THREEDO: '3DO',
  VECTREX: 'VEC',
  INTV: 'INTV',
  CHAF: 'CHAF',
  O2EM: 'O2',
  VICE_X64SC: 'C64',
  VICE_X128: 'C128',
  VICE_XVIC: 'VIC',
  VICE_XPLUS4: 'P4',
  VICE_XPET: 'PET',
  OTHER: 'OTHER',
})

/**
 * @param {string|null|undefined} platformId library_platform enum
 * @returns {string} short tile label (falls back to first letters of unknown ids)
 */
export function abbreviatePlatform(platformId) {
  if (platformId == null || platformId === '') {
    return ''
  }
  const id = String(platformId).trim().toUpperCase()
  if (PLATFORM_ABBREV[id]) {
    return PLATFORM_ABBREV[id]
  }
  // Unknown enums: compact initials from underscore segments (no invented brand names).
  const parts = id.split(/[_\s]+/).filter(Boolean)
  if (parts.length >= 2) {
    return parts
      .map((p) => (p.length <= 3 ? p : p.slice(0, 1)))
      .join('')
      .slice(0, 6)
  }
  return id.length <= 6 ? id : id.slice(0, 6)
}

/**
 * @param {{ library_platform?: string, library_platform_label?: string }|null|undefined} game
 * @returns {{ abbrev: string, full: string }}
 */
export function platformChipLabels(game) {
  const id = game?.library_platform || ''
  const full = (game?.library_platform_label || id || '').trim()
  const abbrev = abbreviatePlatform(id) || full
  return { abbrev, full: full || abbrev }
}

/**
 * The platform chip for a tile that stands for copies on several systems.
 *
 * Browse collapses copies of one title into one row and sends
 * `edition_platforms` ordered newest hardware first, so which system to name is
 * already decided — with one exception. Filtered to a system, the tile *is*
 * that system's copy, and naming a different one would be a lie about what you
 * are looking at: on NES with a title also on GBA and SNES, the chip reads NES,
 * not GBA.
 *
 * The `+N` counts the **other** systems, which is what `+N` means everywhere
 * else it appears in this UI (badge overflow, and the preview's system count).
 * So NES · GBA · SNES filtered to NES reads `NES +2`, and unfiltered reads
 * `GBA +2`.
 *
 * @param {object} game browse row
 * @param {string} [activePlatform] the `library_platform` filter, when set
 * @returns {{abbrev: string, full: string, extra: number} | null}
 */
export function editionChipLabels(game, activePlatform = '') {
  const platforms = Array.isArray(game?.edition_platforms)
    ? game.edition_platforms.filter(Boolean)
    : []

  // No grouping information: fall back to the tile's own system, which is what
  // the chip showed before this existed.
  if (platforms.length === 0) {
    const base = platformChipLabels(game)
    return base.abbrev ? { ...base, extra: 0 } : null
  }

  const active = String(activePlatform || '')
  const lead = active && platforms.includes(active) ? active : platforms[0]
  const abbrev = abbreviatePlatform(lead) || lead
  const full =
    lead === game?.library_platform
      ? (game?.library_platform_label || lead)
      : lead

  return { abbrev, full, extra: Math.max(0, platforms.length - 1) }
}

export { PLATFORM_ABBREV }
