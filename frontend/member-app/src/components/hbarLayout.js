/** Smallest thumb that stays grabable on a thin rail. */
export const HBAR_MIN_THUMB_PX = 32

/**
 * Pixel layout for a custom horizontal scrollbar.
 *
 * Percent width + CSS min-width used to disagree, so the thumb jumped as
 * tiles arrived and a drag could only walk forward. This keeps the thumb
 * sized to the tiles currently in the track and maps pointer X through the
 * live scrollWidth, not a stale React snapshot.
 */
export function hbarLayout({
  scrollLeft = 0,
  scrollWidth = 0,
  clientWidth = 0,
  railWidth = 0,
  minThumbPx = HBAR_MIN_THUMB_PX,
} = {}) {
  const max = Math.max(0, scrollWidth - clientWidth)
  if (railWidth <= 0) {
    return { max, thumbPx: 0, leftPx: 0, usable: 0 }
  }
  const thumbPx =
    max <= 1
      ? railWidth
      : Math.min(
          railWidth,
          Math.max(minThumbPx, (clientWidth / Math.max(scrollWidth, 1)) * railWidth),
        )
  const usable = Math.max(0, railWidth - thumbPx)
  const clampedLeft = Math.min(max, Math.max(0, scrollLeft))
  const leftPx = max > 0 && usable > 0 ? (clampedLeft / max) * usable : 0
  return { max, thumbPx, leftPx, usable }
}

/**
 * Inverse of `leftPx`: pointer X on the rail → track scrollLeft.
 *
 * Drag used to size the thumb in percent with a CSS min-width, so the
 * mapping only walked forward. This stays in pixels and is symmetric.
 */
export function scrollLeftFromPointer({
  clientX = 0,
  railLeft = 0,
  grab = 0,
  usable = 0,
  max = 0,
} = {}) {
  if (max <= 1 || usable <= 0) return 0
  const x = clientX - railLeft - grab
  const t = Math.min(1, Math.max(0, x / usable))
  return t * max
}
