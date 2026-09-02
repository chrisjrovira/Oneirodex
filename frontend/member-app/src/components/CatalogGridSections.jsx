import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { groupCatalogGamesByGenre } from '../utils/catalogGridGroups'
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

  return (
    <section className="od-shelf od-shelf--shelf catalog-grid-section">
      <div className="od-shelf__head">
        <div className="od-shelf__heading">
          <h2 className="od-shelf__title">
            <span className="od-shelf__title-text">{title}</span>
          </h2>
        </div>
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
 */
export function CatalogGridSections({
  games,
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
  const sections = useMemo(() => groupCatalogGamesByGenre(games), [games])

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
      {sections.map((section) => (
        <CatalogGenreShelf
          key={section.title}
          title={section.title}
          games={section.games}
          cardProps={cardProps}
          selectedIds={selectedIds}
        />
      ))}
    </div>
  )
}

export default CatalogGridSections
