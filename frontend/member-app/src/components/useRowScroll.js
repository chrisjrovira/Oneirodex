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
 *   edge hover  park the pointer at either end and the row moves — the pattern
 *               every TV and store front-end uses, and the fastest one once you
 *               know it is there
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
 * @param {number} [options.edgeWidth] Width in px of the hover zone at each end.
 * @param {number} [options.edgeSpeed] Pixels per animation frame while hovering
 *   an edge. Roughly 360px/s at 60fps.
 */
export function useRowScroll({ step = 0.85, edgeWidth = 64, edgeSpeed = 6 } = {}) {
  const ref = useRef(null)
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
   * Vertical wheel over the row moves the row.
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
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return

      const max = node.scrollWidth - node.clientWidth
      if (max <= 0) return
      const next = node.scrollLeft + event.deltaY
      if ((event.deltaY < 0 && node.scrollLeft <= 0) || (event.deltaY > 0 && node.scrollLeft >= max)) {
        return
      }

      event.preventDefault()
      node.scrollLeft = Math.max(0, Math.min(max, next))
      measure()
    },
    [measure],
  )

  // React attaches wheel handlers passively, so `preventDefault()` inside an
  // onWheel prop is ignored and the page scrolls anyway. The listener has to be
  // registered by hand with `passive: false`.
  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [onWheel])

  /** Pointer moved over the row: are we in an edge zone, and which one? */
  const onPointerMove = useCallback(
    (event) => {
      const node = ref.current
      if (!node) return
      // Touch drives the row directly; an auto-scrolling edge under a finger
      // fights the drag it is already doing.
      if (event.pointerType && event.pointerType !== 'mouse') return

      const box = node.getBoundingClientRect()
      const fromStart = event.clientX - box.left
      const fromEnd = box.right - event.clientX

      if (fromStart <= edgeWidth) startEdgeScroll(-1)
      else if (fromEnd <= edgeWidth) startEdgeScroll(1)
      else stopEdgeScroll()
    },
    [edgeWidth, startEdgeScroll, stopEdgeScroll],
  )

  return {
    ref,
    overflow,
    measure,
    scrollByPage,
    onPointerMove,
    onPointerLeave: stopEdgeScroll,
  }
}
