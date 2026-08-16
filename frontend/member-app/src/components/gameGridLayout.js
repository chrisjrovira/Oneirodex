/**
 * Layout helpers for library grid virtualization.
 * Matches CSS `repeat(auto-fill, minmax(var(--gt-tile-min), 1fr))` + gap.
 */

export function readCssPx(el, varName, fallback) {
  if (!el || typeof getComputedStyle !== 'function') {
    return fallback
  }
  const raw = getComputedStyle(el).getPropertyValue(varName).trim()
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? n : fallback
}

/** Column count for CSS auto-fill with minmax(tileMin, 1fr) and gap. */
export function computeGridColumns(width, tileMin = 180, gap = 10) {
  if (!(width > 0)) {
    return 1
  }
  const min = Math.max(1, tileMin)
  const g = Math.max(0, gap)
  return Math.max(1, Math.floor((width + g) / (min + g)))
}

/** Cover is 3:4; row height ≈ tile width * 4/3 (no title strip under cover). */
/**
 * Height of one virtual row, gap included.
 *
 * The gap matters here in a way it does not in the plain grid. That grid is a
 * real CSS grid, so `gap` spaces its rows for free. Virtual rows are absolutely
 * positioned at offsets the virtualiser computes, so the only vertical space
 * between them is whatever this function reports — omitting the gap made the
 * virtualised library butt its rows together while the non-virtual one spaced
 * them, and left `getTotalSize()` short by one gap per row, which is what
 * pushed the pagination bar away from the bottom of the tiles.
 *
 * `.game-library-row` carries the same gap as bottom padding so the measured
 * height agrees with this estimate; otherwise `measureElement` would overwrite
 * it on first paint and the spacing would collapse again.
 */
export function estimateGridRowHeight(width, columnCount, gap = 10) {
  const cols = Math.max(1, columnCount)
  const g = Math.max(0, gap)
  const tileWidth = Math.max(1, (Math.max(width, 1) - g * (cols - 1)) / cols)
  return Math.ceil(tileWidth * (4 / 3)) + g
}

export function chunkGamesIntoRows(games, columnCount) {
  const cols = Math.max(1, columnCount)
  const rows = []
  for (let i = 0; i < games.length; i += cols) {
    rows.push(games.slice(i, i + cols))
  }
  return rows
}
