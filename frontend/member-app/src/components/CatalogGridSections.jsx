import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { groupCatalogGamesByGenre } from '../utils/catalogGridGroups'
import { fetchShelfGames, fetchShelfGenres } from './catalogGenreShelves'
import { GameCard } from './GameCard'
import { hbarLayout, scrollLeftFromPointer } from './hbarLayout'
import { isShelfItemFullyVisible } from './shelfItemVisibility'
import { useRowScroll } from './useRowScroll'
import './DiscoverShelf.css'
import './CatalogGridSections.css'

/**
 * One genre shelf in Catalog Grid — Discover chrome (title mark, arrows,
 * bottom slider) without pin / hide / see-all. Tile size follows the same
 * `--od-tile-min` slider as Discover and Tile view.
 */
function CatalogGenreShelf({
  title,
  games,
  cardProps,
  selectedIds,
  total = null,
  seeAllHref = null,
  pending = false,
  onNeeded = null,
}) {
  const [hbar, setHbar] = useState({ max: 0, thumbPx: 0, leftPx: 0, scrollLeft: 0 })
  const hbarDragRef = useRef(null)
  const {
    ref: trackRef,
    viewportRef,
    hbarRef,
    overflow,
    measure,
    scrollByPage,
    startEdgeScroll,
    stopEdgeScroll,
  } = useRowScroll({ bindKey: games.length })

  const syncHbar = useCallback(() => {
    const track = trackRef.current
    const rail = hbarRef.current
    if (!track) return
    setHbar({
      ...hbarLayout({
        scrollLeft: track.scrollLeft,
        scrollWidth: track.scrollWidth,
        clientWidth: track.clientWidth,
        railWidth: rail?.clientWidth || 0,
      }),
      scrollLeft: track.scrollLeft,
    })
  }, [hbarRef, trackRef])

  useLayoutEffect(() => {
    const track = trackRef.current
    const rail = hbarRef.current
    syncHbar()
    if (!track || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(syncHbar)
    observer.observe(track)
    if (rail) observer.observe(rail)
    for (const child of track.children) observer.observe(child)
    return () => observer.disconnect()
  }, [games.length, hbarRef, syncHbar, trackRef])

  useEffect(() => {
    const track = trackRef.current
    if (!track || typeof IntersectionObserver === 'undefined') return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          entry.target.toggleAttribute(
            'data-fully-visible',
            isShelfItemFullyVisible(entry.intersectionRatio),
          )
        }
      },
      { root: track, threshold: [0, 0.5, 0.99, 1] },
    )

    const items = track.querySelectorAll('.od-shelf__item')
    items.forEach((node) => {
      node.toggleAttribute('data-fully-visible', true)
      observer.observe(node)
    })
    return () => observer.disconnect()
  }, [games.length, trackRef])

  const handleScroll = useCallback(() => {
    measure()
    syncHbar()
  }, [measure, syncHbar])

  const onHbarPointerDown = useCallback(
    (event) => {
      const track = trackRef.current
      const rail = hbarRef.current
      if (!track || !rail || event.button !== 0) return
      event.preventDefault()
      const layout = hbarLayout({
        scrollLeft: track.scrollLeft,
        scrollWidth: track.scrollWidth,
        clientWidth: track.clientWidth,
        railWidth: rail.clientWidth,
      })
      const grab = event.currentTarget === event.target
        ? 0
        : event.clientX - rail.getBoundingClientRect().left - layout.leftPx

      const scrollFromClientX = (clientX) => {
        const box = rail.getBoundingClientRect()
        track.scrollLeft = scrollLeftFromPointer({
          clientX,
          railLeft: box.left,
          grab,
          usable: layout.usable,
          max: layout.max,
        })
        measure()
        syncHbar()
      }

      scrollFromClientX(event.clientX)
      hbarDragRef.current = { scrollFromClientX }
      const onMove = (ev) => hbarDragRef.current?.scrollFromClientX(ev.clientX)
      const onUp = () => {
        hbarDragRef.current = null
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [measure, syncHbar, trackRef, hbarRef],
  )

  /* Fetch when the shelf is near the viewport, not on mount.
     Forty-one genres would otherwise be forty-one requests fired at once for
     a page where the reader will look at three of them. */
  const rootRef = useRef(null)
  useEffect(() => {
    if (!onNeeded) return undefined
    const node = rootRef.current
    if (!node) return undefined
    if (typeof IntersectionObserver === 'undefined') {
      onNeeded()
      return undefined
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onNeeded()
          observer.disconnect()
        }
      },
      { rootMargin: '600px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [onNeeded])

  return (
    <section className="od-shelf od-shelf--shelf catalog-grid-section" ref={rootRef}>
      <div className="od-shelf__head">
        <div className="od-shelf__heading">
          <h2 className="od-shelf__title">
            <span className="od-shelf__title-text">{title}</span>
          </h2>
          {/* How many are actually in this genre — the thing the old pager
              could never say, because it counted the whole library. */}
          {total != null ? (
            <span className="od-shelf__reason">
              {total === 1 ? '1 title' : `${total} titles`}
            </span>
          ) : null}
        </div>
        {seeAllHref && total != null && total > games.length ? (
          <Link className="od-shelf__seeall" to={seeAllHref}>
            See all
          </Link>
        ) : null}
      </div>

      <div className="od-shelf__scroller" ref={viewportRef}>
        <div className="od-shelf__viewport">
          <button
            type="button"
            className="od-shelf__arrow od-shelf__arrow--start"
            aria-label={`Scroll ${title} left`}
            disabled={!overflow.start}
            onClick={() => scrollByPage(-1)}
            onPointerEnter={() => {
              if (overflow.start) startEdgeScroll(-1)
            }}
            onPointerLeave={stopEdgeScroll}
          >
            <span aria-hidden="true">‹</span>
          </button>

          <div
            className="od-shelf__track"
            ref={trackRef}
            onScroll={handleScroll}
            role="list"
            aria-label={title}
          >
            {games.map((game) => (
              <div className="od-shelf__item" role="listitem" key={game.uuid}>
                <GameCard
                  game={game}
                  selected={Boolean(selectedIds?.has(game.uuid))}
                  {...cardProps}
                />
              </div>
            ))}
            {/* Holds the row's height while its covers are in flight, so the
                page does not jump backwards under the pointer as shelves
                below the fold fill themselves in. */}
            {pending && games.length === 0
              ? Array.from({ length: 6 }, (_, index) => (
                  <div className="od-shelf__item" key={`pending-${index}`} aria-hidden="true">
                    <div className="od-shelf__pending" />
                  </div>
                ))
              : null}
          </div>

          <button
            type="button"
            className="od-shelf__arrow od-shelf__arrow--end"
            aria-label={`Scroll ${title} right`}
            disabled={!overflow.end}
            onClick={() => scrollByPage(1)}
            onPointerEnter={() => {
              if (overflow.end) startEdgeScroll(1)
            }}
            onPointerLeave={stopEdgeScroll}
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>

        <div
          ref={hbarRef}
          className="od-shelf__hbar"
          data-idle={hbar.max <= 1 ? 'true' : undefined}
          role="scrollbar"
          aria-label={`Scroll ${title}`}
          aria-orientation="horizontal"
          aria-disabled={hbar.max <= 1}
          aria-valuemin={0}
          aria-valuemax={Math.round(Math.max(hbar.max, 0))}
          aria-valuenow={Math.round(hbar.scrollLeft || 0)}
          onPointerDown={onHbarPointerDown}
        >
          <div
            className="od-shelf__hbar-thumb"
            style={{
              width: hbar.thumbPx > 0 ? `${hbar.thumbPx}px` : '100%',
              left: `${hbar.leftPx}px`,
            }}
          />
        </div>
      </div>
    </section>
  )
}

/**
 * Catalog Grid view: Steam-like genre shelves (horizontal cover tracks).
 * Tile stays the uniform wrap grid; Rows stays the list.
 *
 * Each shelf is its own genre, fetched for itself.
 *
 * It used to shelve whatever the pager had handed the page — fifty games out
 * of 6,852 — which made every shelf an accident. "Strategy" held the three
 * strategy titles that happened to fall in this slice; turning the page gave
 * you a different Strategy shelf with different games and no way to tell you
 * had already seen some. The pager read "1 of 138", so the view offered a
 * hundred and thirty-eight pages of genre headings that never added up to a
 * genre. Steam-like shelves over an arbitrary slice are not shelves.
 *
 * So Grid stops reading the page. It asks `/api/filters/bundle` which genres
 * the library actually has, gives each one a shelf, and each shelf fetches its
 * own first thirty covers with the catalog bar's filters applied — lazily, as
 * it comes near the viewport. The shelf says how many titles the genre holds,
 * and See all hands the genre to the Tile view, which is the layout that is
 * actually good at "show me all 812 of these". LibraryApp drops the pager in
 * this layout: there is nothing left for it to page.
 *
 * If the genre list cannot be fetched the view falls back to grouping the page
 * it was given, which is the old behaviour — a degraded Grid beats a blank one.
 */
export function CatalogGridSections({
  games,
  filters = null,
  showPlayStatus = true,
  isAdmin = false,
  enableDeleteOnDisk = false,
  onToggleFavorite,
  hidePlatformChip = false,
  selectionEnabled = false,
  selectedIds = null,
  onSelectionToggle,
  activePlatform = null,
  listRef = null,
  selecting = false,
}) {
  const [genres, setGenres] = useState(null)
  const [genresFailed, setGenresFailed] = useState(false)
  const [shelves, setShelves] = useState({})
  const [requested, setRequested] = useState(() => new Set())

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setGenres(null)
    setGenresFailed(false)
    fetchShelfGenres({ signal: controller.signal })
      .then((names) => {
        if (active) setGenres(names)
      })
      .catch((error) => {
        if (active && error?.name !== 'AbortError') setGenresFailed(true)
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [])

  /* A filter change invalidates every shelf: "Action" under `library_platform=
     NES` is a different shelf from "Action" across the whole catalog. Keyed on
     the serialised filters so a re-render with the same filters does not
     re-fetch what is already on screen. */
  const filterKey = useMemo(() => JSON.stringify(filters || {}), [filters])
  useEffect(() => {
    setShelves({})
    setRequested(new Set())
  }, [filterKey])

  const loadShelf = useCallback(
    (genre) => {
      setRequested((current) => {
        if (current.has(genre)) return current
        const next = new Set(current)
        next.add(genre)
        fetchShelfGames(filters || {}, genre)
          .then((payload) => {
            setShelves((rows) => ({ ...rows, [genre]: payload }))
          })
          .catch((error) => {
            if (error?.name === 'AbortError') return
            // An empty shelf, not a broken page: one genre failing to answer
            // must not take the other forty with it.
            setShelves((rows) => ({ ...rows, [genre]: { games: [], total: 0 } }))
          })
        return next
      })
    },
    [filters],
  )

  const fallbackSections = useMemo(
    () => (genresFailed ? groupCatalogGamesByGenre(games) : []),
    [games, genresFailed],
  )

  const cardProps = {
    showPlayStatus,
    isAdmin,
    enableDeleteOnDisk,
    onToggleFavorite,
    hidePlatformChip,
    selectionEnabled,
    onSelectionToggle,
    activePlatform,
    layout: 'tile',
  }

  return (
    <div
      ref={listRef}
      className={`catalog-grid-sections game-library-container${
        selecting ? ' is-selecting' : ''
      }`}
      data-library-shelves
      data-layout="grid"
    >
      {genresFailed
        ? fallbackSections.map((section) => (
            <CatalogGenreShelf
              key={section.title}
              title={section.title}
              games={section.games}
              cardProps={cardProps}
              selectedIds={selectedIds}
            />
          ))
        : (genres || []).map((genre) => {
            const shelf = shelves[genre]
            // A genre the current filters empty out is not a shelf. The bundle
            // lists every genre in the library; under `library_platform=NES`
            // most of them have nothing behind them.
            if (shelf && shelf.total === 0) return null
            return (
              <CatalogGenreShelf
                key={genre}
                title={genre}
                games={shelf?.games || []}
                total={shelf ? shelf.total : null}
                pending={!shelf}
                seeAllHref={`/library?genre=${encodeURIComponent(genre)}`}
                onNeeded={shelf ? null : () => loadShelf(genre)}
                cardProps={cardProps}
                selectedIds={selectedIds}
              />
            )
          })}
    </div>
  )
}

export default CatalogGridSections
