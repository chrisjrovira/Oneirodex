import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  elementScroll,
  observeElementOffset,
  observeElementRect,
  observeWindowOffset,
  observeWindowRect,
  useVirtualizer,
  windowScroll,
} from '@tanstack/react-virtual'
import './GameGrid.css'
import { GameCard } from './GameCard'
import {
  chunkGamesIntoRows,
  computeGridColumns,
  estimateGridRowHeight,
  findScrollParent,
  readCssPx,
} from './gameGridLayout'
import {
  CATALOG_ROW_HEIGHT,
  denseCatalogTileMin,
  normalizeCatalogLayout,
} from '../utils/catalogLayout'

const TILE_REMEASURE_DEBOUNCE_MS = 160

/**
 * Distance from the top of the scrollable content to the top of the grid.
 *
 * The virtualizer decides which rows to mount by comparing row offsets against
 * the scroll offset, so both have to be in the same coordinate space: document
 * coordinates when the window scrolls, and content coordinates (i.e. what
 * `scrollTop` counts) when an element does.
 */
function measureScrollMargin(el, scrollEl) {
  const top = el.getBoundingClientRect?.().top
  if (!Number.isFinite(top)) {
    return el.offsetTop || 0
  }
  if (!scrollEl) {
    return top + (window.scrollY || 0)
  }
  const box = scrollEl.getBoundingClientRect()
  const borderTop = readCssPx(scrollEl, 'border-top-width', 0)
  return Math.max(0, top - box.top - borderTop + (scrollEl.scrollTop || 0))
}

function measureGridMetrics(el, scrollEl) {
  if (!el) {
    return { width: 0, tileMin: 180, gap: 10, scrollMargin: 0 }
  }
  const width = el.clientWidth || 0
  const tileMin = readCssPx(el, '--gt-tile-min', 180)
  const gap = readCssPx(el, '--gt-tile-gap', 10)
  return { width, tileMin, gap, scrollMargin: measureScrollMargin(el, scrollEl) }
}

function metricsEqual(a, b) {
  return (
    a.width === b.width &&
    a.tileMin === b.tileMin &&
    a.gap === b.gap &&
    a.scrollMargin === b.scrollMargin
  )
}

