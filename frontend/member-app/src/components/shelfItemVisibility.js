/**
 * Whether a shelf tile is in full view of its horizontal track.
 *
 * IntersectionObserver's ratio rarely lands on exactly 1.0 with fractional
 * layout widths, so "fully visible" is a high bar rather than a perfect one.
 * Edge tiles that fail this must not enlarge on hover — the grown cover would
 * be clipped by the scrollport and read as broken.
 */
export const SHELF_FULLY_VISIBLE_RATIO = 0.99

export function isShelfItemFullyVisible(intersectionRatio) {
  return Number(intersectionRatio) >= SHELF_FULLY_VISIBLE_RATIO
}
