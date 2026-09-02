/**
 * Tile size as a continuous 0–100% scale.
 * Legacy letter prefs map: S=25, M=50, L=75, XL=100.
 */

const LEGACY_MAP = { S: 25, M: 50, L: 75, XL: 100 }

export const TILE_PERCENT_MIN = 0
export const TILE_PERCENT_MAX = 100
export const TILE_PERCENT_DEFAULT = 50

/** CSS pixel range for --od-tile-min (slider 0% → 100%). */
export const TILE_PX_MIN = 120
export const TILE_PX_MAX = 400

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

/**
 * Hover lift, flat across the whole tile-size range.
 *
 * It used to interpolate 1.6 at the smallest tile down to 1.06 at the largest,
 * on the theory that small tiles need a big lift to be readable. Two things
 * were wrong with that. The curve never reached the screen — a second
 * `.game-card:hover` rule later in components.css hardcoded `scale(1.08)` and
 * won on source order, so every tile lifted 8% whatever this returned. And a
 * lift that changes with tile size makes the same gesture behave differently
 * depending on a slider the member set once and forgot, which reads as a bug
 * rather than as a feature.
 *
 * One value, everywhere: 25% is large enough to pick a tile out of a dense grid
 * at a glance, and `transform: scale` does not reflow, so the grid keeps its
 * flow however far the tile grows. The narrow-viewport clamp no longer
 * overrides it — a quarter of a 140px tile is ~17px either side, which stays
 * inside its own track.
 */
export const TILE_HOVER_SCALE = 1.25

export function tilePercentToCssVars(percent) {
  const p = normalizeTilePercent(percent) / 100
  const minPx = roundFine(TILE_PX_MIN + (TILE_PX_MAX - TILE_PX_MIN) * p)
  const gapPx = roundFine(6 + 10 * p)
  return {
    '--od-tile-min': `${minPx}px`,
    '--od-tile-gap': `${gapPx}px`,
    '--od-tile-hover-scale': String(TILE_HOVER_SCALE),
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

  // The hover lift is no longer clamped here. It used to be pinned to 1.06 on
  // every narrow viewport because the old curve reached 1.6 at small tile
  // sizes, which genuinely ran off the edge of a two-tile row. A flat 1.25 does
  // not: at 140px that is 35px of growth, ~17px either side, and the tile stays
  // inside its own track. Keeping the clamp would mean the same hover behaved
  // differently on a phone for no reason a member could see.
  const minPx = parseInt(String(vars['--od-tile-min']), 10)
  if (!Number.isFinite(minPx) || minPx <= 140) {
    return vars
  }
  return {
    ...vars,
    '--od-tile-min': '140px',
    '--od-tile-gap': '6px',
  }
}