export function GameGrid({
  games,
  showPlayStatus = false,
  isAdmin = false,
  enableDeleteOnDisk = false,
  onToggleFavorite,
  hidePlatformChip = false,
  selectionEnabled = false,
  selectedIds = null,
  onSelectionToggle,
  activePlatform = '',
  layout = 'tile',
}) {
  const catalogLayout = normalizeCatalogLayout(layout)
  const listRef = useRef(null)
  // `undefined` = not resolved yet, `null` = resolved to "the window scrolls".
  const [scrollEl, setScrollEl] = useState(undefined)
  const [metrics, setMetrics] = useState(() => ({
    width: 0,
    tileMin: 180,
    gap: 10,
    scrollMargin: 0,
  }))

  useLayoutEffect(() => {
    const el = listRef.current
    if (!el) {
      return undefined
    }

    const scroller = findScrollParent(el)
    setScrollEl(scroller)

    let tileTimer = 0
    let resizeRaf = 0

    const commit = (next) => {
      setMetrics((current) => (metricsEqual(current, next) ? current : next))
    }

    const updateNow = () => {
      commit(measureGridMetrics(el, scroller))
    }

    /** Resize / scroll-margin: immediate (batched via rAF). */
    const updateResize = () => {
      if (resizeRaf) {
        cancelAnimationFrame(resizeRaf)
      }
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0
        updateNow()
      })
    }

    /**
     * Tile size slider writes --gt-tile-* on <html> every tick.
     * Debounce remeasure so CSS var transitions can run without virtualizer thrash.
     */
    const updateTileVars = () => {
      window.clearTimeout(tileTimer)
      tileTimer = window.setTimeout(updateNow, TILE_REMEASURE_DEBOUNCE_MS)
    }

    updateNow()

    let resizeObserver
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateResize)
      resizeObserver.observe(el)
      // Anything between the grid and the scroll container changing height
      // moves the grid without resizing it — the selection bar appearing above
      // it is the case that matters, since it is inserted into the flow the
      // moment a tile is picked. Observing those ancestors keeps scrollMargin
      // honest; `commit` no-ops when nothing actually changed, so the extra
      // callbacks cost a measure and nothing else.
      for (let node = el.parentElement; node; node = node.parentElement) {
        resizeObserver.observe(node)
        if (node === scroller) {
          break
        }
      }
    }

    const mutationObserver =
      typeof MutationObserver !== 'undefined'
        ? new MutationObserver(updateTileVars)
        : null
    mutationObserver?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style'],
    })

    window.addEventListener('resize', updateResize)
    return () => {
      window.clearTimeout(tileTimer)
      if (resizeRaf) {
        cancelAnimationFrame(resizeRaf)
      }
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
      window.removeEventListener('resize', updateResize)
    }
  }, [])

  const width = metrics.width > 0 ? metrics.width : 960
  const tileMin =
    catalogLayout === 'grid'
      ? denseCatalogTileMin(metrics.tileMin)
      : metrics.tileMin
  const columnCount =
    catalogLayout === 'rows' ? 1 : computeGridColumns(width, tileMin, metrics.gap)
  const rowHeight =
    catalogLayout === 'rows'
      ? CATALOG_ROW_HEIGHT
      : estimateGridRowHeight(width, columnCount, metrics.gap)
  const rows = useMemo(
    () => chunkGamesIntoRows(games, columnCount),
    [games, columnCount],
  )

  /**
   * Virtualise against whatever actually scrolls.
   *
   * This was `useWindowVirtualizer`, and in the member shell the window never
   * scrolls: `.gt-shell` is `height: 100dvh; overflow: hidden` and
   * `.gt-shell__main` is, by its own comment, "the only scroll container in the
   * shell". `window.scrollY` therefore stayed 0 forever, the virtualizer never
   * advanced its range past the first screenful, and everything below the first
   * few rows was empty space inside a container still sized for the whole page.
   *
   * `useWindowVirtualizer` is `useVirtualizer` with the window observers
   * swapped in, so selecting the observers by what we found is the same call
   * with the choice made explicit — and it keeps the window path for surfaces
   * where the page itself scrolls, jsdom in tests included.
   */
  const usesWindow = !scrollEl
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () =>
      usesWindow ? (typeof document === 'undefined' ? null : window) : scrollEl,
    observeElementRect: usesWindow ? observeWindowRect : observeElementRect,
    observeElementOffset: usesWindow ? observeWindowOffset : observeElementOffset,
    scrollToFn: usesWindow ? windowScroll : elementScroll,
    initialOffset: () => {
      if (usesWindow) {
        return typeof document === 'undefined' ? 0 : window.scrollY
      }
      return scrollEl.scrollTop || 0
    },
    estimateSize: () => rowHeight,
    overscan: 3,
    scrollMargin: metrics.scrollMargin,
    gap: metrics.gap,
  })

  useEffect(() => {
    virtualizer.measure()
    // measure() only when layout inputs change; virtualizer identity is unstable.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [
    rowHeight,
    columnCount,
    metrics.gap,
    metrics.scrollMargin,
    rows.length,
    scrollEl,
  ])

  const cardProps = {
    showPlayStatus,
    isAdmin,
    enableDeleteOnDisk,
    onToggleFavorite,
    hidePlatformChip,
    selectionEnabled,
    onSelectionToggle,
    activePlatform,
    layout: catalogLayout,
  }

  const selecting = selectionEnabled && selectedIds && selectedIds.size > 0

  // Empty list: keep a grid root for LibraryApp empty-state layout / tests.
  if (games.length === 0) {
    return (
      <div
        ref={listRef}
        className={`game-library-container${selecting ? ' is-selecting' : ''}`}
        data-library-grid
        data-library-virtual
        data-layout={catalogLayout}
      />
    )
  }

  const virtualRows = virtualizer.getVirtualItems()

  return (
    <div
      ref={listRef}
      className={`game-library-container${selecting ? ' is-selecting' : ''}`}
      data-library-grid
      data-library-virtual
      data-layout={catalogLayout}
      style={{
        height: `${virtualizer.getTotalSize()}px`,
        position: 'relative',
        width: '100%',
        ...(catalogLayout === 'grid'
          ? { '--gt-catalog-col-min': `${tileMin}px` }
          : null),
      }}
    >
      {virtualRows.map((virtualRow) => {
        const rowGames = rows[virtualRow.index] || []
        return (
          <div
            key={virtualRow.key}
            className="game-library-row"
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${
                virtualRow.start - virtualizer.options.scrollMargin
              }px)`,
            }}
          >
            {rowGames.map((game) => (
              <GameCard
                key={game.uuid}
                game={game}
                selected={Boolean(selectedIds?.has(game.uuid))}
                {...cardProps}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}
