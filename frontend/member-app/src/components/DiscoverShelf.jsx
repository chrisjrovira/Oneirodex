import { useCallback, useEffect, useRef, useState } from 'react'
import { GameCard } from './GameCard'
import './DiscoverShelf.css'

/**
 * One Discover row, as a shelf rather than a grid (W28).
 *
 * Discover rendered every section through `GameGrid` — the *library* grid, which
 * wraps and virtualises vertically. Eight games therefore reflowed into two or
 * three stacked rows under one heading, the tile-size slider changed how many
 * lines a "row" took rather than how big the tiles were, and the hover zoom was
 * clipped by the row beneath it. A storefront row is one line you scroll
 * sideways; that is what this is.
 *
 * Three things that look cosmetic are load-bearing here:
 *
 *  - **Bleed.** A scroll container clips on *both* axes whatever you set
 *    `overflow-y` to, so the hovered tile's 1.25 scale and its glow are cut off
 *    at the track's edges unless the track carries padding for them to grow
 *    into. The padding is inside the scroller, so it is scrollable area rather
 *    than a gap the layout has to find. See DiscoverShelf.css.
 *  - **Edge buttons.** Overlaid on the end tiles, not placed beside the row:
 *    beside costs width on every shelf permanently and puts the control where
 *    the eye is not.
 *  - **Hover steering.** Holding the pointer near either end scrolls the shelf,
 *    speed ramping with how close you are. Wired to `pointermove` so it stops
 *    dead when the pointer leaves, and skipped entirely for coarse pointers and
 *    for reduced motion.
 */

/** How close to an end the pointer must be for hover steering to engage. */
const HOT_ZONE_PX = 110

/** Pixels per frame at the very edge of the hot zone's inner boundary. */
const MAX_STEER_SPEED = 13

function IconChevronLeft() {
  return (
    <svg className="gt-icon" viewBox="0 0 24 24" width="20" height="20" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false">
      <path d="m15 5-7 7 7 7" />
    </svg>
  )
}

function IconChevronRight() {
  return (
    <svg className="gt-icon" viewBox="0 0 24 24" width="20" height="20" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false">
      <path d="m9 5 7 7-7 7" />
    </svg>
  )
}

function IconPin({ filled }) {
  return (
    <svg className="gt-icon" viewBox="0 0 24 24" width="16" height="16"
      fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M9 3h6l-1 6 4 3v2H6v-2l4-3-1-6z" />
      <path d="M12 14v7" />
    </svg>
  )
}

/** True when the environment should not be steered or animated. */
function prefersStillness() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    window.matchMedia('(pointer: coarse)').matches
  )
}

