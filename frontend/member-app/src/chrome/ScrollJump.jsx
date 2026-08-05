import { useEffect, useState } from 'react'
import './ScrollJump.css'

const EDGE_PX = 48

function readScrollMetrics() {
  const root = document.documentElement
  const scrollingEl = document.scrollingElement || root
  const scrollTop = window.scrollY || scrollingEl.scrollTop || 0
  const viewport = window.innerHeight || root.clientHeight || 0
  const scrollHeight = Math.max(
    scrollingEl.scrollHeight || 0,
    root.scrollHeight || 0,
    document.body?.scrollHeight || 0,
  )
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
      className="gt-icon"
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
      className="gt-icon"
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
 * Fixed jump-to-top / jump-to-bottom controls for long window-scrolled surfaces
 * (library grid virtualizer, favorites, etc.). Hidden when the page is not scrollable.
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
    window.scrollTo({ top: 0, left: 0, behavior })
  }

  const jumpBottom = () => {
    const next = readScrollMetrics()
    window.scrollTo({ top: next.maxScroll, left: 0, behavior })
  }

  return (
    <nav className="gt-scroll-jump" aria-label={t(label)}>
      <button
        type="button"
        className="gt-scroll-jump__btn"
        aria-label={t('Jump to top')}
        title={t('Jump to top')}
        disabled={metrics.atTop}
        onClick={jumpTop}
      >
        <IconChevronUp />
      </button>
      <button
        type="button"
        className="gt-scroll-jump__btn"
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
