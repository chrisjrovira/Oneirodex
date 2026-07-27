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
export function estimateGridRowHeight(width, columnCount, gap = 10) {
  const cols = Math.max(1, columnCount)
  const g = Math.max(0, gap)
  const tileWidth = Math.max(1, (Math.max(width, 1) - g * (cols - 1)) / cols)
  return Math.ceil(tileWidth * (4 / 3))
}

export function chunkGamesIntoRows(games, columnCount) {
  const cols = Math.max(1, columnCount)
  const rows = []
  for (let i = 0; i < games.length; i += cols) {
    rows.push(games.slice(i, i + cols))
  }
  return rows
}
