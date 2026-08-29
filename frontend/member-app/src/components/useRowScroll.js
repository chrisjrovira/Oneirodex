import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Horizontal scrolling for a shelf, by every means a pointer expects.
 *
 * A row that only scrolls by dragging its scrollbar is a row most people never
 * scroll: the bar is thin, it is at the bottom of a 280px tile, and on a
 * trackpad it is not there at all until you touch it. Discover shipped with
 * exactly that, so the shelves read as "the first six games" rather than as
 * lists. Three affordances, because different people reach for different ones:
 *
 *   arrows      an explicit control, and the only one that is keyboard- and
 *               screen-reader-reachable
 *   arrow hover park on the left/right control and the row eases along — the
 *               mid-row auto-scroll from an edge zone was fighting tile hover
 *   wheel       a vertical wheel over a horizontal list means "move the list";
 *               this is the one people try first and the one that used to
 *               scroll the whole page instead
 *
 * Shared rather than written into DiscoverShelf, because "this should be for
 * all rows" is the actual requirement and a second copy is how the two drift.
 *
 * @param {object} [options]
 * @param {number} [options.step] Fraction of the visible width one arrow press
 *   moves. Just under a full page, so a tile stays on screen as an anchor.
 * @param {number} [options.edgeSpeed] Pixels per animation frame while hovering
 *   an arrow. ~240px/s at 60fps — slow enough to read, fast enough to traverse.
 */
export function useRowScroll({ step = 0.85, edgeSpeed = 4 } = {}) {
  const ref = useRef(null)
  /** Optional outer hover zone (viewport). Wheel binds here so the gesture
   *  works over arrows, padding, and the scrollbar lane — not only the tiles. */
  const viewportRef = useRef(null)
  const frameRef = useRef(0)
  const directionRef = useRef(0)
  const [overflow, setOverflow] = useState({ start: false, end: false })

  /** Whether there is anything left to scroll to, in each direction. */
  const measure = useCallback(() => {
    const node = ref.current
    if (!node) return
    // 1px of slack: fractional layout widths mean scrollLeft never quite
    // reaches the arithmetic maximum, which would leave the end arrow enabled
    // forever on a fully-scrolled row.
    const max = node.scrollWidth - node.clientWidth
    setOverflow({ start: node.scrollLeft > 1, end: node.scrollLeft < max - 1 })
  }, [])

  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    measure()

    // Tiles arrive after the row does — the shelf fills itself in as it is
    // scrolled — so the arrows have to re-evaluate when the content grows, not
    // only when the window resizes.
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(node)
    for (const child of node.children) observer?.observe(child)

    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [measure])

  const stopEdgeScroll = useCallback(() => {
    directionRef.current = 0
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = 0
    }
  }, [])

  // Stop the moment the component goes away, or the loop outlives the row.
  useEffect(() => stopEdgeScroll, [stopEdgeScroll])

  const startEdgeScroll = useCallback(
    (direction) => {
      if (directionRef.current === direction) return
      directionRef.current = direction
      if (frameRef.current) return

      const tick = () => {
        const node = ref.current
        if (!node || !directionRef.current) {
          frameRef.current = 0
          return
        }
        node.scrollLeft += directionRef.current * edgeSpeed
        measure()
        frameRef.current = requestAnimationFrame(tick)
      }
      frameRef.current = requestAnimationFrame(tick)
    },
    [edgeSpeed, measure],
  )

  /** Arrow press: one near-page, animated unless the member asked for less. */
  const scrollByPage = useCallback(
    (direction) => {
      const node = ref.current
      if (!node) return
      const reduced =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      node.scrollBy({
        left: direction * node.clientWidth * step,
        behavior: reduced ? 'auto' : 'smooth',
      })
    },
    [step],
  )

  /**
   * Vertical wheel over the row moves the row left/right.
   *
   * Only when the row can actually move that way — otherwise a row scrolled to
   * its end would swallow the gesture and the page would stop scrolling, which
   * is a far worse bug than the one this fixes. A horizontal-dominant delta
   * (trackpad swipe, tilt wheel) is left to the browser, which already handles
   * it correctly.
   */
  const onWheel = useCallback(
    (event) => {
      const node = ref.current
      if (!node) return
      // Shift+wheel is already horizontal in most browsers; don't double-apply.
      if (event.shiftKey) return
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return

      let delta = event.deltaY
      // DOM_DELTA_LINE (1): normalize so a notch moves more than a fraction of
      // a pixel; DOM_DELTA_PAGE (2) is rare for mice but treat as a page step.
      if (event.deltaMode === 1) delta *= 16
      else if (event.deltaMode === 2) delta *= node.clientWidth * step

      const max = node.scrollWidth - node.clientWidth
      if (max <= 1) return
      const atStart = node.scrollLeft <= 1
      const atEnd = node.scrollLeft >= max - 1
      if ((delta < 0 && atStart) || (delta > 0 && atEnd)) {
        return
      }

      event.preventDefault()
      node.scrollLeft = Math.max(0, Math.min(max, node.scrollLeft + delta))
      measure()
    },
    [measure, step],
  )

  // React attaches wheel handlers passively, so `preventDefault()` inside an
  // onWheel prop is ignored and the page scrolls anyway. Bind on the viewport
  // (capture) when present so hovering the scrollbar lane / arrows still maps
  // vertical wheel → horizontal scroll.
  useEffect(() => {
    const listenNode = viewportRef.current || ref.current
    if (!listenNode) return undefined
    listenNode.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => listenNode.removeEventListener('wheel', onWheel, { capture: true })
  }, [onWheel])

  return {
    ref,
    viewportRef,
    overflow,
    measure,
    scrollByPage,
    /** Hover the left/right arrow controls — continuous scroll while held. */
    startEdgeScroll,
    stopEdgeScroll,
  }
}
