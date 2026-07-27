/**
 * Tile size as a continuous 0–100% scale.
 * Legacy letter prefs map: S=25, M=50, L=75, XL=100.
 */

const LEGACY_MAP = { S: 25, M: 50, L: 75, XL: 100 }

export const TILE_PERCENT_MIN = 0
export const TILE_PERCENT_MAX = 100
export const TILE_PERCENT_DEFAULT = 50

/** CSS pixel range for --gt-tile-min */
const MIN_PX = 120
const MAX_PX = 300

export function normalizeTilePercent(value) {
  if (value == null || value === '') return TILE_PERCENT_DEFAULT
  if (typeof value === 'string' && LEGACY_MAP[value.toUpperCase()] != null) {
    return LEGACY_MAP[value.toUpperCase()]
  }
  const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  if (!Number.isFinite(n)) return TILE_PERCENT_DEFAULT
  return Math.min(TILE_PERCENT_MAX, Math.max(TILE_PERCENT_MIN, Math.round(n)))
}

export function tilePercentToCssVars(percent) {
  const p = normalizeTilePercent(percent) / 100
  const minPx = Math.round(MIN_PX + (MAX_PX - MIN_PX) * p)
  const gapPx = Math.round(6 + 10 * p)
  return {
    '--gt-tile-min': `${minPx}px`,
    '--gt-tile-gap': `${gapPx}px`,
  }
}

/** @deprecated Prefer tilePercentToCssVars — kept for older call sites during migrate. */
export function tileSizeToCssVars(size) {
  return tilePercentToCssVars(size)
}

/** Cap oversized tiles on narrow viewports without changing the saved preference. */
export function clampTileVarsForNarrowViewport(vars, isNarrow) {
  if (!isNarrow || !vars) {
    return vars
  }
  const minPx = parseInt(String(vars['--gt-tile-min']), 10)
  if (!Number.isFinite(minPx) || minPx <= 140) {
    return vars
  }
  return {
    ...vars,
    '--gt-tile-min': '140px',
    '--gt-tile-gap': '6px',
  }
}
