import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchDiscoverRow } from '../api/discover'
import { GameCard } from './GameCard'
import { NewsCard } from './NewsCard'
import { useRowScroll } from './useRowScroll'
import './DiscoverShelf.css'

/**
 * Items a row is carrying, whichever kind it is.
 *
 * Game rows keep the `games` key they have always had; rows of anything else
 * carry `items`. The server sends one or the other rather than both, because
 * mirroring the list would serialize every tile twice.
 */
export function rowItems(section) {
  if (Array.isArray(section?.games)) return section.games
  if (Array.isArray(section?.items)) return section.items
  return []
}

/** Stable key for a tile of any kind. Games have uuids, articles have ids. */
function itemKey(item, index) {
  return item?.uuid || item?.id || String(index)
}

/**
 * How close to the end of the shelf the member has to scroll before the next
 * window is requested. Roughly two tiles of runway — enough that the tiles are
 * there by the time they arrive, without prefetching a row nobody scrolled.
 */
const LOAD_AHEAD_PX = 600

/** Tiles per request once the shelf starts filling itself in. */
const PAGE_SIZE = 12

/**
 * One Discover row: a horizontal shelf that fills itself in as it is scrolled.
 *
 * The feed ships the head of each row and the row asks for the rest, so opening
 * Discover costs one window per shelf rather than every tile of every shelf. A
 * row that holds more than it will ever show ends in a link to its own page —
 * and only then, because a "see all" that leads to the same tiles is a lie.
 */
export function DiscoverShelf({
  section,
  isAdmin = false,
  showPlayStatus = false,
  enableDeleteOnDisk = false,
  pinned = false,
  canPin = true,
  onTogglePin,
  onHide,
}) {
  const identifier = String(section.identifier || '')
  const itemKind = section.item_kind || 'games'
  const totalCount = Number(section.total_count) || 0
  const [games, setGames] = useState(() => rowItems(section))
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const abortRef = useRef(null)
  // Arrows, edge-hover and wheel, shared with every other horizontal row.
  const {
    ref: trackRef,
    overflow,
    measure,
    scrollByPage,
    onPointerMove,
    onPointerLeave,
  } = useRowScroll()

  // A fresh feed replaces the row wholesale rather than appending to whatever
  // the previous one had scrolled to.
  useEffect(() => {
    setGames(rowItems(section))
    setLoadError(false)
  }, [section])

  useEffect(() => () => abortRef.current?.abort(), [])

  const complete = games.length >= totalCount

  const loadMore = useCallback(() => {
    if (loading || loadError || complete || !identifier) {
      return
    }
    setLoading(true)
    const controller = new AbortController()
    abortRef.current = controller
    fetchDiscoverRow(identifier, {
      offset: games.length,
      limit: PAGE_SIZE,
      feedToken: section.feed_token,
      signal: controller.signal,
    })
      .then((page) => {
        setGames((current) => {
          // Concurrent loads and a re-render can both land here; keying by
          // identity means an overlapping window adds nothing rather than
          // duplicating a tile halfway down the shelf.
          const seen = new Set(current.map((item) => itemKey(item)))
          return current.concat(
            page.items.filter((item) => !seen.has(itemKey(item))),
          )
        })
        setLoading(false)
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        // A shelf that cannot fill itself keeps what it has and stops asking.
        // The tiles already there still work.
        setLoadError(true)
        setLoading(false)
      })
  }, [complete, games.length, identifier, loadError, loading, section.feed_token])

  const handleScroll = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    measure()
    const remaining = track.scrollWidth - track.scrollLeft - track.clientWidth
    if (remaining <= LOAD_AHEAD_PX) {
      loadMore()
    }
  }, [loadMore, measure, trackRef])

  if (!games.length) {
    return null
  }

  const layout = section.layout || 'shelf'
  const showSeeAll = Boolean(section.has_more && section.more_href)

  return (
    <section
      data-discover-section={identifier}
      data-layout={layout}
      className={`gt-shelf gt-shelf--${layout}`}
    >
      <div className="gt-shelf__head">
        {/* The rule is drawn by the heading itself (see .gt-shelf__title in the
            stylesheet) rather than by a border under the whole head row, so it
            stops at the words instead of running the width of the page. */}
        <h2 className="gt-shelf__title">
          <span className="gt-shelf__title-text">{section.title}</span>
        </h2>
        {section.reason ? (
          <span className="gt-shelf__reason">{section.reason}</span>
        ) : null}
        {section.is_event ? (
          <span className="gt-shelf__event" title="Limited-time shelf">
            Event{formatEventEnds(section.ends_at)}
          </span>
        ) : null}
        {onTogglePin ? (
          <button
            type="button"
            className="gt-shelf__pin"
            aria-pressed={pinned}
            // A member gets a fixed number of pins, so the control that would
            // exceed it is disabled rather than silently doing nothing.
            disabled={!pinned && !canPin}
            title={
              pinned
                ? 'Unpin this row'
                : canPin
                  ? 'Pin this row to the top'
                  : 'You have pinned as many rows as you can'
            }
            onClick={() => onTogglePin(identifier)}
          >
            {pinned ? 'Pinned' : 'Pin'}
          </button>
        ) : null}
        {onHide ? (
          <button
            type="button"
            className="gt-shelf__hide"
            /* Hiding is reversible and the way back has to be visible from
               here, or a row put away is a row gone for good — the control
               says where it went. */
            title="Hide this row (restore it from Discover’s row settings)"
            onClick={() => onHide(identifier)}
          >
            Hide
          </button>
        ) : null}
        {showSeeAll ? (
          <Link className="gt-shelf__seeall" to={section.more_href}>
            See all
          </Link>
        ) : null}
      </div>

      <div
        className="gt-shelf__viewport"
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        {/* Rendered whether or not they are usable, and disabled when they are
            not: arrows that appear and disappear as a row fills itself in move
            the tiles under the pointer mid-reach. */}
        <button
          type="button"
          className="gt-shelf__arrow gt-shelf__arrow--start"
          aria-label={`Scroll ${section.title} left`}
          disabled={!overflow.start}
          onClick={() => scrollByPage(-1)}
        >
          <span aria-hidden="true">‹</span>
        </button>

        <div
          className="gt-shelf__track"
          ref={trackRef}
          onScroll={handleScroll}
          role="list"
          aria-label={section.title}
        >
          {games.map((item, index) => (
            <div className="gt-shelf__item" role="listitem" key={itemKey(item, index)}>
              {itemKind === 'articles' ? (
                <NewsCard item={item} />
              ) : (
                <GameCard
                  game={item}
                  isAdmin={isAdmin}
                  showPlayStatus={showPlayStatus}
                  enableDeleteOnDisk={enableDeleteOnDisk}
                />
              )}
            </div>
          ))}

          {loading ? (
            <div className="gt-shelf__item gt-shelf__pending" aria-hidden="true" />
          ) : null}

          {showSeeAll && complete ? (
            <Link
              className="gt-shelf__item gt-shelf__more"
              to={section.more_href}
              aria-label={`See all in ${section.title}`}
            >
              <span className="gt-shelf__more-mark" aria-hidden="true">
                +
              </span>
              <span className="gt-shelf__more-label">See all</span>
            </Link>
          ) : null}
        </div>

        <button
          type="button"
          className="gt-shelf__arrow gt-shelf__arrow--end"
          aria-label={`Scroll ${section.title} right`}
          disabled={!overflow.end}
          onClick={() => scrollByPage(1)}
        >
          <span aria-hidden="true">›</span>
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
