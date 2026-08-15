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

/** Round to 2 decimal places without leaving trailing-zero float noise. */
function roundFine(value) {
  return Math.round(value * 100) / 100
}

/**
 * Continuous 0–100 percent, fractions preserved.
 * Only whole-number rounding happens where it's actually needed (persisted
 * preference / display label) so a `step="any"` slider can feel smooth
 * instead of visibly snapping between integer percents while dragging.
 */
export function normalizeTilePercent(value) {
  if (value == null || value === '') return TILE_PERCENT_DEFAULT
  if (typeof value === 'string' && LEGACY_MAP[value.toUpperCase()] != null) {
    return LEGACY_MAP[value.toUpperCase()]
  }
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value))
  if (!Number.isFinite(n)) return TILE_PERCENT_DEFAULT
  return roundFine(Math.min(TILE_PERCENT_MAX, Math.max(TILE_PERCENT_MIN, n)))
}

/** Hover lift at the smallest and largest tile sizes. */
const HOVER_SCALE_MIN_TILE = 1.6
const HOVER_SCALE_MAX_TILE = 1.06

export function tilePercentToCssVars(percent) {
  const p = normalizeTilePercent(percent) / 100
  const minPx = roundFine(MIN_PX + (MAX_PX - MIN_PX) * p)
  const gapPx = roundFine(6 + 10 * p)
  // Hover scale runs *against* tile size (W27): small tiles get a big lift
  // because there is room for it and the art is too small to read otherwise;
  // large tiles get a nudge, because doubling a 300px tile would cover its
  // neighbours and half the row.
  const hoverScale = roundFine(
    HOVER_SCALE_MIN_TILE - (HOVER_SCALE_MIN_TILE - HOVER_SCALE_MAX_TILE) * p,
  )
  return {
    '--gt-tile-min': `${minPx}px`,
    '--gt-tile-gap': `${gapPx}px`,
    '--gt-tile-hover-scale': String(hoverScale),
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

  // The hover lift is clamped on every narrow viewport, not only when the tile
  // size also needs capping. A 1.6x lift needs room either side of the tile and
  // a narrow viewport fits two or three per row, so the enlarged tile runs off
  // the edge — and that is *most* true at small tile sizes, which is exactly
  // the case the size clamp below skips.
  const narrowed = { ...vars, '--gt-tile-hover-scale': '1.06' }

  const minPx = parseInt(String(vars['--gt-tile-min']), 10)
  if (!Number.isFinite(minPx) || minPx <= 140) {
    return narrowed
  }
  return {
    ...narrowed,
    '--gt-tile-min': '140px',
    '--gt-tile-gap': '6px',
  }
}
