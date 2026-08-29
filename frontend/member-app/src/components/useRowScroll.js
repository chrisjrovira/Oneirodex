import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * Horizontal scrolling for a shelf.
 *
 * Discover rows scroll by the bottom slider and the hover arrows — not by the
 * mouse wheel or trackpad. Any wheel gesture over the row is cancelled; a
 * vertical-dominant delta is handed to the nearest page scroller so Discover
 * keeps moving. Horizontal-dominant deltas are discarded (slider / arrows only).
 *
 * @param {object} [options]
 * @param {number} [options.step] Fraction of the visible width one arrow press
 *   moves. Just under a full page, so a tile stays on screen as an anchor.
 * @param {number} [options.edgeSpeed] Pixels per animation frame while hovering
 *   an arrow. ~240px/s at 60fps — slow enough to read, fast enough to traverse.
 * @param {unknown} [options.bindKey] Change this when the track node mounts or
 *   is replaced so the non-passive wheel listener rebinds (refs alone do not
 *   re-run an effect).
 */
export function useRowScroll({ step = 0.85, edgeSpeed = 4, bindKey = 0 } = {}) {
  const ref = useRef(null)
  /** Outer hover zone (viewport / scroller). Wheel binds here so the lane under
   *  the custom scrollbar and the arrow fades do not become accidental row scroll. */
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
  }, [measure, bindKey])

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
        const max = node.scrollWidth - node.clientWidth
        node.scrollLeft = Math.max(
          0,
          Math.min(max, node.scrollLeft + directionRef.current * edgeSpeed),
        )
        measure()
        if (node.scrollLeft <= 0 || node.scrollLeft >= max - 1) {
          directionRef.current = 0
          frameRef.current = 0
          return
        }
        frameRef.current = requestAnimationFrame(tick)
      }
      frameRef.current = requestAnimationFrame(tick)
    },
    [edgeSpeed, measure],
  )

  /** Arrow press: one near-page, animated unless the member asked for less. */
  const scrollByPage = useCallback(
    (direction) => {
      stopEdgeScroll()
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
    [step, stopEdgeScroll],
  )

  /**
   * No wheel / trackpad pans the row. Vertical-dominant deltas scroll the page;
   * sideways gestures are discarded (slider + arrows own horizontal motion).
   */
  const onWheel = useCallback((event) => {
    const node = ref.current
    if (!node) return
    if (node.scrollWidth <= node.clientWidth + 1) return

    event.preventDefault()
    event.stopPropagation()

    const vertical = !event.shiftKey && Math.abs(event.deltaY) >= Math.abs(event.deltaX)
    if (!vertical) return

    let delta = event.deltaY
    if (event.deltaMode === 1) delta *= 16
    else if (event.deltaMode === 2) {
      delta *=
        typeof window !== 'undefined' ? window.innerHeight * 0.85 : node.clientWidth * step
    }

    let target = node.parentElement
    while (target && target !== document.documentElement) {
      const style = window.getComputedStyle(target)
      const oy = style.overflowY
      if (
        (oy === 'auto' || oy === 'scroll' || oy === 'overlay') &&
        target.scrollHeight > target.clientHeight + 1
      ) {
        target.scrollTop += delta
        return
      }
      target = target.parentElement
    }
    window.scrollBy(0, delta)
  }, [step])

  // React attaches wheel handlers passively, so `preventDefault()` inside an
  // onWheel prop is ignored. Bind on the viewport and the track (capture).
  // bindKey re-runs when the shelf mounts its track after a null first paint.
  useLayoutEffect(() => {
    const nodes = [...new Set([viewportRef.current, ref.current].filter(Boolean))]
    if (!nodes.length) return undefined
    for (const listenNode of nodes) {
      listenNode.addEventListener('wheel', onWheel, { passive: false, capture: true })
    }
    return () => {
      for (const listenNode of nodes) {
        listenNode.removeEventListener('wheel', onWheel, { capture: true })
      }
    }
  }, [onWheel, bindKey])

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