export function DiscoverShelf({
  section,
  isAdmin = false,
  showPlayStatus = false,
  enableDeleteOnDisk = false,
  pinned = false,
  onTogglePin,
}) {
  const trackRef = useRef(null)
  const steerRef = useRef({ raf: 0, speed: 0 })
  const [overflow, setOverflow] = useState({ start: false, end: false })

  const id = String(section.identifier || section.title || 'section')
  const layout = section.layout || 'shelf'
  const games = Array.isArray(section.games) ? section.games : []

  /** Which ends have more shelf behind them — drives the edge buttons. */
  const measure = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    // 1px of slack: fractional scroll widths otherwise leave the end button
    // showing on a shelf that is already fully scrolled.
    const start = el.scrollLeft > 1
    const end = el.scrollLeft < el.scrollWidth - el.clientWidth - 1
    setOverflow((current) =>
      current.start === start && current.end === end ? current : { start, end },
    )
  }, [])

  useEffect(() => {
    const el = trackRef.current
    if (!el) return undefined
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    observer?.observe(el)
    return () => {
      el.removeEventListener('scroll', measure)
      observer?.disconnect()
    }
    // `games.length` so a shelf that arrives after mount re-measures.
  }, [measure, games.length])

  const stopSteering = useCallback(() => {
    steerRef.current.speed = 0
    if (steerRef.current.raf) {
      cancelAnimationFrame(steerRef.current.raf)
      steerRef.current.raf = 0
    }
  }, [])

  // The rAF loop lives outside React state on purpose: it runs every frame
  // while the pointer rests near an edge, and driving it through setState
  // would re-render eight cards sixty times a second.
  const runSteer = useCallback(() => {
    const el = trackRef.current
    const { speed } = steerRef.current
    if (!el || speed === 0) {
      steerRef.current.raf = 0
      return
    }
    el.scrollLeft += speed
    steerRef.current.raf = requestAnimationFrame(runSteer)
  }, [])

  const onPointerMove = useCallback(
    (event) => {
      if (prefersStillness()) return
      const el = trackRef.current
      if (!el) return
      const box = el.getBoundingClientRect()
      const fromStart = event.clientX - box.left
      const fromEnd = box.right - event.clientX

      let speed = 0
      if (fromStart < HOT_ZONE_PX && overflow.start) {
        // Ramp: barely moving at the inner boundary, fastest at the very edge.
        speed = -MAX_STEER_SPEED * (1 - Math.max(0, fromStart) / HOT_ZONE_PX)
      } else if (fromEnd < HOT_ZONE_PX && overflow.end) {
        speed = MAX_STEER_SPEED * (1 - Math.max(0, fromEnd) / HOT_ZONE_PX)
      }

      steerRef.current.speed = speed
      if (speed !== 0 && !steerRef.current.raf) {
        steerRef.current.raf = requestAnimationFrame(runSteer)
      }
      if (speed === 0) stopSteering()
    },
    [overflow.start, overflow.end, runSteer, stopSteering],
  )

  useEffect(() => stopSteering, [stopSteering])

  /** One "page" is most of a screenful, keeping a tile of context. */
  const nudge = useCallback(
    (direction) => {
      const el = trackRef.current
      if (!el) return
      el.scrollBy({
        left: direction * Math.max(160, el.clientWidth * 0.8),
        behavior: prefersStillness() ? 'auto' : 'smooth',
      })
    },
    [],
  )

  if (games.length === 0) return null

  return (
    <section
      data-discover-section={id}
      data-layout={layout}
      data-pinned={pinned ? 'true' : undefined}
      className={`gt-shelf gt-shelf--${layout}`}
      aria-labelledby={`shelf-${id}`}
    >
      <div className="gt-shelf__head">
        <h2 className={`gt-shelf__title discovery-${id.replaceAll('_', '-')}-label`} id={`shelf-${id}`}>
          {section.title}
        </h2>
        {section.is_event ? (
          <span className="gt-shelf__event" title="Limited-time shelf">
            Event{formatEventEnds(section.ends_at)}
          </span>
        ) : null}
        {pinned ? <span className="gt-shelf__pinned-chip">Pinned</span> : null}
        <span className="gt-shelf__count">{games.length}</span>
        {onTogglePin ? (
          <button
            type="button"
            className={`gt-shelf__pin${pinned ? ' is-on' : ''}`}
            aria-pressed={pinned}
            // Named with the shelf, because the visible label is one word and
            // the page renders eight of these — "Pin" on its own tells a
            // screen reader nothing about which row it would move.
            aria-label={
              pinned
                ? `Unpin ${section.title}`
                : `Pin ${section.title} to the top of Discover`
            }
            title={pinned ? 'Unpin this shelf' : 'Pin this shelf to the top of Discover'}
            onClick={() => onTogglePin(id)}
          >
            <IconPin filled={pinned} />
            <span className="gt-shelf__pin-label">{pinned ? 'Unpin' : 'Pin'}</span>
          </button>
        ) : null}
      </div>

      <div className="gt-shelf__frame">
        <button
          type="button"
          className="gt-shelf__edge gt-shelf__edge--start"
          aria-label={`Scroll ${section.title} left`}
          hidden={!overflow.start}
          onClick={() => nudge(-1)}
        >
          <IconChevronLeft />
        </button>

        <div
          className="gt-shelf__track"
          ref={trackRef}
          onPointerMove={onPointerMove}
          onPointerLeave={stopSteering}
          // A shelf is a horizontal list of destinations; the wrapper is the
          // scroll region, so it needs to be reachable and named for keyboards
          // that scroll it with the arrow keys.
          tabIndex={0}
          role="group"
          aria-label={`${section.title} shelf`}
        >
          {games.map((game) => (
            <div className="gt-shelf__cell" key={game.uuid}>
              <GameCard
                game={game}
                showPlayStatus={showPlayStatus}
                isAdmin={isAdmin}
                enableDeleteOnDisk={enableDeleteOnDisk}
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          className="gt-shelf__edge gt-shelf__edge--end"
          aria-label={`Scroll ${section.title} right`}
          hidden={!overflow.end}
          onClick={() => nudge(1)}
        >
          <IconChevronRight />
        </button>
      </div>
    </section>
  )
}

/** " · ends in 3 days" — omitted entirely when there is no honest end date. */
export function formatEventEnds(endsAt) {
  if (!endsAt) return ''
  const end = new Date(endsAt)
  if (Number.isNaN(end.getTime())) return ''
  const msLeft = end.getTime() - Date.now()
  if (msLeft <= 0) return ''
  const days = Math.floor(msLeft / 86_400_000)
  if (days >= 2) return ` · ends in ${days} days`
  const hours = Math.max(1, Math.floor(msLeft / 3_600_000))
  return ` · ends in ${hours} hour${hours === 1 ? '' : 's'}`
}

export default DiscoverShelf
