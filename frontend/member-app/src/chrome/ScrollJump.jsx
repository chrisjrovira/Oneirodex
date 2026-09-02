import { useEffect, useState } from 'react'
import './ScrollJump.css'

const EDGE_PX = 48

/**
 * The element that actually scrolls (GT-B3).
 *
 * The shell is viewport-locked and `.od-shell__main` is the only scroll
 * container, so the window never scrolls. This component read window.scrollY,
 * which meant it silently decided the page was not scrollable and rendered
 * nothing at all — a control that looked removed rather than broken.
 *
 * Falls back to the document for surfaces outside the shell (Big Picture, the
 * standalone companion window), which still scroll natively.
 */
export function getScrollHost() {
  if (typeof document === 'undefined') return null
  return (
    document.querySelector('.od-shell__main') ||
    document.querySelector('.od-admin-main') ||
    document.scrollingElement ||
    document.documentElement
  )
}

function readScrollMetrics() {
  const host = getScrollHost()
  if (!host) return { scrollable: false, atTop: true, atBottom: true, maxScroll: 0 }

  const usesWindow = host === document.scrollingElement || host === document.documentElement
  const scrollTop = usesWindow ? window.scrollY || host.scrollTop || 0 : host.scrollTop
  const viewport = usesWindow ? window.innerHeight || host.clientHeight : host.clientHeight
  const scrollHeight = host.scrollHeight || 0
  const maxScroll = Math.max(0, scrollHeight - viewport)
  return {
    scrollable: maxScroll > EDGE_PX,
    atTop: scrollTop <= EDGE_PX,
    atBottom: maxScroll <= EDGE_PX || scrollTop >= maxScroll - EDGE_PX,
    maxScroll,
  }
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function IconChevronUp(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="od-icon"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M6 15l6-6 6 6" />
    </svg>
  )
}

function IconChevronDown(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="od-icon"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

/**
 * Jump-to-top / jump-to-bottom for the scrolling content pane. Hidden entirely
 * when there is nothing to scroll, so it never sits over content for no reason.
 */
export function ScrollJump({
  t = (key) => key,
  label = 'Page scroll',
} = {}) {
  const [metrics, setMetrics] = useState(() => ({
    scrollable: false,
    atTop: true,
    atBottom: true,
    maxScroll: 0,
  }))

  useEffect(() => {
    let raf = 0

    const commit = () => {
      raf = 0
      setMetrics(readScrollMetrics())
    }

    const schedule = () => {
      if (raf) return
      raf = requestAnimationFrame(commit)
    }

    commit()
    // Listen on the host, not the window: a scroll inside .od-shell__main never
    // reaches window, so the buttons would not update as you moved.
    const host = getScrollHost()
    host?.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)

    const root = document.documentElement
    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(schedule)
        : null
    resizeObserver?.observe(root)
    if (document.body) {
      resizeObserver?.observe(document.body)
    }

    const mutationObserver =
      typeof MutationObserver !== 'undefined'
        ? new MutationObserver(schedule)
        : null
    mutationObserver?.observe(document.body || root, {
      childList: true,
      subtree: true,
    })

    return () => {
      if (raf) cancelAnimationFrame(raf)
      host?.removeEventListener('scroll', schedule)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
    }
  }, [])

  if (!metrics.scrollable) {
    return null
  }

  const behavior = prefersReducedMotion() ? 'auto' : 'smooth'

  const jumpTop = () => {
    getScrollHost()?.scrollTo({ top: 0, left: 0, behavior })
  }

  const jumpBottom = () => {
    const next = readScrollMetrics()
    getScrollHost()?.scrollTo({ top: next.maxScroll, left: 0, behavior })
  }

  return (
    <nav className="od-scroll-jump" aria-label={t(label)}>
      <button
        type="button"
        className="od-scroll-jump__btn"
        aria-label={t('Jump to top')}
        title={t('Jump to top')}
        disabled={metrics.atTop}
        onClick={jumpTop}
      >
        <IconChevronUp />
      </button>
      <button
        type="button"
        className="od-scroll-jump__btn"
        aria-label={t('Jump to bottom')}
        title={t('Jump to bottom')}
        disabled={metrics.atBottom}
        onClick={jumpBottom}
      >
        <IconChevronDown />
      </button>
    </nav>
  )
}

export { readScrollMetrics, EDGE_PX }
