import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import './GameGrid.css'
import { GameCard } from './GameCard'
import {
  chunkGamesIntoRows,
  computeGridColumns,
  estimateGridRowHeight,
  readCssPx,
} from './gameGridLayout'

function measureGridMetrics(el) {
  if (!el) {
    return { width: 0, tileMin: 180, gap: 10, scrollMargin: 0 }
  }
  const width = el.clientWidth || 0
  const tileMin = readCssPx(el, '--gt-tile-min', 180)
  const gap = readCssPx(el, '--gt-tile-gap', 10)
  const top = el.getBoundingClientRect?.().top
  const scrollMargin =
    Number.isFinite(top) ? top + (window.scrollY || 0) : el.offsetTop || 0
  return { width, tileMin, gap, scrollMargin }
}

export function GameGrid({
  games,
  showPlayStatus = false,
  isAdmin = false,
  enableDeleteOnDisk = false,
  onToggleFavorite,
  hidePlatformChip = false,
}) {
  const listRef = useRef(null)
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

    const update = () => {
      setMetrics(measureGridMetrics(el))
    }
    update()

    let resizeObserver
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(update)
      resizeObserver.observe(el)
    }

    // Tile size slider writes --gt-tile-* on <html>; remeasure when that changes.
    const mutationObserver =
      typeof MutationObserver !== 'undefined'
        ? new MutationObserver(update)
        : null
    mutationObserver?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style'],
    })

    window.addEventListener('resize', update)
    return () => {
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  const width = metrics.width > 0 ? metrics.width : 960
  const columnCount = computeGridColumns(width, metrics.tileMin, metrics.gap)
  const rowHeight = estimateGridRowHeight(width, columnCount, metrics.gap)
  const rows = useMemo(
    () => chunkGamesIntoRows(games, columnCount),
    [games, columnCount],
  )

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => rowHeight,
    overscan: 3,
    scrollMargin: metrics.scrollMargin,
    gap: metrics.gap,
  })

  useEffect(() => {
    virtualizer.measure()
    // measure() only when layout inputs change; virtualizer identity is unstable.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [rowHeight, columnCount, metrics.gap, metrics.scrollMargin, rows.length])

  const cardProps = {
    showPlayStatus,
    isAdmin,
    enableDeleteOnDisk,
    onToggleFavorite,
    hidePlatformChip,
  }

  // Empty list: keep a grid root for LibraryApp empty-state layout / tests.
  if (games.length === 0) {
    return (
      <div
        ref={listRef}
        className="game-library-container"
        data-library-grid
        data-library-virtual
      />
    )
  }

  const virtualRows = virtualizer.getVirtualItems()

  return (
    <div
      ref={listRef}
      className="game-library-container"
      data-library-grid
      data-library-virtual
      style={{
        height: `${virtualizer.getTotalSize()}px`,
        position: 'relative',
        width: '100%',
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
              <GameCard key={game.uuid} game={game} {...cardProps} />
            ))}
          </div>
        )
      })}
    </div>
  )
}
