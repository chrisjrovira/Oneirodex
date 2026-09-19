import { useCallback, useRef, useState } from 'react'
import type { BrowseResult } from './libraryTypes'

/* Selection state pulled out of LibraryApp (v11 cycle, H-D.2); bodies unchanged. */

/** Which tiles are selected, plus page-select, clear, and shift-click ranges. */
export function useLibrarySelection(result: BrowseResult | null) {
  const [selectedIds, setSelectedIds] = useState(() => new Set<string>())
  const selectionAnchorRef = useRef<string | null>(null)

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    selectionAnchorRef.current = null
  }, [])

  const selectPage = () => {
    const pageGames = result?.games ?? []
    if (pageGames.length === 0) {
      return
    }
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const game of pageGames) {
        if (game?.uuid) {
          next.add(game.uuid)
        }
      }
      return next
    })
  }

  const handleSelectionToggle = (uuid: any, opts: LooseProps = {}) => {
    const games = result?.games ?? []
    setSelectedIds((prev) => {
      const next = new Set(prev)

      if (opts.range && games.length > 0) {
        const anchor = selectionAnchorRef.current
        const endIndex = games.findIndex((game: any) => game.uuid === uuid)
        const startIndex = anchor ? games.findIndex((game: any) => game.uuid === anchor) : endIndex
        if (endIndex >= 0 && startIndex >= 0) {
          const from = Math.min(startIndex, endIndex)
          const to = Math.max(startIndex, endIndex)
          for (let i = from; i <= to; i += 1) {
            next.add(games[i].uuid)
          }
          selectionAnchorRef.current = uuid
          return next
        }
      }

      if (opts.checked === true) {
        next.add(uuid)
      } else if (opts.checked === false) {
        next.delete(uuid)
      } else if (opts.fromLongPress || opts.additive) {
        next.add(uuid)
      } else if (next.has(uuid)) {
        next.delete(uuid)
      } else {
        next.add(uuid)
      }

      selectionAnchorRef.current = uuid
      return next
    })
  }

  return { selectedIds, setSelectedIds, clearSelection, selectPage, handleSelectionToggle }
}
